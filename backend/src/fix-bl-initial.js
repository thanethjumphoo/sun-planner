const fs = require('fs');
const file = 'c:/Users/PCSLHICT-THANETH/Documents/github/sun-planner/backend/src/bl-logic.helper.ts';
let code = fs.readFileSync(file, 'utf8');

// 1. Add initial properties to supplyMap interface
const mapDefOld = `    internalAvailable: { BL: number, BLTH: number, BLDR: number };
    externalAvailable: { BL: number, BLTH: number, BLDR: number };`;
const mapDefNew = `    internalAvailable: { BL: number, BLTH: number, BLDR: number };
    externalAvailable: { BL: number, BLTH: number, BLDR: number };
    initialInternal: { BL: number, BLTH: number, BLDR: number };
    initialExternal: { BL: number, BLTH: number, BLDR: number };`;
code = code.replace(mapDefOld, mapDefNew);

// 2. Populate initial values
const setMapOld = `        available: { BL: blKg, BLTH: blThKg, BLDR: blDrKg },
        internalAvailable: { BL: intBlKg, BLTH: intBlThKg, BLDR: intBlDrKg },
        externalAvailable: { BL: extBlKg, BLTH: extBlThKg, BLDR: extBlDrKg },`;
const setMapNew = `        available: { BL: blKg, BLTH: blThKg, BLDR: blDrKg },
        internalAvailable: { BL: intBlKg, BLTH: intBlThKg, BLDR: intBlDrKg },
        externalAvailable: { BL: extBlKg, BLTH: extBlThKg, BLDR: extBlDrKg },
        initialInternal: { BL: intBlKg, BLTH: intBlThKg, BLDR: intBlDrKg },
        initialExternal: { BL: extBlKg, BLTH: extBlThKg, BLDR: extBlDrKg },`;
code = code.replace(setMapOld, setMapNew);

// 3. Fix Daily JSON saving
const dailyOld = `    dailyToSave.push(manager.create(MpsPlanDaily, {
      mpsPlan: plan,
      productionDate: new Date(dateStr),
      intakeBirds: 0,
      rmFlAvailKg: sup.totalBL + sup.totalBLTH + sup.totalBLDR,
      internalRmKg: sup.totalBL + sup.totalBLTH + sup.totalBLDR,
      externalRmKg: 0,
      demandKg: dayDemand,
      cuttingStaff: 0,
      supportStaff: 0,
      totalStaff: 0,
      blTrackerJson: JSON.stringify({
        icutUsedKg: tracker.icutUsedKg,
        icutUsedHours: tracker.icutUsedHours,
        icutCapacityHours: MAX_ICUT_HOURS_PER_DAY,
        manualUsedKg: tracker.manualUsedKg,
        blBlockProduced: tracker.blBlockProduced,
        blBlockUsed: tracker.blBlockUsed,
        internalRemaining: { ...sup.internalAvailable },
        externalRemaining: { ...sup.externalAvailable },`;
const dailyNew = `
    const initInt = sup.initialInternal;
    const initExt = sup.initialExternal;
    const totalInt = initInt.BL + initInt.BLTH + initInt.BLDR;
    const totalExt = initExt.BL + initExt.BLTH + initExt.BLDR;

    dailyToSave.push(manager.create(MpsPlanDaily, {
      mpsPlan: plan,
      productionDate: new Date(dateStr),
      intakeBirds: 0,
      rmFlAvailKg: sup.totalBL + sup.totalBLTH + sup.totalBLDR,
      internalRmKg: totalInt,
      externalRmKg: totalExt,
      demandKg: dayDemand,
      cuttingStaff: 0,
      supportStaff: 0,
      totalStaff: 0,
      blTrackerJson: JSON.stringify({
        icutUsedKg: tracker.icutUsedKg,
        icutUsedHours: tracker.icutUsedHours,
        icutCapacityHours: MAX_ICUT_HOURS_PER_DAY,
        manualUsedKg: tracker.manualUsedKg,
        blBlockProduced: tracker.blBlockProduced,
        blBlockUsed: tracker.blBlockUsed,
        internalRemaining: { ...sup.initialInternal },
        externalRemaining: { ...sup.initialExternal },`;
code = code.replace(dailyOld, dailyNew);

fs.writeFileSync(file, code, 'utf8');
console.log('Fixed initial values in bl-logic.helper.ts');
