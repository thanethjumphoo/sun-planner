const fs = require('fs');
const file = 'c:/Users/PCSLHICT-THANETH/Documents/github/sun-planner/backend/src/bl-logic.helper.ts';
let code = fs.readFileSync(file, 'utf8');

// 1. Update SupplyMap Interface
code = code.replace(
  `    available: { BL: number, BLTH: number, BLDR: number };`,
  `    available: { BL: number, BLTH: number, BLDR: number };
    internalAvailable: { BL: number, BLTH: number, BLDR: number };
    externalAvailable: { BL: number, BLTH: number, BLDR: number };
    internalSizes: Record<string, number>;
    externalSizes: Record<string, number>;`
);

// 2. Parse internal and external in SupplyBreakdown
const parseRegex = /const blKg = Number\(blData\.qty \|\| blData\.kg \|\| blData\.quantity \|\| 0\);\s*const blThKg = Number\(blThData\.qty \|\| blThData\.kg \|\| blThData\.quantity \|\| 0\) \* 0\.75;\s*const blDrKg = Number\(blDrData\.qty \|\| blDrData\.kg \|\| blDrData\.quantity \|\| 0\) \* 0\.75;/g;
const parseReplacement = `
      const blKg = Number(blData.qty || blData.kg || blData.quantity || 0);
      const blThKg = Number(blThData.qty || blThData.kg || blThData.quantity || 0) * 0.75;
      const blDrKg = Number(blDrData.qty || blDrData.kg || blDrData.quantity || 0) * 0.75;
      
      const intBlKg = Number(blData.internalQty ?? blKg);
      const extBlKg = Number(blData.externalQty ?? 0);
      const intBlThKg = Number(blThData.internalQty ?? blThKg) * 0.75;
      const extBlThKg = Number(blThData.externalQty ?? 0) * 0.75;
      const intBlDrKg = Number(blDrData.internalQty ?? blDrKg) * 0.75;
      const extBlDrKg = Number(blDrData.externalQty ?? 0) * 0.75;
      
      const blRatioInt = blKg > 0 ? intBlKg / blKg : 1;
      const blRatioExt = blKg > 0 ? extBlKg / blKg : 0;
      const thRatioInt = blThKg > 0 ? intBlThKg / blThKg : 1;
      const thRatioExt = blThKg > 0 ? extBlThKg / blThKg : 0;
      const drRatioInt = blDrKg > 0 ? intBlDrKg / blDrKg : 1;
      const drRatioExt = blDrKg > 0 ? extBlDrKg / blDrKg : 0;
`;
code = code.replace(parseRegex, parseReplacement);

// 3. Set SupplyMap initial values
const setSupplyOld = `      supplyMap.set(dateStr, {
        totalBL: blKg,
        totalBLTH: blThKg,
        totalBLDR: blDrKg,
        blSizes: { ...blSizes },
        initialSizes: { ...blSizes },
        available: { BL: blKg, BLTH: blThKg, BLDR: blDrKg },
      });`;
const setSupplyNew = `
      const internalSizes: Record<string, number> = {};
      const externalSizes: Record<string, number> = {};
      Object.keys(blSizes).forEach(k => {
          if (k.includes('TH')) {
              internalSizes[k] = blSizes[k] * thRatioInt;
              externalSizes[k] = blSizes[k] * thRatioExt;
          } else if (k.includes('DR')) {
              internalSizes[k] = blSizes[k] * drRatioInt;
              externalSizes[k] = blSizes[k] * drRatioExt;
          } else {
              internalSizes[k] = blSizes[k] * blRatioInt;
              externalSizes[k] = blSizes[k] * blRatioExt;
          }
      });
      supplyMap.set(dateStr, {
        totalBL: blKg,
        totalBLTH: blThKg,
        totalBLDR: blDrKg,
        blSizes: { ...blSizes },
        initialSizes: { ...blSizes },
        available: { BL: blKg, BLTH: blThKg, BLDR: blDrKg },
        internalAvailable: { BL: intBlKg, BLTH: intBlThKg, BLDR: intBlDrKg },
        externalAvailable: { BL: extBlKg, BLTH: extBlThKg, BLDR: extBlDrKg },
        internalSizes,
        externalSizes
      });`;
code = code.replace(setSupplyOld, setSupplyNew);

