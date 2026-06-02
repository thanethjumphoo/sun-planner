const fs = require('fs');

const code = `
  const icutMaster = await manager.getRepository('ICutMaster').findOne({ where: { isActive: true } });
  const coproductYieldPct = Number((icutMaster as any)?.coproductYieldPct ?? 0.20); // Default 0.20 (20%)
  const mainYieldPct = 1.0 - coproductYieldPct;

  // ══════════════════════════════════════
  // Phase 1: Belt Gate SIZING
  // ══════════════════════════════════════
  for (const order of phase1SizingOrders) {
    const spec = specMap.get(order.erpOrderItemCode);
    const itemDesc = (spec as any)?.erpItemDesc || order.erpOrderItemCode;
    const descUpper = itemDesc.toUpperCase();
    const productType = (spec as any)?.productType || 'Freeze';
    const specSize = (spec as any)?.productSize;
    const minLead = (spec as any)?.minProductLead ?? 1;
    const maxLead = (spec as any)?.maxProductLead ?? 3;
    const orderQty = Number(order.erpOrderItemQty || 0);
    let remainingQty = orderQty;
    const shipDate = new Date(order.erpOrderShipDate);

    const requiredMapping = extractBeltGateSizes(descUpper, specSize);
    if (!requiredMapping) continue;
    const yieldMultiplier = requiredMapping.yieldPct / 100;

    for (let leadDay = minLead; leadDay <= maxLead; leadDay++) {
      if (remainingQty <= 0) break;
      const prodDate = subtractDays(shipDate, leadDay);
      const dateStr = formatDate(prodDate);
      const sup = supplyMap.get(dateStr);
      if (!sup) continue;

      const rmNeeded = remainingQty / yieldMultiplier;
      let allocRmQty = 0;

      // Pull from specific Belt Gate mapped sizes
      for (const targetSize of requiredMapping.rmSizes) {
        if (allocRmQty >= rmNeeded) break;
        
        const availTargetSize = sup.blSizes[targetSize] || 0;
        if (availTargetSize > 0) {
          const normalRmToUse = Math.min(availTargetSize, rmNeeded - allocRmQty);
          
          sup.blSizes[targetSize] -= normalRmToUse;
          
          if (descUpper.includes('TH')) {
            sup.available.BLTH -= normalRmToUse;
          } else {
            sup.available.BL -= normalRmToUse;
          }
          
          allocRmQty += normalRmToUse;
        }
      }

      if (allocRmQty <= 0) continue;

      const productProduced = Math.round(allocRmQty * yieldMultiplier);
      remainingQty -= productProduced;
      mpsOrdersToSave.push(createOrderRecord(order, productProduced, prodDate, shipDate, itemDesc, productType));
    }

    if (remainingQty > 0) {
      exceptionsToSave.push(createExceptionRecord(order, remainingQty, shipDate, \`RM BL supply ตาม Size ที่กำหนดไม่เพียงพอสำหรับ order Sizing นี้\`));
    }
  }

  // ══════════════════════════════════════
  // Phase 2: SPECIAL (BL TH / BL DR without I-Cut)
  // ══════════════════════════════════════
  for (const order of phase2SpecialOrders) {
    const spec = specMap.get(order.erpOrderItemCode);
    const itemDesc = (spec as any)?.erpItemDesc || order.erpOrderItemCode;
    const classification = classifyOrder(order);
    const productType = (spec as any)?.productType || 'Freeze';
    const minLead = (spec as any)?.minProductLead ?? 1;
    const maxLead = (spec as any)?.maxProductLead ?? 3;
    const orderQty = Number(order.erpOrderItemQty || 0);
    let remainingQty = orderQty;
    const shipDate = new Date(order.erpOrderShipDate);

    for (let leadDay = minLead; leadDay <= maxLead; leadDay++) {
      if (remainingQty <= 0) break;
      const prodDate = subtractDays(shipDate, leadDay);
      const dateStr = formatDate(prodDate);
      const sup = supplyMap.get(dateStr);
      if (!sup) continue;

      let avail = 0;
      if (classification === 'BLDR') avail = sup.available.BLDR;
      else if (classification === 'BLTH') avail = sup.available.BLTH;
      
      if (avail <= 0) continue;

      const allocQty = Math.round(Math.min(avail, remainingQty));
      if (allocQty <= 0) continue;

      if (classification === 'BLDR') sup.available.BLDR -= allocQty;
      else if (classification === 'BLTH') sup.available.BLTH -= allocQty;
      
      remainingQty -= allocQty;
      mpsOrdersToSave.push(createOrderRecord(order, allocQty, prodDate, shipDate, itemDesc, productType));
    }

    if (remainingQty > 0) {
      exceptionsToSave.push(createExceptionRecord(order, remainingQty, shipDate, \`RM Special supply ไม่เพียงพอสำหรับ order นี้\`));
    }
  }

  // ══════════════════════════════════════
  // Phase 3: I-CUT (RM remaining -> BLK <=60g, BL TH 20g range)
  // ══════════════════════════════════════
  for (const order of phase3IcutOrders) {
    const spec = specMap.get(order.erpOrderItemCode);
    const itemDesc = (spec as any)?.erpItemDesc || order.erpOrderItemCode;
    const descUpper = itemDesc.toUpperCase();
    const classification = classifyOrder(order);
    const productType = (spec as any)?.productType || 'Freeze';
    const minLead = (spec as any)?.minProductLead ?? 1;
    const maxLead = (spec as any)?.maxProductLead ?? 3;
    const orderQty = Number(order.erpOrderItemQty || 0);
    let remainingQty = orderQty;
    const shipDate = new Date(order.erpOrderShipDate);

    const yieldMultiplier = mainYieldPct;

    for (let leadDay = minLead; leadDay <= maxLead; leadDay++) {
      if (remainingQty <= 0) break;
      const prodDate = subtractDays(shipDate, leadDay);
      const dateStr = formatDate(prodDate);
      const sup = supplyMap.get(dateStr);
      if (!sup) continue;

      let avail = classification === 'BLTH' ? sup.available.BLTH : sup.available.BL;
      if (avail <= 0) continue;

      const tracker = getTracker(dateStr);
      const icutHoursRemaining = MAX_ICUT_HOURS_PER_DAY - tracker.icutUsedHours;
      if (icutHoursRemaining <= 0) continue;

      const icutSpeed = spec && (spec as any).icutSpeed ? Number((spec as any).icutSpeed) : 1000;
      const rmNeeded = remainingQty / yieldMultiplier;
      const maxKgAllowedByTime = icutHoursRemaining * icutSpeed;
      const allocRmQty = Math.round(Math.min(avail, rmNeeded, maxKgAllowedByTime));
      
      if (allocRmQty <= 0) continue;

      const productProduced = Math.round(allocRmQty * yieldMultiplier);
      const blockProduced = allocRmQty - productProduced;

      const hoursUsed = allocRmQty / icutSpeed;
      tracker.icutUsedKg += allocRmQty;
      tracker.icutUsedHours += hoursUsed;

      if (classification === 'BLTH') sup.available.BLTH -= allocRmQty;
      else sup.available.BL -= allocRmQty;
      
      remainingQty -= productProduced;

      // Extract original size to map BL BLOCK
      const specSize = (spec as any)?.productSize || '';
      let blockKey = 'BL_BLOCK_UNSIZED';
      const m = specSize.match(/(\\d+)\\s*-\\s*(\\d+)/);
      if (m) {
        blockKey = \`BL_BLOCK_\${m[1]}_\${m[2]}\`;
      }
      
      sup.blSizes[blockKey] = (sup.blSizes[blockKey] || 0) + blockProduced;
      sup.blSizes['TOTAL_BL_BLOCK'] = (sup.blSizes['TOTAL_BL_BLOCK'] || 0) + blockProduced;
      tracker.blBlockProduced += blockProduced;

      let remainingToDeduct = allocRmQty;
      for (const [sz, qty] of Object.entries(sup.blSizes)) {
        if (sz.startsWith('BL_BLOCK') || sz === 'TOTAL_BL_BLOCK') continue;
        if (remainingToDeduct <= 0) break;
        if (qty > 0) {
          const deduct = Math.min(qty, remainingToDeduct);
          sup.blSizes[sz] -= deduct;
          remainingToDeduct -= deduct;
        }
      }

      mpsOrdersToSave.push(createOrderRecord(order, productProduced, prodDate, shipDate, itemDesc, productType));
    }

    if (remainingQty > 0) {
      exceptionsToSave.push(createExceptionRecord(order, remainingQty, shipDate, \`RM supply หรือ I-Cut capacity ไม่เพียงพอสำหรับ order I-Cut นี้\`));
    }
  }

  // ══════════════════════════════════════
  // Phase 4: BL BLOCK Direct Sale & Manual Trimming from BL BLOCK
  // ══════════════════════════════════════
  for (const order of phase4BlBlockSaleOrders) {
    const spec = specMap.get(order.erpOrderItemCode);
    const itemDesc = (spec as any)?.erpItemDesc || order.erpOrderItemCode;
    const productType = (spec as any)?.productType || 'Freeze';
    const minLead = (spec as any)?.minProductLead ?? 1;
    const maxLead = (spec as any)?.maxProductLead ?? 3;
    const orderQty = Number(order.erpOrderItemQty || 0);
    let remainingQty = orderQty;
    const shipDate = new Date(order.erpOrderShipDate);

    for (let leadDay = minLead; leadDay <= maxLead; leadDay++) {
      if (remainingQty <= 0) break;
      const prodDate = subtractDays(shipDate, leadDay);
      const dateStr = formatDate(prodDate);
      const sup = supplyMap.get(dateStr);
      if (!sup) continue;

      const availBlock = sup.blSizes['TOTAL_BL_BLOCK'] || 0;
      if (availBlock <= 0) continue;

      const allocQty = Math.round(Math.min(availBlock, remainingQty));
      if (allocQty <= 0) continue;

      let toDeduct = allocQty;
      for (const sz of Object.keys(sup.blSizes)) {
        if (sz.startsWith('BL_BLOCK_') && sz !== 'TOTAL_BL_BLOCK') {
          const availSz = sup.blSizes[sz];
          if (availSz > 0 && toDeduct > 0) {
            const use = Math.min(availSz, toDeduct);
            sup.blSizes[sz] -= use;
            toDeduct -= use;
          }
        }
      }
      sup.blSizes['TOTAL_BL_BLOCK'] -= allocQty;
      remainingQty -= allocQty;

      mpsOrdersToSave.push(createOrderRecord(order, allocQty, prodDate, shipDate, itemDesc, productType));
    }

    if (remainingQty > 0) {
      exceptionsToSave.push(createExceptionRecord(order, remainingQty, shipDate, \`BL BLOCK supply ไม่เพียงพอสำหรับ order ขายตรงนี้\`));
    }
  }

  for (const order of phase4BlBlockOrders) {
    const spec = specMap.get(order.erpOrderItemCode);
    const itemDesc = (spec as any)?.erpItemDesc || order.erpOrderItemCode;
    const productType = (spec as any)?.productType || 'Freeze';
    const specSize = (spec as any)?.productSize || '';
    const minLead = (spec as any)?.minProductLead ?? 1;
    const maxLead = (spec as any)?.maxProductLead ?? 3;
    const orderQty = Number(order.erpOrderItemQty || 0);
    let remainingQty = orderQty;
    const shipDate = new Date(order.erpOrderShipDate);
    
    // Map required block size (1 step up)
    // E.g. Order is 20-25g, we need BL_BLOCK_25_30
    let requiredBlockKey: string | null = null;
    const m = specSize.match(/(\\d+)\\s*-\\s*(\\d+)/);
    if (m) {
      const lo = parseInt(m[1], 10);
      const hi = parseInt(m[2], 10);
      requiredBlockKey = \`BL_BLOCK_\${lo + 5}_\${hi + 5}\`; // Hardcoded 5g step up assumption
    }

    for (let leadDay = minLead; leadDay <= maxLead; leadDay++) {
      if (remainingQty <= 0) break;
      const prodDate = subtractDays(shipDate, leadDay);
      const dateStr = formatDate(prodDate);
      const sup = supplyMap.get(dateStr);
      if (!sup) continue;
      
      const tracker = getTracker(dateStr);

      let availBlock = 0;
      let blockKeyUsed = '';
      
      if (requiredBlockKey && sup.blSizes[requiredBlockKey] > 0) {
         availBlock = sup.blSizes[requiredBlockKey];
         blockKeyUsed = requiredBlockKey;
      } else if (sup.blSizes['BL_BLOCK_UNSIZED'] > 0) {
         availBlock = sup.blSizes['BL_BLOCK_UNSIZED'];
         blockKeyUsed = 'BL_BLOCK_UNSIZED';
      }

      if (availBlock > 0) {
        const blockToUse = Math.min(availBlock, remainingQty);
        sup.blSizes[blockKeyUsed] -= blockToUse;
        sup.blSizes['TOTAL_BL_BLOCK'] -= blockToUse;
        remainingQty -= blockToUse;
        tracker.blBlockUsed += blockToUse;
        tracker.manualUsedKg += blockToUse;

        mpsOrdersToSave.push(createOrderRecord(order, blockToUse, prodDate, shipDate, itemDesc, productType));
      }
    }
    
    // If remaining, push it to phase 5 to use RM BL directly
    if (remainingQty > 0) {
       // We mock a StgErpOrderLine with reduced qty
       const leftoverOrder = { ...order, erpOrderItemQty: remainingQty };
       phase5ManualOrders.push(leftoverOrder as any);
    }
  }

  // ══════════════════════════════════════
  // Phase 5: Manual BLK (>60g) & Other Trimming (RM remaining)
  // ══════════════════════════════════════
  for (const order of phase5ManualOrders) {
    const spec = specMap.get(order.erpOrderItemCode);
    const itemDesc = (spec as any)?.erpItemDesc || order.erpOrderItemCode;
    const classification = classifyOrder(order);
    const productType = (spec as any)?.productType || 'Freeze';
    const productYield = Number((spec as any)?.productYield || 0.90);
    const minLead = (spec as any)?.minProductLead ?? 1;
    const maxLead = (spec as any)?.maxProductLead ?? 3;
    const orderQty = Number(order.erpOrderItemQty || 0);
    let remainingQty = orderQty;
    const shipDate = new Date(order.erpOrderShipDate);

    for (let leadDay = minLead; leadDay <= maxLead; leadDay++) {
      if (remainingQty <= 0) break;
      const prodDate = subtractDays(shipDate, leadDay);
      const dateStr = formatDate(prodDate);
      const sup = supplyMap.get(dateStr);
      if (!sup) continue;
      
      const tracker = getTracker(dateStr);
      const rmNeeded = remainingQty / productYield;
      let allocRmQty = 0;

      // 1. ดึง BL BLOCK ที่เหลือก่อน (ถ้ามี)
      const availBlock = sup.blSizes['TOTAL_BL_BLOCK'] || 0;
      if (availBlock > 0 && classification === 'BLK') {
        const blockToUse = Math.min(availBlock, rmNeeded);
        let toDeduct = blockToUse;
        for (const sz of Object.keys(sup.blSizes)) {
          if (sz.startsWith('BL_BLOCK_') && sz !== 'TOTAL_BL_BLOCK') {
            const availSz = sup.blSizes[sz];
            if (availSz > 0 && toDeduct > 0) {
              const use = Math.min(availSz, toDeduct);
              sup.blSizes[sz] -= use;
              toDeduct -= use;
            }
          }
        }
        sup.blSizes['TOTAL_BL_BLOCK'] -= blockToUse;
        allocRmQty += blockToUse;
        tracker.blBlockUsed += blockToUse;
      }

      // 2. ดึง RM ตามประเภท (BLTH ดึง BL-TH, อื่นๆ ดึง BL)
      if (allocRmQty < rmNeeded) {
        if (classification === 'BLTH' && sup.available.BLTH > 0) {
          const rmToUse = Math.min(sup.available.BLTH, rmNeeded - allocRmQty);
          sup.available.BLTH -= rmToUse;
          allocRmQty += rmToUse;
        }
        
        // Fallback to RM BL
        if (allocRmQty < rmNeeded && sup.available.BL > 0) {
          const normalRmToUse = Math.min(sup.available.BL, rmNeeded - allocRmQty);
          sup.available.BL -= normalRmToUse;
          allocRmQty += normalRmToUse;

          let remainingToDeduct = normalRmToUse;
          for (const [sz, qty] of Object.entries(sup.blSizes)) {
            if (sz.startsWith('BL_BLOCK') || sz === 'TOTAL_BL_BLOCK') continue;
            if (remainingToDeduct <= 0) break;
            if (qty > 0) {
              const deduct = Math.min(qty, remainingToDeduct);
              sup.blSizes[sz] -= deduct;
              remainingToDeduct -= deduct;
            }
          }
        }
      }

      if (allocRmQty <= 0) continue;

      const productProduced = Math.round(allocRmQty * productYield);
      tracker.manualUsedKg += allocRmQty;

      remainingQty -= productProduced;
      mpsOrdersToSave.push(createOrderRecord(order, productProduced, prodDate, shipDate, itemDesc, productType));
    }

    if (remainingQty > 0) {
      exceptionsToSave.push(createExceptionRecord(order, remainingQty, shipDate, \`RM supply ไม่เพียงพอสำหรับ order Manual นี้\`));
    }
  }
`;

const file = 'c:/Users/PCSLHICT-THANETH/Documents/github/sun-planner/backend/src/bl-logic.helper.ts';
let fileContent = fs.readFileSync(file, 'utf-8');

const startIndex = fileContent.indexOf("  const icutMaster = await manager.getRepository('ICutMaster').findOne({ where: { isActive: true } });");
const endText = "// Save Orders and Exceptions";
const rawEndIndex = fileContent.indexOf(endText);
const finalEndIndex = fileContent.lastIndexOf("  // ──────────────────────────────────────", rawEndIndex);

if (startIndex === -1 || finalEndIndex === -1) {
  console.log("Could not find markers!");
  console.log("Start: ", startIndex);
  console.log("End: ", finalEndIndex);
  process.exit(1);
}

const newContent = fileContent.slice(0, startIndex) + code + "\\n" + fileContent.slice(finalEndIndex);
fs.writeFileSync(file, newContent, 'utf-8');
console.log("Done");
