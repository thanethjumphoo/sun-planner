const fs = require('fs');
const file = 'c:/Users/PCSLHICT-THANETH/Documents/github/sun-planner/backend/src/bl-logic.helper.ts';
let code = fs.readFileSync(file, 'utf8');

// Update deductRM helper to return the breakdown
const deductRMOld = `
    // Fallback sync total aggregate
    const totalDeducted = extDeducted + intDeducted;
    sup.available[rmType] -= totalDeducted;
    if (sizeKey) sup.blSizes[sizeKey] -= totalDeducted;

    return totalDeducted;
`;
const deductRMNew = `
    // Fallback sync total aggregate
    const totalDeducted = extDeducted + intDeducted;
    sup.available[rmType] -= totalDeducted;
    if (sizeKey) sup.blSizes[sizeKey] -= totalDeducted;

    return { total: totalDeducted, intUsed: intDeducted, extUsed: extDeducted };
`;
code = code.replace(deductRMOld, deductRMNew);

// Fix Phase 1 and 2 to use .total
code = code.replace(`const actualDeducted = deductRM(sup, rmType, normalRmToUse, allowedExt, targetSize);\n          allocRmQty += actualDeducted;`, `const actualDeducted = deductRM(sup, rmType, normalRmToUse, allowedExt, targetSize);\n          allocRmQty += actualDeducted.total;`);
code = code.replace(`allocRmQty = deductRM(sup, 'BLTH', allocRmQty, allowedExt);`, `allocRmQty = deductRM(sup, 'BLTH', allocRmQty, allowedExt).total;`);
code = code.replace(`allocRmQty = deductRM(sup, 'BLDR', allocRmQty, allowedExt);`, `allocRmQty = deductRM(sup, 'BLDR', allocRmQty, allowedExt).total;`);

// Phase 3 Replacement
const p3Old = `
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
`;

const p3New = `
      const rmType = classification === 'BLTH' ? 'BLTH' : 'BL';
      const allowedExt = !!(spec as any)?.isExternalRmAllowed;
      let avail = sup.internalAvailable[rmType];
      if (allowedExt) avail += sup.externalAvailable[rmType];
      if (avail <= 0) continue;

      const tracker = getTracker(dateStr);
      const icutHoursRemaining = MAX_ICUT_HOURS_PER_DAY - tracker.icutUsedHours;
      if (icutHoursRemaining <= 0) continue;

      const icutSpeed = spec && (spec as any).icutSpeed ? Number((spec as any).icutSpeed) : 1000;
      const rmNeeded = remainingQty / yieldMultiplier;
      const maxKgAllowedByTime = icutHoursRemaining * icutSpeed;
      let allocRmQty = Math.round(Math.min(avail, rmNeeded, maxKgAllowedByTime));
      
      if (allocRmQty <= 0) continue;

      const deducted = deductRM(sup, rmType, allocRmQty, allowedExt);
      allocRmQty = deducted.total;

      const productProduced = Math.round(allocRmQty * yieldMultiplier);
      const blockProduced = allocRmQty - productProduced;
      
      const blockRatioInt = allocRmQty > 0 ? deducted.intUsed / allocRmQty : 1;
      const blockRatioExt = allocRmQty > 0 ? deducted.extUsed / allocRmQty : 0;

      const hoursUsed = allocRmQty / icutSpeed;
      tracker.icutUsedKg += allocRmQty;
      tracker.icutUsedHours += hoursUsed;
`;
code = code.replace(p3Old, p3New);

// Phase 3 Block Production
const p3BlockOld = `
      sup.blSizes[blockKey] = (sup.blSizes[blockKey] || 0) + blockProduced;
      sup.blSizes['TOTAL_BL_BLOCK'] = (sup.blSizes['TOTAL_BL_BLOCK'] || 0) + blockProduced;
      tracker.blBlockProduced += blockProduced;
`;
const p3BlockNew = `
      sup.blSizes[blockKey] = (sup.blSizes[blockKey] || 0) + blockProduced;
      sup.blSizes['TOTAL_BL_BLOCK'] = (sup.blSizes['TOTAL_BL_BLOCK'] || 0) + blockProduced;
      
      sup.internalSizes[blockKey] = (sup.internalSizes[blockKey] || 0) + (blockProduced * blockRatioInt);
      sup.externalSizes[blockKey] = (sup.externalSizes[blockKey] || 0) + (blockProduced * blockRatioExt);
      sup.internalSizes['TOTAL_BL_BLOCK'] = (sup.internalSizes['TOTAL_BL_BLOCK'] || 0) + (blockProduced * blockRatioInt);
      sup.externalSizes['TOTAL_BL_BLOCK'] = (sup.externalSizes['TOTAL_BL_BLOCK'] || 0) + (blockProduced * blockRatioExt);

      tracker.blBlockProduced += blockProduced;
`;
code = code.replace(p3BlockOld, p3BlockNew);

