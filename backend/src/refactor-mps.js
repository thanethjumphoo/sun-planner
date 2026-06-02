const fs = require('fs');
const file = 'c:/Users/PCSLHICT-THANETH/Documents/github/sun-planner/backend/src/mps.controller.ts';
let code = fs.readFileSync(file, 'utf8');

// 1. Add tracking maps
const trackingInit = `
    const supplyMap = new Map<string, number>();
    const internalSupplyMap = new Map<string, number>();
    const externalSupplyMap = new Map<string, number>();
    const internalRemainingMap = new Map<string, number>();
    const externalRemainingMap = new Map<string, number>();
`;
code = code.replace(
  `    const supplyMap = new Map<string, number>();\n    const internalSupplyMap = new Map<string, number>();\n    const externalSupplyMap = new Map<string, number>();`,
  trackingInit
);

// 2. Initialize remaining maps
const mapInit1 = `
        internalSupplyMap.set(d, (internalSupplyMap.get(d) || 0) + rmAvailKg);
        internalRemainingMap.set(d, (internalRemainingMap.get(d) || 0) + rmAvailKg);
        supplyMap.set(d, (supplyMap.get(d) || 0) + rmAvailKg);
`;
code = code.replace(
  `        internalSupplyMap.set(d, (internalSupplyMap.get(d) || 0) + rmAvailKg);\n        supplyMap.set(d, (supplyMap.get(d) || 0) + rmAvailKg);`,
  mapInit1
);

const mapInit2 = `
          externalSupplyMap.set(d, (externalSupplyMap.get(d) || 0) + extKg);
          externalRemainingMap.set(d, (externalRemainingMap.get(d) || 0) + extKg);
          supplyMap.set(d, (supplyMap.get(d) || 0) + extKg);
`;
code = code.replace(
  `          externalSupplyMap.set(d, (externalSupplyMap.get(d) || 0) + extKg);\n          supplyMap.set(d, (supplyMap.get(d) || 0) + extKg);`,
  mapInit2
);

// 3. Update generateByproducts to accept internalRm / externalRm
const generateByproductsOld = `const generateByproducts = (dateStr: string, rmQty: number, spec: any) => {`;
const generateByproductsNew = `const generateByproducts = (dateStr: string, rmQty: number, spec: any, internalRm: number, externalRm: number) => {`;
code = code.replace(generateByproductsOld, generateByproductsNew);

// 4. In generateByproducts, add internal and external breakdown to the JSON
const byProdUpdateOld = `
          daySupply[child.partName] = {
            name: child.partName,
            processName: processName,
            qty: (daySupply[child.partName]?.qty || 0) + byprodKg,
            sizes: daySupply[child.partName]?.sizes || {}
          };
`;
const byProdUpdateNew = `
          daySupply[child.partName] = {
            name: child.partName,
            processName: processName,
            qty: (daySupply[child.partName]?.qty || 0) + byprodKg,
            internalQty: (daySupply[child.partName]?.internalQty || 0) + (internalRm * (child.yieldPercentage || 0)),
            externalQty: (daySupply[child.partName]?.externalQty || 0) + (externalRm * (child.yieldPercentage || 0)),
            sizes: daySupply[child.partName]?.sizes || {}
          };
`;
code = code.replace(byProdUpdateOld, byProdUpdateNew);

// 5. Replace `generateByproducts(dateStr, rm, spec);` with the new one. But we need to calculate internal/external used.
// We have 4 places where generateByproducts is called. I will use regex.
const allocBlockRegex = /const yieldPct = spec\?\.productYield \|\| 1;\s*const rm = allocQty \/ yieldPct;\s*generateByproducts\(dateStr, rm, spec\);/g;

const allocBlockReplacement = `
        const yieldPct = spec?.productYield || 1;
        const rm = allocQty / yieldPct;
        
        let extUsed = 0;
        let intUsed = 0;
        if (spec?.isExternalRmAllowed) {
            const availExt = externalRemainingMap.get(dateStr) || 0;
            extUsed = Math.min(availExt, rm);
            intUsed = rm - extUsed;
        } else {
            intUsed = rm;
        }
        externalRemainingMap.set(dateStr, Math.max(0, (externalRemainingMap.get(dateStr) || 0) - extUsed));
        internalRemainingMap.set(dateStr, Math.max(0, (internalRemainingMap.get(dateStr) || 0) - intUsed));

        generateByproducts(dateStr, rm, spec, intUsed, extUsed);
`;
code = code.replace(allocBlockRegex, allocBlockReplacement);

fs.writeFileSync(file, code, 'utf8');
console.log('Successfully refactored mps.controller.ts');