// 4. Inject a deduction helper in Phase 1 start
const deductionHelper = `
  // ──────────────────────────────────────
  // Helper for tracking Internal/External Deduction
  // ──────────────────────────────────────
  const deductRM = (sup: any, rmType: 'BL' | 'BLTH' | 'BLDR', qty: number, isExternalAllowed: boolean, sizeKey?: string) => {
    let toDeduct = qty;
    let extDeducted = 0;
    let intDeducted = 0;

    // Phase A: Try External First (if allowed)
    if (isExternalAllowed && toDeduct > 0) {
      let availExt = sup.externalAvailable[rmType];
      if (sizeKey) {
        availExt = Math.min(availExt, sup.externalSizes[sizeKey] || 0);
      }
      const deduct = Math.min(availExt, toDeduct);
      if (deduct > 0) {
        sup.externalAvailable[rmType] -= deduct;
        if (sizeKey) sup.externalSizes[sizeKey] -= deduct;
        extDeducted += deduct;
        toDeduct -= deduct;
      }
    }

    // Phase B: Try Internal
    if (toDeduct > 0) {
      let availInt = sup.internalAvailable[rmType];
      if (sizeKey) {
        availInt = Math.min(availInt, sup.internalSizes[sizeKey] || 0);
      }
      const deduct = Math.min(availInt, toDeduct);
      if (deduct > 0) {
        sup.internalAvailable[rmType] -= deduct;
        if (sizeKey) sup.internalSizes[sizeKey] -= deduct;
        intDeducted += deduct;
        toDeduct -= deduct;
      }
    }

    // Fallback sync total aggregate
    const totalDeducted = extDeducted + intDeducted;
    sup.available[rmType] -= totalDeducted;
    if (sizeKey) sup.blSizes[sizeKey] -= totalDeducted;

    return totalDeducted;
  };
`;
code = code.replace(`  // ══════════════════════════════════════\n  // Phase 1: Belt Gate SIZING`, deductionHelper + `\n  // ══════════════════════════════════════\n  // Phase 1: Belt Gate SIZING`);

// 5. Replace Allocations in Phase 1
const p1Old = `
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
        }`;
const p1New = `
        const rmType = descUpper.includes('TH') ? 'BLTH' : 'BL';
        const allowedExt = !!(spec as any)?.isExternalRmAllowed;
        
        let availTargetSize = sup.internalSizes[targetSize] || 0;
        if (allowedExt) availTargetSize += (sup.externalSizes[targetSize] || 0);

        if (availTargetSize > 0) {
          const normalRmToUse = Math.min(availTargetSize, rmNeeded - allocRmQty);
          const actualDeducted = deductRM(sup, rmType, normalRmToUse, allowedExt, targetSize);
          allocRmQty += actualDeducted;
        }`;
code = code.replace(p1Old, p1New);

// 6. Replace Allocations in Phase 2
const p2Old = `
      if (descUpper.includes('TH')) {
        const avail = sup.available.BLTH;
        if (avail > 0) {
          allocRmQty = Math.min(avail, rmNeeded);
          sup.available.BLTH -= allocRmQty;
        }
      } else if (descUpper.includes('DR')) {
        const avail = sup.available.BLDR;
        if (avail > 0) {
          allocRmQty = Math.min(avail, rmNeeded);
          sup.available.BLDR -= allocRmQty;
        }
      }`;
const p2New = `
      const allowedExt = !!(spec as any)?.isExternalRmAllowed;
      if (descUpper.includes('TH')) {
        let avail = sup.internalAvailable.BLTH;
        if (allowedExt) avail += sup.externalAvailable.BLTH;
        if (avail > 0) {
          allocRmQty = Math.min(avail, rmNeeded);
          allocRmQty = deductRM(sup, 'BLTH', allocRmQty, allowedExt);
        }
      } else if (descUpper.includes('DR')) {
        let avail = sup.internalAvailable.BLDR;
        if (allowedExt) avail += sup.externalAvailable.BLDR;
        if (avail > 0) {
          allocRmQty = Math.min(avail, rmNeeded);
          allocRmQty = deductRM(sup, 'BLDR', allocRmQty, allowedExt);
        }
      }`;
code = code.replace(p2Old, p2New);

fs.writeFileSync(file, code, 'utf8');
console.log('Successfully refactored phases 1 & 2 in bl-logic.helper.ts');
