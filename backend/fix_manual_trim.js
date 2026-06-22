const fs = require('fs');
const file = 'src/unified-leg-logic.helper.ts';
let content = fs.readFileSync(file, 'utf8');

const replacement = `           if (classification === 'BL_BLOCK') {
              const mapping = extractBeltGateSizes((spec as any)?.productSize);
              let availBlock = sup.blSizes['TOTAL_BL_BLOCK'] || 0;
              const blockKeysUsed: string[] = [];
              if (mapping && mapping.rmSizes.length > 0) {
                availBlock = 0;
                for (const sz of mapping.rmSizes) {
                  const bk = sz.replace(/^BL\\s*/i, 'BL_BLOCK_').replace('-', '_');
                  availBlock += (sup.blSizes[bk] || 0);
                  blockKeysUsed.push(bk);
                }
                availBlock = Math.min(availBlock, sup.blSizes['TOTAL_BL_BLOCK'] || 0);
              }
              const allocQty = Math.round(Math.min(availBlock, remainingQty));
              if (allocQty > 0) {
                 sup.blSizes['TOTAL_BL_BLOCK'] -= allocQty;
                 productProduced = allocQty;
                 let toDeduct = allocQty;
                 if (blockKeysUsed.length > 0) {
                   for (const bk of blockKeysUsed) {
                     if (toDeduct <= 0) break;
                     const availSz = sup.blSizes[bk] || 0;
                     if (availSz > 0) {
                       const use = Math.min(availSz, toDeduct);
                       sup.blSizes[bk] -= use;
                       toDeduct -= use;
                     }
                   }
                 } else {
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
              }
           } else if (classification === 'MANUAL_TRIM') {
              // Manual Trimming from BL BLOCK first, then RM
              const mappingBlock = extractBeltGateSizes((spec as any)?.productSize);
              let availBlock = sup.blSizes['TOTAL_BL_BLOCK'] || 0;
              const blockKeysUsed: string[] = [];
              if (mappingBlock && mappingBlock.rmSizes.length > 0) {
                availBlock = 0;
                for (const sz of mappingBlock.rmSizes) {
                  const bk = sz.replace(/^BL\\s*/i, 'BL_BLOCK_').replace('-', '_');
                  availBlock += (sup.blSizes[bk] || 0);
                  blockKeysUsed.push(bk);
                }
                availBlock = Math.min(availBlock, sup.blSizes['TOTAL_BL_BLOCK'] || 0);
              }
              let blockUsed = 0;
              if (availBlock > 0) {
                 blockUsed = Math.min(availBlock, remainingQty);
                 sup.blSizes['TOTAL_BL_BLOCK'] -= blockUsed;
                 tracker.blBlockUsed += blockUsed;
                 tracker.manualUsedKg += blockUsed;
                 productProduced += blockUsed;
                 let toDeduct = blockUsed;
                 if (blockKeysUsed.length > 0) {
                   for (const bk of blockKeysUsed) {
                     if (toDeduct <= 0) break;
                     const availSz = sup.blSizes[bk] || 0;
                     if (availSz > 0) {
                       const use = Math.min(availSz, toDeduct);
                       sup.blSizes[bk] -= use;
                       toDeduct -= use;
                     }
                   }
                 } else {
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
              }
              
              const remainingToProduce = remainingQty - blockUsed;
              if (remainingToProduce > 0 && availRmForDebone > 0) {
                 let maxRmFromSizes = availRmForDebone;
                 const legKeysUsed: string[] = [];
                 if (mappingBlock && mappingBlock.rmSizes.length > 0) {
                   maxRmFromSizes = 0;
                   for (const sz of mappingBlock.rmSizes) {
                     const legKey = sz.replace(/^BL\\s*/i, '');
                     maxRmFromSizes += (sup.legSizes[legKey] || 0);
                     legKeysUsed.push(legKey);
                   }
                 }
                 
                 const rmNeeded = (remainingToProduce / productYield) / rmYieldPct;
                 const rmToUse = Math.round(Math.min(availRmForDebone, rmNeeded, maxRmFromSizes));
                 if (rmToUse > 0) {
                    sup.totalLegRm -= rmToUse;
                    sup.rmBlUsed += rmToUse;
                    capTracker.debonedKg += rmToUse;
                    tracker.manualUsedKg += (rmToUse * rmYieldPct);
                    
                    let toDeduct = rmToUse;
                    if (legKeysUsed.length > 0) {
                       for (const lk of legKeysUsed) {
                          if (toDeduct <= 0) break;
                          const availSz = sup.legSizes[lk] || 0;
                          if (availSz > 0) {
                             const use = Math.min(availSz, toDeduct);
                             sup.legSizes[lk] -= use;
                             toDeduct -= use;
                          }
                       }
                    } else {
                       for (const lk of Object.keys(sup.legSizes)) {
                          const availSz = sup.legSizes[lk];
                          if (availSz > 0 && toDeduct > 0) {
                             const use = Math.min(availSz, toDeduct);
                             sup.legSizes[lk] -= use;
                             toDeduct -= use;
                          }
                       }
                    }
                    
                    const producedFromRm = Math.round((rmToUse * rmYieldPct) * productYield);
                    productProduced += producedFromRm;
                    generateByproducts(dateStr, rmToUse, spec);
                 }
              }
           }`;

const targetPattern1 = /           if \(classification === 'BL_BLOCK'\) \{[\s\S]*?generateByproducts\(dateStr, rmToUse, spec\);\s*\}\s*\}/;

let count = 0;
content = content.replace(targetPattern1, () => { count++; return replacement; });
content = content.replace(targetPattern1, () => { count++; return replacement; });

if (count === 2) {
   fs.writeFileSync(file, content);
   console.log('Successfully replaced 2 instances.');
} else {
   console.log('Failed to replace 2 instances. Found ' + count);
}
