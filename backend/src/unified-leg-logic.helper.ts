import { EntityManager, Repository, Between } from 'typeorm';
import { MpsPlan, MpsPlanDaily, MpsPlanOrder } from './mps-plan.entity';
import { MpsPlanSupply } from './mps-plan-supply.entity';
import { MpsPlanSupplySize } from './mps-plan-supply-size.entity';
import { MpsExceptionReport } from './mps-exception.entity';
import { StgErpOrderLine } from './stg-erp-order-line.entity';
import { StgErpOrderHeader } from './stg-erp-order-header.entity';
import { ICutMaster } from './icut-master.entity';
import { BlBeltGateMatrix } from './bl-belt-gate-matrix.entity';
import { ExternalRmSupply } from './external-rm-supply.entity';

// --- Shared Types & Dependencies ---
interface UnifiedLegDependencies {
  machineConfigs: any[];
  getItemCodesByPartType: (pt: string) => Promise<string[] | null>;
  parseLocalDate: (val: any) => string;
  formatDate: (val: any) => string;
  specRepo: Repository<any>; 
  masterYieldRepo: any;
  bilWeightDistRepo: any; // For calculating Leg RM sizes from Intake
  chickenReceivingService: any; // To fetch allIntakes
}

export async function executeUnifiedLegPlanGeneration(
  body: any,
  manager: EntityManager,
  deps: UnifiedLegDependencies,
) {
  const { targetMonth, orderStartDate, orderEndDate } = body;
  const { parseLocalDate, formatDate } = deps;

  // 1. Validate / Reset Plan
  // Note: We might create a single "LEG" plan, or sync back to two separate plans (BIL & BL) later.
  // For now, let's assume we manage a combined plan named "LEG".
  const existingApproved = await manager.findOne(MpsPlan, { where: { targetMonth, partType: 'leg', status: 'APPROVED' } });
  if (existingApproved) {
    return { success: false, message: `มีแผน LEG ที่ APPROVED แล้วสำหรับเดือน ${targetMonth} ต้อง Reject ก่อนถึงจะสร้างใหม่ได้` };
  }

  let plan = await manager.findOne(MpsPlan, { where: { targetMonth, partType: 'leg', status: 'DRAFT' } });
  if (plan) {
    await manager.delete(MpsPlanDaily, { mpsPlan: { id: plan.id } });
    await manager.delete(MpsPlanSupply, { mpsPlan: { id: plan.id } });
    await manager.delete(MpsPlanOrder, { mpsPlan: { id: plan.id } });
    await manager.delete(MpsExceptionReport, { mpsPlan: { id: plan.id } });
  } else {
    plan = manager.create(MpsPlan, {
      planName: `MPS ${targetMonth} - Unified BIL / BL Draft`,
      targetMonth,
      partType: 'leg', // A new unified partType
      status: 'DRAFT',
      createdBy: 'SYSTEM',
    });
    await manager.save(plan);
  }

  // 2. Build Shared Leg RM Pool from Intake
  const supplyMap = new Map<string, {
    internalLegRm: number;
    externalLegRm: number;
    totalLegRm: number;
    legSizes: Record<string, number>;
    blSizes: Record<string, number>;
    intakeBirds: number;
    totalWeight: number;
  }>();
  
  // Fetch specs early to determine cross-month buffer
  const allSpecs = await deps.specRepo.find();
  let maxLeadForBuffer = 90;
  for (const s of allSpecs) {
    if (s.maxProductLead && Number(s.maxProductLead) > maxLeadForBuffer) {
      maxLeadForBuffer = Number(s.maxProductLead);
    }
  }

  // Get days in month and set up cross-month date range
  const [year, month] = targetMonth.split('-').map(Number);
  const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);
  
  const supplyBufferStart = new Date(startOfMonth.getTime());
  supplyBufferStart.setDate(supplyBufferStart.getDate() - maxLeadForBuffer);

  const allDateStrs: string[] = [];
  for (let d = new Date(supplyBufferStart); d <= endOfMonth; d.setDate(d.getDate() + 1)) {
    allDateStrs.push(deps.formatDate(d));
  }
  
  // Fetch intakes
  const allIntakes = await deps.chickenReceivingService.findAll('monthly');
  const weightMatrix = await deps.bilWeightDistRepo.find();
  
  // Fetch Master Yield for Leg
  const bilNode = await deps.masterYieldRepo.findOne({ where: { type: 'CATEGORY', name: 'BIL L/C' } });
  const legYieldPct = bilNode?.yieldPercentage ? Number(bilNode.yieldPercentage) : 0.25;

  for (const dayStr of allDateStrs) {
    let dailyIntakeBirds = 0;
    let dailyTotalWeight = 0;
    const dayIntakes: any[] = [];

    allIntakes.forEach((intake: any) => {
      const d = parseLocalDate(intake.receive_date);
      if (d === dayStr) {
        dailyIntakeBirds += Number(intake.chicken_count || 0);
        dailyTotalWeight += Number(intake.chicken_weight || 0);
        dayIntakes.push(intake);
      }
    });

    if (dailyIntakeBirds > 0) {
      let dailyLegRm = 0;
      const sizeBins: Record<string, number> = {};

      dayIntakes.forEach((intake: any) => {
        const intakeKg = Number(intake.chicken_weight || 0);
        const intakeBirds = Number(intake.chicken_count || 0);
        if (intakeBirds <= 0 || intakeKg <= 0) return;

        const avgWeight = parseFloat((intakeKg / intakeBirds).toFixed(2));
        const slaughteredWeight = intakeKg * 0.9575 * 0.95;
        const legWeightForIntake = slaughteredWeight * legYieldPct;

        dailyLegRm += legWeightForIntake;

        const matchingRows = weightMatrix.filter((row: any) => {
          const label = row.rowLabel;
          if (label.includes('-')) {
            const parts = label.split('-').map((s: string) => parseFloat(s.trim()));
            return avgWeight >= parts[0] && avgWeight <= parts[1];
          }
          return Math.abs(Number(label) - avgWeight) < 0.05;
        });

        matchingRows.forEach((row: any) => {
          const pct = Number(row.distValue || 0);
          if (pct <= 0) return;
          const kg = Math.round(legWeightForIntake * pct);
          if (row.colLabel) {
            sizeBins[row.colLabel] = (sizeBins[row.colLabel] || 0) + kg;
          }
        });
      });

      supplyMap.set(dayStr, {
        internalLegRm: Math.round(dailyLegRm),
        externalLegRm: 0,
        totalLegRm: Math.round(dailyLegRm),
        legSizes: sizeBins,
        blSizes: { 'TOTAL_BL_BLOCK': 0 },
        intakeBirds: dailyIntakeBirds,
        totalWeight: dailyTotalWeight,
      });
    }
  }

  // --- Fetch External RM Supply ---
  const allExternalRms = await manager.find(ExternalRmSupply, { where: { partName: 'BIL L/C' }});
  allExternalRms.forEach((ext: any) => {
    const d = deps.parseLocalDate(ext.receivedDate);
    if (d && supplyMap.has(d)) {
      const extKg = Number(ext.totalWeightKg || 0);
      const sup = supplyMap.get(d)!;
      sup.externalLegRm += extKg;
      sup.totalLegRm += extKg;
    }
  });

  // 3. Fetch Orders for BOTH BIL and BL
  const specMap = new Map(allSpecs.map((s: any) => [s.erpItemCode, s]));

  const bilItemCodes = await deps.getItemCodesByPartType('bil') || [];
  const blItemCodes = await deps.getItemCodesByPartType('bl') || [];
  const combinedItemCodes = [...new Set([...bilItemCodes, ...blItemCodes])];

  const icutMaster = await manager.getRepository(ICutMaster).findOne({ where: { isActive: true } });
  const coproductYieldPct = Number((icutMaster as any)?.coproductYieldPct ?? 0.20);
  const mainYieldPct = 1.0 - coproductYieldPct;

  const blBeltGateMatrix = await manager.getRepository(BlBeltGateMatrix).find();

  // --- Load Machine Configs for dynamic Debone Capacity ---
  const getMachineConfig = (key: string, defaults: any) => {
    const conf = deps.machineConfigs.find(c => c.machineKey === key);
    if (!conf) return defaults;
    return {
      speed: Number(conf.capacityPcsPerHour),
      yield: Number(conf.yieldPercentage),
      lines: Number(conf.defaultLines),
      machinesPerLine: Number(conf.machinesPerLine),
      workers: Number(conf.workersPerUnit),
    };
  };

  const toridasConf = getMachineConfig('toridas', { speed: 1500, yield: 0.75, lines: 3, machinesPerLine: 4, workers: 5 });
  const foodmateConf = getMachineConfig('foodmate', { speed: 6000, yield: 0.70, lines: 1, machinesPerLine: 1, workers: 5 });
  const HOURS_PER_SHIFT = 9.58;
  const SHIFTS_PER_DAY = 2;

  // Toridas pcs/day + Foodmate pcs/day
  const toridasPcsPerDay = toridasConf.lines * toridasConf.machinesPerLine * toridasConf.speed * HOURS_PER_SHIFT * SHIFTS_PER_DAY;
  const foodmatePcsPerDay = foodmateConf.lines * foodmateConf.machinesPerLine * foodmateConf.speed * HOURS_PER_SHIFT * SHIFTS_PER_DAY;

  // Need avgPieceWeight to convert pcs → Kg. Use supplyMap to estimate.
  // Average leg piece weight = totalWeight / intakeBirds * 2 (2 legs per bird) * legYieldPct * slaughter yield
  // Simplified: just use the total RM available as the real capacity cap, 
  // and compute a reasonable Kg limit from machine configs.
  // Typical avg piece ~0.25 kg (250g per BL piece), so:
  const AVG_BL_PIECE_WEIGHT_KG = 0.25;
  const toridasKgPerDay = Math.round(toridasPcsPerDay * AVG_BL_PIECE_WEIGHT_KG * toridasConf.yield);
  const foodmateKgPerDay = Math.round(foodmatePcsPerDay * AVG_BL_PIECE_WEIGHT_KG * foodmateConf.yield);
  const DEBONE_CAPACITY_KG_PER_DAY = toridasKgPerDay + foodmateKgPerDay;

  console.log(`[Unified Leg] Debone capacity from MachineConfig: Toridas=${toridasKgPerDay}kg/day + Foodmate=${foodmateKgPerDay}kg/day => Total=${DEBONE_CAPACITY_KG_PER_DAY}kg/day`);

  const allYieldNodes = await deps.masterYieldRepo.find({
    relations: ['children', 'children.children', 'children.children.children']
  });

  const findNode = (nodes: any[], id: string): any => {
    for (const n of nodes) {
      if (n.id === id) return n;
      if (n.children) {
        const found = findNode(n.children, id);
        if (found) return found;
      }
    }
    return undefined;
  };

  const isByproductSpec = (spec: any): boolean => {
    if (!spec || !spec.masterYieldIds) return false;
    const ids = spec.masterYieldIds.split(',').map((id: string) => id.trim());
    return ids.some((id: string) => {
      const node = findNode(allYieldNodes, id);
      return node && (node.type === 'BY-PRODUCT');
    });
  };

  const byProductItemCodes = allSpecs.filter((s: any) => isByproductSpec(s)).map((s: any) => s.erpItemCode);
  const combinedWithByProductCodes = [...new Set([...combinedItemCodes, ...byProductItemCodes])];

  // Helper functions for BL detailed processing
  const extractBeltGateSizes = (desc: string, specSize?: string): { rmSizes: string[], targetProduct: string, yieldPct: number } | null => {
    for (const rule of blBeltGateMatrix as any[]) {
      if (desc.includes(rule.targetProduct)) {
        return { rmSizes: [rule.rmSize], targetProduct: rule.targetProduct, yieldPct: Number(rule.yieldPct || 100) };
      }
    }
    
    let sToUse = specSize;
    if (!sToUse || sToUse.toLowerCase() === 'unsize' || sToUse.trim() === '') {
      const descMatch = desc.match(/(\d+)\s*[-–]\s*(\d+)/);
      if (descMatch) {
        sToUse = descMatch[0];
      } else {
        const descSingle = desc.match(/\b(\d{2,4})\s*(g|กรัม|g\.|gram)\b/i);
        if (descSingle) sToUse = descSingle[1];
      }
    }

    if (sToUse && sToUse.toLowerCase() !== 'unsize' && sToUse.trim() !== '') {
      const s = sToUse.toLowerCase().trim();
      const allBinDefs = [
        { key: 'BL 140 Down', lo: 0, hi: 140 },
        { key: 'BL 140-160', lo: 140, hi: 160 },
        { key: 'BL 160-180', lo: 160, hi: 180 },
        { key: 'BL 180-200', lo: 180, hi: 200 },
        { key: 'BL 200-220', lo: 200, hi: 220 },
        { key: 'BL 220-240', lo: 220, hi: 240 },
        { key: 'BL 240-260', lo: 240, hi: 260 },
        { key: 'BL 260-280', lo: 260, hi: 280 },
        { key: 'BL 280-300', lo: 280, hi: 300 },
        { key: 'BL 300-320', lo: 300, hi: 320 },
        { key: 'BL 320-340', lo: 320, hi: 340 },
        { key: 'BL 340-360', lo: 340, hi: 360 },
        { key: 'BL 360-380', lo: 360, hi: 380 },
        { key: 'BL 380 Up', lo: 380, hi: 9999 }
      ];
      
      let lo = -1, hi = -1;
      const m = s.match(/(\d+)\s*[-–]\s*(\d+)/);
      if (m) { lo = parseInt(m[1], 10); hi = parseInt(m[2], 10); }
      else {
        const singleMatch = s.match(/^(\d+)$/);
        if (singleMatch) { lo = parseInt(singleMatch[1], 10); hi = parseInt(singleMatch[1], 10); }
      }

      if (lo >= 0 && hi >= 0 && hi >= lo) {
        const overlaps = allBinDefs.filter(b => {
          if (lo === hi) return lo >= b.lo && hi <= b.hi;
          return Math.max(lo, b.lo) < Math.min(hi, b.hi);
        });
        if (overlaps.length > 0) {
          return { rmSizes: overlaps.map(b => b.key), targetProduct: `Fallback (${sToUse})`, yieldPct: 100 };
        }
      }
    }
    return null;
  };

  const classifyOrder = (order: StgErpOrderLine) => {
    const spec = specMap.get(order.erpOrderItemCode);
    const desc = ((spec as any)?.erpItemDesc || order.erpOrderItemCode || '').toUpperCase();
    if (desc.includes('BL BLOCK') || desc.includes('BL_BLOCK') || desc.includes('BLBLOCK')) return 'BL_BLOCK';
    if (desc.includes('BL TH') || desc.includes('BL-TH') || desc.includes('BLTH')) return 'BLTH';
    if (desc.includes('BL DR') || desc.includes('BL-DR') || desc.includes('BLDR')) return 'BLDR';
    if (desc.includes('BLK')) return 'BLK';
    if (extractBeltGateSizes(desc, (spec as any)?.productSize)) return 'BLK';
    return 'OTHER';
  };

  const dailyTracker = new Map<string, { icutUsedKg: number; icutUsedHours: number; manualUsedKg: number; blBlockProduced: number; blBlockUsed: number }>();
  const getTracker = (dateStr: string) => {
    if (!dailyTracker.has(dateStr)) {
      dailyTracker.set(dateStr, { icutUsedKg: 0, icutUsedHours: 0, manualUsedKg: 0, blBlockProduced: 0, blBlockUsed: 0 });
    }
    return dailyTracker.get(dateStr)!;
  };

  // I-Cut hours: total available machine hours per day
  const MAX_ICUT_HOURS_PER_DAY = Math.round(HOURS_PER_SHIFT * SHIFTS_PER_DAY); // ~19 hrs/day (2 shifts × 9.58 hrs)

  const dailyByproductSupply = new Map<string, any>();
  const getOrInitByproductSupply = (dateStr: string) => {
    if (!dailyByproductSupply.has(dateStr)) {
      dailyByproductSupply.set(dateStr, {});
    }
    return dailyByproductSupply.get(dateStr);
  };

  const generateByproducts = (dateStr: string, rmQty: number, spec: any) => {
    if (!spec || !spec.masterYieldIds) return;
    const processIds = spec.masterYieldIds.split(',').map((id: any) => id.trim());
    const pId = processIds[0];
    if (!pId) return;
    const node = findNode(allYieldNodes, pId);
    if (!node) return;
    const processNode = node.parentId ? findNode(allYieldNodes, node.parentId) : node;
    if (processNode && processNode.children) {
      const daySupply = getOrInitByproductSupply(dateStr);
      processNode.children.forEach((child: any) => {
        if (child.id === pId) return; // Skip the main item itself
        const byProdQty = rmQty * (Number(child.yieldPercentage) || 0);
        if (byProdQty > 0) {
          if (!daySupply[child.id]) {
            daySupply[child.id] = { name: child.name, qty: 0 };
          }
          daySupply[child.id].qty += byProdQty;
        }
      });
    }
  };

  // Preserve INITIAL supply map for saving later, because we will mutate supplyMap
  const initialSupplyMap = new Map<string, {
    internalLegRm: number;
    externalLegRm: number;
    totalLegRm: number;
    legSizes: Record<string, number>;
    blSizes: Record<string, number>;
    intakeBirds: number;
    totalWeight: number;
  }>();
  for (const [key, val] of supplyMap.entries()) {
    initialSupplyMap.set(key, {
      internalLegRm: val.internalLegRm,
      externalLegRm: val.externalLegRm,
      totalLegRm: val.totalLegRm,
      legSizes: { ...val.legSizes },
      blSizes: { ...val.blSizes },
      intakeBirds: val.intakeBirds,
      totalWeight: val.totalWeight,
    });
  }

  const startStr = orderStartDate || targetMonth + '-01';
  const start = new Date(`${startStr}T00:00:00`);
  let end: Date;
  if (orderEndDate) {
    end = new Date(`${orderEndDate}T23:59:59`);
  } else {
    end = new Date(`${startStr}T23:59:59`); 
    end.setMonth(end.getMonth() + 3);
  }

  let rawLines: StgErpOrderLine[] = await manager.find(StgErpOrderLine, {
    where: { erpOrderShipDate: Between(start, end) }
  });
  
  // Filter out cancelled orders manually to match the previous builder logic
  rawLines = rawLines.filter(line => line.erpOrderStatus !== 'CANCELLED');

  // Handle _allocatedMap (cross-month dedup)
  if (!body._allocatedMap && rawLines.length > 0) {
    body._allocatedMap = new Map<number, number>();
    const lineIds = rawLines.map(l => l.erpOrderLineId);
    const chunk_size = 1000;
    for (let i = 0; i < lineIds.length; i += chunk_size) {
      const chunk = lineIds.slice(i, i + chunk_size);
      const existingOrders = await manager.createQueryBuilder(MpsPlanOrder, 'ord')
        .innerJoin('ord.mpsPlan', 'p')
        .where('ord.erpOrderLineId IN (:...chunk)', { chunk })
        .andWhere('p.id != :currentPlanId', { currentPlanId: plan.id || 0 })
        .getMany();
      for (const eo of existingOrders) {
        body._allocatedMap.set(eo.erpOrderLineId, (body._allocatedMap.get(eo.erpOrderLineId) || 0) + Number(eo.quantityKg));
      }
    }
  }

  // Deduct already-allocated quantities from rawLines
  if (body._allocatedMap) {
    rawLines.forEach(line => {
      if (body._allocatedMap.has(line.erpOrderLineId)) {
        const allocated = body._allocatedMap.get(line.erpOrderLineId)!;
        const newQty = Math.max(0, Number(line.erpOrderItemQty || 0) - allocated);
        line.erpOrderItemQty = newQty;
      }
    });
    // Remove orders that have been fully allocated
    rawLines = rawLines.filter(line => Number(line.erpOrderItemQty || 0) > 0);
  }

  const headerIds = [...new Set(rawLines.map(l => l.erpOrderHeaderId))];
  const headers: StgErpOrderHeader[] = [];
  if (headerIds.length > 0) {
    const headerChunkSize = 1000;
    for (let i = 0; i < headerIds.length; i += headerChunkSize) {
      const chunk = headerIds.slice(i, i + headerChunkSize);
      const chunkHeaders = await manager.createQueryBuilder(StgErpOrderHeader, 'header')
          .where('header.erpOrderHeaderId IN (:...chunk)', { chunk })
          .getMany();
      headers.push(...chunkHeaders);
    }
  }
  const headerMap = new Map(headers.map(h => [h.erpOrderHeaderId, h]));

  // 4. Global Sorting Logic
  const getGradeWeight = (order: StgErpOrderLine) => {
    const header = headerMap.get(order.erpOrderHeaderId);
    const grade = (header?.erpCustomerGrade || '').toUpperCase();
    if (grade === 'A' || grade.includes('GRADE A')) return 1;
    if (grade === 'B' || grade.includes('GRADE B')) return 2;
    return 3;
  };

  rawLines.sort((a, b) => {
    // 1st Priority: Ship Date (Ascending)
    const dateA = new Date(a.erpOrderShipDate).getTime();
    const dateB = new Date(b.erpOrderShipDate).getTime();
    if (dateA !== dateB) return dateA - dateB;
    
    // 2nd Priority: Customer Grade
    const gA = getGradeWeight(a);
    const gB = getGradeWeight(b);
    if (gA !== gB) return gA - gB;
    
    // 3rd Priority: Priority Field
    const prioDiff = (a.priority ?? 9999) - (b.priority ?? 9999);
    if (prioDiff !== 0) return prioDiff;

    // 4th Priority: BIL over BL (If everything else is equal, BIL gets meat first)
    const isABil = bilItemCodes.includes(a.erpOrderItemCode);
    const isBBil = bilItemCodes.includes(b.erpOrderItemCode);
    if (isABil && !isBBil) return -1;
    if (!isABil && isBBil) return 1;

    return 0;
  });

  // 5. Unified Allocation Loop
  const mpsOrdersToSave: MpsPlanOrder[] = [];
  const exceptionsToSave: MpsExceptionReport[] = [];
  
  const mainOrders: any[] = [];
  const byprodChillOrders: any[] = [];
  const byprodFreezeOrders: any[] = [];

  for (const order of rawLines) {
    const spec = specMap.get(order.erpOrderItemCode);
    if (spec && isByproductSpec(spec)) {
      if ((spec as any).productType === 'chilled') {
        byprodChillOrders.push(order);
      } else {
        byprodFreezeOrders.push(order);
      }
    } else {
      // Must be BIL or BL
      if (combinedItemCodes.includes(order.erpOrderItemCode)) {
        mainOrders.push(order);
      }
    }
  }

  // Track capacities per day (e.g. Deboning machine limits)
  const capacityTracker = new Map<string, { debonedKg: number }>();
  const unfulfilledMainOrders: any[] = [];

  for (const order of mainOrders) {
    const isBil = bilItemCodes.includes(order.erpOrderItemCode);
    const isBl = blItemCodes.includes(order.erpOrderItemCode);
    
    const spec = specMap.get(order.erpOrderItemCode);
    const itemDesc = (spec as any)?.erpItemDesc || order.erpOrderItemCode;
    const minLead = (spec as any)?.minProductLead ?? 1;
    const maxLead = (spec as any)?.maxProductLead ?? 3;
    
    let remainingQty = Number(order.erpOrderItemQty || 0);
    if (remainingQty <= 0) continue;
    
    const shipDate = new Date(order.erpOrderShipDate);

    // Yield logic: BIL = 100% (1:1), BL = 75% (need 1.33x RM)
    const rmYieldPct = isBl ? 0.75 : 1.0; 

    // Find the best production date (backward scheduling)
    for (let leadDay = minLead; leadDay <= maxLead; leadDay++) {
      if (remainingQty <= 0) break;
      
      const prodDate = new Date(shipDate.getTime());
      prodDate.setDate(prodDate.getDate() - leadDay);
      const dateStr = formatDate(prodDate);
      
      const sup = supplyMap.get(dateStr);
      if (!sup) continue;

      // Check available Leg RM
      let allocRmQty = 0;
      let productProduced = 0;

      if (isBil) {
         const rmNeeded = (remainingQty / 1.0) / rmYieldPct;
         allocRmQty = Math.min(sup.totalLegRm, rmNeeded);
         if (allocRmQty > 0) {
           sup.totalLegRm -= allocRmQty;
           productProduced = Math.round(allocRmQty * rmYieldPct);
         }
      } else if (isBl) {
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
                  const m = specSize.match(/(\d+)\s*-\s*(\d+)/);
                  if (m) {
                    blockKey = `BL_BLOCK_${m[1]}_${m[2]}`;
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
    const searchDates = Array.from(supplyMap.keys()).sort();
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
                   const m = specSize.match(/(\d+)\s*-\s*(\d+)/);
                   if (m) {
                     blockKey = `BL_BLOCK_${m[1]}_${m[2]}`;
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
  }

  // --- Allocate By-Products Orders ---
  
  // 5.1 Byproduct CHILL Orders
  for (const order of byprodChillOrders) {
    const spec = specMap.get(order.erpOrderItemCode);
    const itemDesc = (spec as any)?.erpItemDesc || order.erpOrderItemCode;
    let remainingQty = Number(order.erpOrderItemQty || 0);
    if (remainingQty <= 0) continue;
    
    const shipDate = new Date(order.erpOrderShipDate);
    // Try to fulfill on shipDate, then up to 5 days before
    for (let i = 0; i <= 5; i++) {
      if (remainingQty <= 0) break;
      const d = new Date(shipDate);
      d.setDate(d.getDate() - i);
      const dateStr = formatDate(d);
      
      const daySupply = dailyByproductSupply.get(dateStr);
      if (!daySupply) continue;
      
      const bpIds = spec?.masterYieldIds ? spec.masterYieldIds.split(',').map((id: any) => id.trim()) : [];
      for (const bpId of bpIds) {
        if (remainingQty <= 0) break;
        const bpSupply = daySupply[bpId] ? daySupply[bpId].qty : 0;
        if (bpSupply <= 0) continue;
        
        const allocQty = Math.round(Math.min(bpSupply, remainingQty));
        if (allocQty <= 0) continue;
        
        mpsOrdersToSave.push(manager.create(MpsPlanOrder, {
          mpsPlan: plan,
          erpOrderLineId: order.erpOrderLineId,
          soNumber: headerMap.get(order.erpOrderHeaderId)?.erpOrderNumber || '-',
          itemCode: order.erpOrderItemCode,
          itemDesc: itemDesc,
          productType: 'chilled',
          quantityKg: allocQty,
          shipDate: shipDate,
          plannedProductionDate: d,
          finishedProductionDate: d,
          isManualOverride: false,
        }));
        
        daySupply[bpId].qty = Math.max(0, daySupply[bpId].qty - allocQty);
        remainingQty -= allocQty;
      }
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
        reason: 'Insufficient byproduct supply for Chill byproduct order',
      }));
    }
  }

  // 5.2 Byproduct FREEZE Orders
  for (const order of byprodFreezeOrders) {
    const spec = specMap.get(order.erpOrderItemCode);
    const itemDesc = (spec as any)?.erpItemDesc || order.erpOrderItemCode;
    const minLead = (spec as any)?.minProductLead ?? 5;
    const maxLead = (spec as any)?.maxProductLead ?? 90;
    
    let remainingQty = Number(order.erpOrderItemQty || 0);
    if (remainingQty <= 0) continue;
    
    const shipDate = new Date(order.erpOrderShipDate);
    const earliestProdDate = new Date(shipDate); earliestProdDate.setDate(earliestProdDate.getDate() - maxLead);
    const latestProdDate = new Date(shipDate); latestProdDate.setDate(latestProdDate.getDate() - minLead);
    
    // Add 5 extra days buffer for byproducts
    const earliestProdDateByproduct = new Date(earliestProdDate); earliestProdDateByproduct.setDate(earliestProdDateByproduct.getDate() - 5);
    
    // Reverse iterate dates
    let currentD = new Date(latestProdDate);
    while (currentD >= earliestProdDateByproduct) {
      if (remainingQty <= 0) break;
      const dateStr = formatDate(currentD);
      const daySupply = dailyByproductSupply.get(dateStr);
      
      if (daySupply) {
        const bpIds = spec?.masterYieldIds ? spec.masterYieldIds.split(',').map((id: any) => id.trim()) : [];
        for (const bpId of bpIds) {
          if (remainingQty <= 0) break;
          const bpSupply = daySupply[bpId] ? daySupply[bpId].qty : 0;
          if (bpSupply <= 0) continue;
          
          const allocQty = Math.round(Math.min(bpSupply, remainingQty));
          if (allocQty <= 0) continue;
          
          mpsOrdersToSave.push(manager.create(MpsPlanOrder, {
            mpsPlan: plan,
            erpOrderLineId: order.erpOrderLineId,
            soNumber: headerMap.get(order.erpOrderHeaderId)?.erpOrderNumber || '-',
            itemCode: order.erpOrderItemCode,
            itemDesc: itemDesc,
            productType: 'freeze',
            quantityKg: allocQty,
            shipDate: shipDate,
            plannedProductionDate: currentD,
            finishedProductionDate: new Date(currentD.getTime() + 4 * 24 * 60 * 60 * 1000),
            isManualOverride: false,
          }));
          
          daySupply[bpId].qty = Math.max(0, daySupply[bpId].qty - allocQty);
          remainingQty -= allocQty;
        }
      }
      currentD.setDate(currentD.getDate() - 1);
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
        reason: 'Insufficient byproduct supply for Freeze byproduct order',
      }));
    }
  }

  // 5.5 Construct Dailies and Supplies
  const mpsDailiesToSave: MpsPlanDaily[] = [];
  const mpsSuppliesToSave: MpsPlanSupply[] = [];
  let totalIntakeBirds = 0;
  let totalRmFlKg = 0;
  let totalDemandKg = 0;

  const dailyDemand = new Map<string, number>();
  mpsOrdersToSave.forEach(o => {
    const dStr = formatDate(o.plannedProductionDate);
    dailyDemand.set(dStr, (dailyDemand.get(dStr) || 0) + Number(o.quantityKg));
    totalDemandKg += Number(o.quantityKg);
  });

  for (const dayStr of allDateStrs) {
    // Only save daily summaries for the target month to prevent overlapping plans
    if (!dayStr.startsWith(targetMonth)) continue;
    
    const prodDate = new Date(`${dayStr}T00:00:00`);
    
    const initialSup = initialSupplyMap.get(dayStr);
    if (!initialSup) continue;
    
    totalIntakeBirds += initialSup.intakeBirds;
    totalRmFlKg += initialSup.totalLegRm;

    const tracker = getTracker(dayStr);
    const blRmTotal = (capacityTracker.get(dayStr) || { debonedKg: 0 }).debonedKg;

    const intRatio = initialSup.totalLegRm > 0 ? initialSup.internalLegRm / initialSup.totalLegRm : 1;
    const extRatio = initialSup.totalLegRm > 0 ? initialSup.externalLegRm / initialSup.totalLegRm : 0;
    
    // In this unified logic, all deboned meat goes to BL. 
    // We don't separate BLTH / BLDR at the RM level anymore, so we map it all to BL.
    const internalBlRm = blRmTotal * intRatio;
    const externalBlRm = blRmTotal * extRatio;

    mpsDailiesToSave.push(manager.create(MpsPlanDaily, {
      mpsPlan: plan,
      productionDate: prodDate,
      intakeBirds: initialSup.intakeBirds,
      rmFlAvailKg: initialSup.totalLegRm,
      internalRmKg: initialSup.internalLegRm,
      externalRmKg: initialSup.externalLegRm,
      demandKg: dailyDemand.get(dayStr) || 0,
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
        internalRemaining: {
          BL: internalBlRm,
          BLTH: 0,
          BLDR: 0,
        },
        externalRemaining: {
          BL: externalBlRm,
          BLTH: 0,
          BLDR: 0,
        },
        rmBreakdown: {
          bl: blRmTotal,
          blTh: 0,
          blDr: 0,
        },
        beltGateSizes: supplyMap.get(dayStr)?.blSizes || {},
      }),
    }));

    if (initialSup.totalLegRm > 0) {
      const sizesToSave: MpsPlanSupplySize[] = [];
      for (const [sz, kg] of Object.entries(initialSup.legSizes)) {
        sizesToSave.push(manager.create(MpsPlanSupplySize, {
          groupSize: sz,
          partName: 'BIL L/C',
          quantityKg: kg as number,
          productionDate: prodDate,
        }));
      }

      const bpSupply = dailyByproductSupply.get(dayStr) || {};
      const byProductsStr = Object.keys(bpSupply).length > 0 ? JSON.stringify(bpSupply) : null;

      mpsSuppliesToSave.push(manager.create(MpsPlanSupply, {
        mpsPlan: plan,
        productionDate: prodDate,
        intakeBirds: initialSup.intakeBirds,
        totalWeight: initialSup.totalWeight,
        avgWeight: initialSup.intakeBirds > 0 ? Number((initialSup.totalWeight / initialSup.intakeBirds).toFixed(3)) : 0,
        slaughteredWeight: initialSup.totalWeight * 0.9575 * 0.95,
        sizes: sizesToSave,
        byProducts: byProductsStr,
      }));
    }
  }

  // Update plan totals
  plan.totalIntakeBirds = totalIntakeBirds;
  plan.totalRmFlKg = totalRmFlKg;
  plan.totalDemandKg = totalDemandKg;
  await manager.save(plan);

  // 6. Save Everything with Chunking (to avoid MS SQL 2100 param limit)
  if (mpsDailiesToSave.length > 0) {
    const saveChunkSize = 50;
    for (let k = 0; k < mpsDailiesToSave.length; k += saveChunkSize) {
      await manager.save(mpsDailiesToSave.slice(k, k + saveChunkSize));
    }
  }

  if (mpsSuppliesToSave.length > 0) {
    const saveChunkSize = 50;
    for (let k = 0; k < mpsSuppliesToSave.length; k += saveChunkSize) {
      await manager.save(mpsSuppliesToSave.slice(k, k + saveChunkSize));
    }
  }

  if (mpsOrdersToSave.length > 0) {
    const saveChunkSize = 100;
    for (let k = 0; k < mpsOrdersToSave.length; k += saveChunkSize) {
      await manager.save(mpsOrdersToSave.slice(k, k + saveChunkSize));
    }
  }
  
  if (exceptionsToSave.length > 0) {
    const saveChunkSize = 100;
    for (let k = 0; k < exceptionsToSave.length; k += saveChunkSize) {
      await manager.save(exceptionsToSave.slice(k, k + saveChunkSize));
    }
  }

  return { success: true, message: 'Unified Leg Plan Generated successfully' };
}
