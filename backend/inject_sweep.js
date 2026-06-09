const fs = require('fs');

let content = fs.readFileSync('backend/src/unified-leg-logic.helper.ts', 'utf8');

const target1 = `    if (remainingQty > 0) {
      exceptionsToSave.push(manager.create(MpsExceptionReport, {
        mpsPlan: plan,
        erpOrderLineId: order.erpOrderLineId,
        soNumber: headerMap.get(order.erpOrderHeaderId)?.erpOrderNumber || '-',
        itemCode: order.erpOrderItemCode,
        shipDate: shipDate,
        requiredKg: Number(order.erpOrderItemQty || 0),
        shortageKg: remainingQty,
        reason: 'Shared Leg RM supply is insufficient',
      }));
    }
  }`;

const replace1 = `    if (remainingQty > 0) {
      if ((spec as any)?.productType === 'FREEZE' && blItemCodes.includes(order.erpOrderItemCode)) {
         unfulfilledMainOrders.push({ order, spec, itemDesc, remainingQty, shipDate, isBil, isBl, rmYieldPct });
      } else {
         exceptionsToSave.push(manager.create(MpsExceptionReport, {
           mpsPlan: plan,
           erpOrderLineId: order.erpOrderLineId,
           soNumber: headerMap.get(order.erpOrderHeaderId)?.erpOrderNumber || '-',
           itemCode: order.erpOrderItemCode,
           shipDate: shipDate,
           requiredKg: Number(order.erpOrderItemQty || 0),
           shortageKg: remainingQty,
           reason: 'Shared Leg RM supply is insufficient',
         }));
      }
    }
  }

  // --- Forward Sweep Pass for Leftover RM (FREEZE BL Orders only) ---
  for (const item of unfulfilledMainOrders) {
    const { order, spec, itemDesc, shipDate, isBil, isBl, rmYieldPct } = item;
    let remainingQty = item.remainingQty;

    // Iterate chronologically over all dates before the ship date
    for (const dateStr of searchDates) {
       if (remainingQty <= 0) break;
       const prodDate = new Date(dateStr);
       // Must produce before or on ship date
       if (prodDate.getTime() > shipDate.getTime()) continue;

       const sup = supplyMap.get(dateStr);
       if (!sup || sup.totalLegRm <= 0) continue;

       let allocRmQty = 0;
       let productProduced = 0;

       if (isBl) {
          const classification = classifyOrder(order);
          const icutSpeed = Number((spec as any)?.icutSpeed || 0);
          const productYield = Number((spec as any)?.productYield || 0.75);
          const tracker = getTracker(dateStr);
          const capTracker = capacityTracker.get(dateStr) || { debonedKg: 0 };
          const maxDeboneAllowed = Math.max(0, DEBONE_CAPACITY_KG_PER_DAY - capTracker.debonedKg);
          const availRmForDebone = Math.min(sup.totalLegRm, maxDeboneAllowed);

          if (classification === 'BL_BLOCK') {
             const availBlock = sup.blSizes['TOTAL_BL_BLOCK'] || 0;
             const allocQty = Math.round(Math.min(availBlock, remainingQty));
             if (allocQty > 0) {
                sup.blSizes['TOTAL_BL_BLOCK'] -= allocQty;
                productProduced = allocQty;
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
             }
          } else if (classification === 'BLK' && icutSpeed === 0 && !extractBeltGateSizes(itemDesc, (spec as any)?.productSize)) {
             // Manual Trimming from BL BLOCK first, then RM
             const availBlock = sup.blSizes['TOTAL_BL_BLOCK'] || 0;
             let blockUsed = 0;
             if (availBlock > 0) {
                blockUsed = Math.min(availBlock, remainingQty);
                sup.blSizes['TOTAL_BL_BLOCK'] -= blockUsed;
                tracker.blBlockUsed += blockUsed;
                tracker.manualUsedKg += blockUsed;
                productProduced += blockUsed;
                let toDeduct = blockUsed;
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
             }
             
             const remainingToProduce = remainingQty - blockUsed;
             if (remainingToProduce > 0 && availRmForDebone > 0) {
                const rmNeeded = (remainingToProduce / productYield) / rmYieldPct;
                const rmToUse = Math.min(availRmForDebone, rmNeeded);
                sup.totalLegRm -= rmToUse;
                capTracker.debonedKg += rmToUse;
                tracker.manualUsedKg += rmToUse;
                
                const producedFromRm = Math.round((rmToUse * rmYieldPct) * productYield);
                productProduced += producedFromRm;
                generateByproducts(dateStr, rmToUse, spec);
             }
          } else if (icutSpeed > 0) {
             // I-Cut Process
             const icutHoursRemaining = MAX_ICUT_HOURS_PER_DAY - tracker.icutUsedHours;
             if (icutHoursRemaining > 0 && availRmForDebone > 0) {
                const rmNeeded = (remainingQty / mainYieldPct) / rmYieldPct;
                const maxKgAllowedByTime = icutHoursRemaining * icutSpeed;
                const rmToUse = Math.round(Math.min(availRmForDebone, rmNeeded, maxKgAllowedByTime));
                
                if (rmToUse > 0) {
                   sup.totalLegRm -= rmToUse;
                   capTracker.debonedKg += rmToUse;
                   
                   const produced = Math.round((rmToUse * rmYieldPct) * mainYieldPct);
                   const blockProduced = (rmToUse * rmYieldPct) - produced;
                   
                   sup.blSizes['TOTAL_BL_BLOCK'] = (sup.blSizes['TOTAL_BL_BLOCK'] || 0) + blockProduced;
                   tracker.blBlockProduced += blockProduced;
                   
                   const specSize = (spec as any)?.productSize || '';
                   let blockKey = 'BL_BLOCK_UNSIZED';
                   const m = specSize.match(/(\\d+)\\s*-\\s*(\\d+)/);
                   if (m) {
                     blockKey = \`BL_BLOCK_\${m[1]}_\${m[2]}\`;
                   }
                   sup.blSizes[blockKey] = (sup.blSizes[blockKey] || 0) + blockProduced;

                   const hoursUsed = rmToUse / icutSpeed;
                   tracker.icutUsedKg += rmToUse;
                   tracker.icutUsedHours += hoursUsed;
                   
                   productProduced = produced;
                   generateByproducts(dateStr, rmToUse, spec);
                }
             }
          } else {
             // Standard/Special/Sizing directly from RM
             const mapping = extractBeltGateSizes(itemDesc, (spec as any)?.productSize);
             let activeYield = productYield;
             if (mapping) {
               activeYield = mapping.yieldPct / 100;
             }

             const rmNeeded = (remainingQty / activeYield) / rmYieldPct;
             const rmToUse = Math.min(availRmForDebone, rmNeeded);
             if (rmToUse > 0) {
                sup.totalLegRm -= rmToUse;
                capTracker.debonedKg += rmToUse;
                
                productProduced = Math.round((rmToUse * rmYieldPct) * activeYield);
                generateByproducts(dateStr, rmToUse, spec);
                
                if (classification === 'BLK' && !mapping) {
                   tracker.manualUsedKg += rmToUse;
                }
             }
          }
          capacityTracker.set(dateStr, capTracker);
       }

       if (productProduced <= 0) continue;

       remainingQty -= productProduced;

       // Save Allocation
       mpsOrdersToSave.push(manager.create(MpsPlanOrder, {
         mpsPlan: plan,
         erpOrderLineId: order.erpOrderLineId,
         soNumber: headerMap.get(order.erpOrderHeaderId)?.erpOrderNumber || '-',
         itemCode: order.erpOrderItemCode,
         itemDesc: itemDesc,
         productType: (spec as any)?.productType || 'FREEZE',
         quantityKg: productProduced,
         shipDate: shipDate,
         plannedProductionDate: prodDate,
         finishedProductionDate: prodDate,
         isManualOverride: false,
       }));
    }

    if (remainingQty > 0) {
       exceptionsToSave.push(manager.create(MpsExceptionReport, {
         mpsPlan: plan,
         erpOrderLineId: order.erpOrderLineId,
         soNumber: headerMap.get(order.erpOrderHeaderId)?.erpOrderNumber || '-',
         itemCode: order.erpOrderItemCode,
         shipDate: shipDate,
         requiredKg: Number(order.erpOrderItemQty || 0),
         shortageKg: remainingQty,
         reason: 'Shared Leg RM supply is insufficient even after sweep pass',
       }));
    }
  }`;

content = content.replace(target1, replace1);

const target2 = `  const capacityTracker = new Map<string, { debonedKg: number }>();

  for (const order of mainOrders) {`;

const replace2 = `  const capacityTracker = new Map<string, { debonedKg: number }>();
  const unfulfilledMainOrders: any[] = [];

  for (const order of mainOrders) {`;

content = content.replace(target2, replace2);

fs.writeFileSync('backend/src/unified-leg-logic.helper.ts', content, 'utf8');
console.log('Sweep pass injected successfully.');