// Phase 4 
const p4Old = `
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
`;
const p4New = `
      const allowedExt = !!(spec as any)?.isExternalRmAllowed;
      let availBlock = 0;
      let blockKeyUsed = '';
      
      const checkBlockAvail = (key: string) => {
          let a = sup.internalSizes[key] || 0;
          if (allowedExt) a += (sup.externalSizes[key] || 0);
          return a;
      };

      if (requiredBlockKey && checkBlockAvail(requiredBlockKey) > 0) {
         availBlock = checkBlockAvail(requiredBlockKey);
         blockKeyUsed = requiredBlockKey;
      } else if (checkBlockAvail('BL_BLOCK_UNSIZED') > 0) {
         availBlock = checkBlockAvail('BL_BLOCK_UNSIZED');
         blockKeyUsed = 'BL_BLOCK_UNSIZED';
      }

      if (availBlock > 0) {
        const blockToUse = Math.min(availBlock, remainingQty);
        
        // Deduct from internal/external Block Sizes proportionally or sequentially
        let remainingDeduct = blockToUse;
        if (allowedExt && sup.externalSizes[blockKeyUsed] > 0) {
            const extDeduct = Math.min(sup.externalSizes[blockKeyUsed], remainingDeduct);
            sup.externalSizes[blockKeyUsed] -= extDeduct;
            sup.externalSizes['TOTAL_BL_BLOCK'] -= extDeduct;
            remainingDeduct -= extDeduct;
        }
        if (remainingDeduct > 0 && sup.internalSizes[blockKeyUsed] > 0) {
            const intDeduct = Math.min(sup.internalSizes[blockKeyUsed], remainingDeduct);
            sup.internalSizes[blockKeyUsed] -= intDeduct;
            sup.internalSizes['TOTAL_BL_BLOCK'] -= intDeduct;
            remainingDeduct -= intDeduct;
        }

        sup.blSizes[blockKeyUsed] -= blockToUse;
        sup.blSizes['TOTAL_BL_BLOCK'] -= blockToUse;
`;
code = code.replace(p4Old, p4New);

// Phase 5
const p5Old = `
      // 1. ดึง BL BLOCK ที่เหลือก่อน (ถ้ามี)
      const availBlock = sup.blSizes['TOTAL_BL_BLOCK'] || 0;
      if (availBlock > 0 && classification === 'BLK') {
        const blockToUse = Math.min(availBlock, rmNeeded);
        let toDeduct = blockToUse;
        for (const sz of Object.keys(sup.blSizes)) {
          if (toDeduct <= 0) break;
          if (sz.startsWith('BL_BLOCK_') && sz !== 'TOTAL_BL_BLOCK') {
            const val = sup.blSizes[sz] || 0;
            const d = Math.min(val, toDeduct);
            if (d > 0) {
              sup.blSizes[sz] -= d;
              toDeduct -= d;
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
        }
      }
`;
const p5New = `
      const allowedExt = !!(spec as any)?.isExternalRmAllowed;
      
      // 1. ดึง BL BLOCK ที่เหลือก่อน (ถ้ามี)
      let availBlock = sup.internalSizes['TOTAL_BL_BLOCK'] || 0;
      if (allowedExt) availBlock += (sup.externalSizes['TOTAL_BL_BLOCK'] || 0);

      if (availBlock > 0 && classification === 'BLK') {
        const blockToUse = Math.min(availBlock, rmNeeded);
        let toDeduct = blockToUse;
        for (const sz of Object.keys(sup.blSizes)) {
          if (toDeduct <= 0) break;
          if (sz.startsWith('BL_BLOCK_') && sz !== 'TOTAL_BL_BLOCK') {
            let availSz = sup.internalSizes[sz] || 0;
            if (allowedExt) availSz += (sup.externalSizes[sz] || 0);
            
            const d = Math.min(availSz, toDeduct);
            if (d > 0) {
              // Deduct from tracking maps
              let remD = d;
              if (allowedExt && sup.externalSizes[sz] > 0) {
                  const eD = Math.min(sup.externalSizes[sz], remD);
                  sup.externalSizes[sz] -= eD;
                  sup.externalSizes['TOTAL_BL_BLOCK'] -= eD;
                  remD -= eD;
              }
              if (remD > 0 && sup.internalSizes[sz] > 0) {
                  const iD = Math.min(sup.internalSizes[sz], remD);
                  sup.internalSizes[sz] -= iD;
                  sup.internalSizes['TOTAL_BL_BLOCK'] -= iD;
                  remD -= iD;
              }
              sup.blSizes[sz] -= d;
              toDeduct -= d;
            }
          }
        }
        sup.blSizes['TOTAL_BL_BLOCK'] -= blockToUse;
        allocRmQty += blockToUse;
        tracker.blBlockUsed += blockToUse;
      }

      // 2. ดึง RM ตามประเภท (BLTH ดึง BL-TH, อื่นๆ ดึง BL)
      if (allocRmQty < rmNeeded) {
        if (classification === 'BLTH') {
          let avail = sup.internalAvailable.BLTH;
          if (allowedExt) avail += sup.externalAvailable.BLTH;
          if (avail > 0) {
              const rmToUse = Math.min(avail, rmNeeded - allocRmQty);
              allocRmQty += deductRM(sup, 'BLTH', rmToUse, allowedExt).total;
          }
        }
        
        // Fallback to RM BL
        if (allocRmQty < rmNeeded) {
          let avail = sup.internalAvailable.BL;
          if (allowedExt) avail += sup.externalAvailable.BL;
          if (avail > 0) {
              const normalRmToUse = Math.min(avail, rmNeeded - allocRmQty);
              allocRmQty += deductRM(sup, 'BL', normalRmToUse, allowedExt).total;
          }
        }
      }
`;
code = code.replace(p5Old, p5New);

// Inject tracking state into Daily json
const trackerOld = `
        blBlockUsed: tracker.blBlockUsed,
        rmBreakdown: {
`;
const trackerNew = `
        blBlockUsed: tracker.blBlockUsed,
        internalRemaining: { ...sup.internalAvailable },
        externalRemaining: { ...sup.externalAvailable },
        rmBreakdown: {
`;
code = code.replace(trackerOld, trackerNew);

fs.writeFileSync(file, code, 'utf8');
console.log('Successfully refactored phases 3, 4, 5 in bl-logic.helper.ts');
