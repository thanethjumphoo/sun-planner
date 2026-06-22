const fs = require('fs');

function applyFixes() {
  const unifiedFile = 'src/unified-leg-logic.helper.ts';
  const blFile = 'src/bl-logic.helper.ts';
  
  let unifiedContent = fs.readFileSync(unifiedFile, 'utf8');
  let blContent = fs.readFileSync(blFile, 'utf8');

  // 1. Fix extractBeltGateSizes in BOTH files
  const extractReplacement = `  const extractBeltGateSizes = (itemDesc: string, productSize: string) => {
    if (productSize && productSize.toLowerCase() !== 'unsize' && productSize.trim() !== '') {
      let s = productSize.toLowerCase().replace('g', '').trim();
      
      if (s.includes('down')) {
        const val = parseInt(s.replace(/[^\\d]/g, ''), 10);
        return { rmSizes: [\`BL \${val} Down\`], targetProduct: \`Fallback (\${productSize})\`, yieldPct: 100 };
      }
      if (s.includes('up')) {
        const val = parseInt(s.replace(/[^\\d]/g, ''), 10);
        return { rmSizes: [\`BL \${val} Up\`], targetProduct: \`Fallback (\${productSize})\`, yieldPct: 100 };
      }

      if (s.match(/\\d+/)) {
        const allBinDefs = [
          { key: 'BL 140 Down', lo: 0, hi: 140 },
          { key: 'BL 141-160', lo: 141, hi: 160 },
          { key: 'BL 161-180', lo: 161, hi: 180 },
          { key: 'BL 181-200', lo: 181, hi: 200 },
          { key: 'BL 201-220', lo: 201, hi: 220 },
          { key: 'BL 221-240', lo: 221, hi: 240 },
          { key: 'BL 241-260', lo: 241, hi: 260 },
          { key: 'BL 261-280', lo: 261, hi: 280 },
          { key: 'BL 281-300', lo: 281, hi: 300 },
          { key: 'BL 301-320', lo: 301, hi: 320 },
          { key: 'BL 321-340', lo: 321, hi: 340 },
          { key: 'BL 341-360', lo: 341, hi: 360 },
          { key: 'BL 361-380', lo: 361, hi: 380 },
          { key: 'BL 381 Up', lo: 381, hi: 9999 }
        ];
        
        let lo = -1, hi = -1;
        const m = s.match(/(\\d+)\\s*[-–]\\s*(\\d+)/);
        if (m) { lo = parseInt(m[1], 10); hi = parseInt(m[2], 10); }
        else {
          const singleMatch = s.match(/^(\\d+)$/);
          if (singleMatch) { lo = parseInt(singleMatch[1], 10); hi = parseInt(singleMatch[1], 10); }
        }

        if (lo >= 0 && hi >= 0 && hi >= lo) {
          const overlaps = allBinDefs.filter(b => {
            if (lo === hi) return lo >= b.lo && hi <= b.hi;
            return Math.max(lo, b.lo) < Math.min(hi, b.hi);
          });
          if (overlaps.length > 0) {
            return { rmSizes: overlaps.map(b => b.key), targetProduct: \`Fallback (\${productSize})\`, yieldPct: 100 };
          }
        }
      }
    }
    
    return null;
  };`;

  let patternUnified = /  const extractBeltGateSizes = \(itemDesc: string, productSize: string\) => \{[\s\S]*?return null;\r?\n  \};/;
  if (!patternUnified.test(unifiedContent)) {
     patternUnified = /  const extractBeltGateSizes = \(desc: string, specSize\?: string\): \{ rmSizes: string\[\], targetProduct: string, yieldPct: number \} \| null => \{[\s\S]*?return null;\r?\n  \};/;
  }
  unifiedContent = unifiedContent.replace(patternUnified, extractReplacement);

  let patternBl = /  const extractBeltGateSizes = \(itemDesc: string, productSize: string\) => \{[\s\S]*?return null;\r?\n  \};/;
  if (!patternBl.test(blContent)) {
     patternBl = /  const extractBeltGateSizes = \(desc: string, specSize\?: string\): \{ rmSizes: string\[\], targetProduct: string, yieldPct: number \} \| null => \{[\s\S]*?return null;\r?\n  \};/;
  }
  blContent = blContent.replace(patternBl, extractReplacement);

  // 2. Fix MANUAL_TRIM in unified-leg-logic.helper.ts
  const manualTrimReplacement = `           if (classification === 'BL_BLOCK') {
              const mapping = extractBeltGateSizes(itemDesc.toUpperCase(), (spec as any)?.productSize);
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
              const mappingBlock = extractBeltGateSizes(itemDesc.toUpperCase(), (spec as any)?.productSize);
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
              }`;

  const manualTrimPattern = /           if \(classification === 'BL_BLOCK'\) \{[\s\S]*?generateByproducts\(dateStr, rmToUse, spec\);\r?\n              \}/g;
  
  let matchCount = 0;
  unifiedContent = unifiedContent.replace(manualTrimPattern, (match) => {
    matchCount++;
    return manualTrimReplacement;
  });

  fs.writeFileSync(unifiedFile, unifiedContent);
  fs.writeFileSync(blFile, blContent);

  console.log('Fixed extracts. Manual trim replacements: ' + matchCount);
}

applyFixes();
