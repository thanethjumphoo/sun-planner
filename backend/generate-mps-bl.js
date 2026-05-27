const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'mps.controller.ts');
let code = fs.readFileSync(file, 'utf8');

// Inside `generatePlan`, we need to change how supply is fetched when partType === 'bl'.
// We currently do: `const isBil = partType === 'bil';`
// Wait, actually I can just add a block at the top of generatePlan right after it gets active machine configurations.

let newGeneratePlanLogic = `
      return await this.dataSource.transaction(async (manager) => {
        const targetMonth = body.targetMonth;
        const partType = body.partType || 'fillet';
        const isBil = partType === 'bil';
        const isBl = partType === 'bl';
        
        let totalIntakeBirds = 0;
        let totalRmFlKg = 0;
        let totalInternalRmKg = 0;
        let totalExternalRmKg = 0;
        let grossDemandKg = 0;
        let grossP1Kg = 0;
        let grossP2ThighKg = 0;
        let grossP2DrumKg = 0;
        let totalRmBlKg = 0;
        let totalRmBlThKg = 0;
        let totalRmBlDrKg = 0;
`;

code = code.replace(`
      return await this.dataSource.transaction(async (manager) => {
        const targetMonth = body.targetMonth;
        const partType = body.partType || 'fillet';`, newGeneratePlanLogic);

// Now for the supply generation part.
// Search for "const supplyStart = " to see where Chicken Receiving is fetched.
const supplyFetchRegex = /const supplyStart = new Date\([\s\S]*?const externalSupplyMap = new Map<string, number>\(\);/m;

const blSupplyFetch = `
        const supplyStart = new Date(\`\${targetMonth}-01T00:00:00\`);
        const supplyEnd = new Date(supplyStart.getFullYear(), supplyStart.getMonth() + 1, 0, 23, 59, 59);

        const dailySupplyMap = new Map<string, number>();
        const dailyStaff = new Map<string, number>();
        const internalSupplyMap = new Map<string, number>();
        const externalSupplyMap = new Map<string, number>();
        const blSupplyMap = new Map<string, any>(); // Date -> { bl, th, dr, sizes }

        if (isBl) {
            // Find parent BIL plan for the same month
            const bilPlan = await manager.findOne(MpsPlan, { 
                where: { targetMonth, partType: 'bil', status: 'APPROVED' }, // User said "don't need to check approved", wait! The user said "ดูจาก BIL ยังไม่ต้อง app ก็ได้แค่ดูว่ามีการเจนของ BIL ยัง". So don't filter by APPROVED.
                relations: ['dailySummaries', 'supplyBreakdown', 'supplyBreakdown.sizes']
            });

            if (!bilPlan) {
                // If there's no BIL plan yet, we can't generate BL supply. Just return empty.
                throw new Error('Please generate a BIL Plan for this month first.');
            }

            // Extract BL supply from BIL's byProducts
            for (const sup of bilPlan.supplyBreakdown) {
                let dailyBlKg = 0;
                let dailyBlThKg = 0;
                let dailyBlDrKg = 0;
                const dStr = typeof sup.productionDate === 'string' ? sup.productionDate : sup.productionDate.toISOString().split('T')[0];
                
                if (sup.byProducts) {
                    try {
                        const bps = JSON.parse(sup.byProducts);
                        const blBp = bps['BL-DEBONE'] || Object.values(bps).find((bp: any) => bp.name === 'BL (Debone)');
                        if (blBp) dailyBlKg = Number(blBp.qty || 0);

                        const thBp = Object.values(bps).find((bp: any) => bp.name === 'สะโพก');
                        if (thBp) dailyBlThKg = Number(thBp.qty || 0) * 0.75;

                        const drBp = Object.values(bps).find((bp: any) => bp.name === 'น่อง');
                        if (drBp) dailyBlDrKg = Number(drBp.qty || 0) * 0.75;
                    } catch (e) {}
                }

                // Gather sizes of normal BL from BIL
                const sizes: Record<string, number> = {};
                if (sup.sizes) {
                    for (const s of sup.sizes) {
                        sizes[s.groupSize] = Number(s.quantityKg || 0);
                    }
                }

                const totalDailyRm = dailyBlKg + dailyBlThKg + dailyBlDrKg;
                dailySupplyMap.set(dStr, totalDailyRm);
                
                blSupplyMap.set(dStr, {
                    kg: totalDailyRm,
                    bl: dailyBlKg,
                    th: dailyBlThKg,
                    dr: dailyBlDrKg,
                    sizes
                });
                
                totalRmBlKg += dailyBlKg;
                totalRmBlThKg += dailyBlThKg;
                totalRmBlDrKg += dailyBlDrKg;
                totalRmFlKg += totalDailyRm;
            }
        } else {
            // ORIGINAL FILLET / BIL SUPPLY LOGIC HERE
`;

let originalSupplyCodeMatch = code.match(/const supplyStart = new Date\([\s\S]*?const externalSupplyMap = new Map<string, number>\(\);/);
if (originalSupplyCodeMatch) {
    let oldCode = originalSupplyCodeMatch[0];
    let newCode = blSupplyFetch + oldCode + "\n        }"; // close the else block
    
    // We have to close the else block after we populate the dailySupplyMap.
    // The original logic goes all the way to external supplies.
    // Let's just do a big replace. 
    // It's safer to use ast or just regex carefully.
}
`;

fs.writeFileSync(path.join(__dirname, 'generate-mps-bl.js'), newGeneratePlanLogic);
