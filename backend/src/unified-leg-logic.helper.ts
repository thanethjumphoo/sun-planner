import { EntityManager, Repository, Between } from 'typeorm';
import { MpsPlan, MpsPlanDaily, MpsPlanOrder } from './mps-plan.entity';
import { MpsPlanSupply } from './mps-plan-supply.entity';
import { MpsPlanSupplySize } from './mps-plan-supply-size.entity';
import { MpsExceptionReport } from './mps-exception.entity';
import { StgErpOrderLine } from './stg-erp-order-line.entity';
import { StgErpOrderHeader } from './stg-erp-order-header.entity';

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
      planName: `MPS ${targetMonth} - Unified Leg Draft`,
      targetMonth,
      partType: 'leg', // A new unified partType
      status: 'DRAFT',
      createdBy: 'SYSTEM',
    });
    await manager.save(plan);
  }

  // 2. Build Shared Leg RM Pool from Intake
  const supplyMap = new Map<string, {
    totalLegRm: number;
    legSizes: Record<string, number>;
    intakeBirds: number;
    totalWeight: number;
  }>();
  
  // Get days in month
  const [year, month] = targetMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  
  // Fetch intakes
  const allIntakes = await deps.chickenReceivingService.findAll('monthly');
  const weightMatrix = await deps.bilWeightDistRepo.find();
  
  // Fetch Master Yield for Leg
  const bilNode = await deps.masterYieldRepo.findOne({ where: { type: 'CATEGORY', name: 'BIL L/C' } });
  const legYieldPct = bilNode?.yieldPercentage ? Number(bilNode.yieldPercentage) : 0.25;

  for (let i = 1; i <= daysInMonth; i++) {
    const dayStr = `${targetMonth}-${i.toString().padStart(2, '0')}`;
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
        totalLegRm: Math.round(dailyLegRm),
        legSizes: sizeBins,
        intakeBirds: dailyIntakeBirds,
        totalWeight: dailyTotalWeight,
      });
    }
  }

  // 3. Fetch Orders for BOTH BIL and BL
  const allSpecs = await deps.specRepo.find();
  const specMap = new Map(allSpecs.map((s: any) => [s.erpItemCode, s]));

  const bilItemCodes = await deps.getItemCodesByPartType('bil') || [];
  const blItemCodes = await deps.getItemCodesByPartType('bl') || [];
  const combinedItemCodes = [...new Set([...bilItemCodes, ...blItemCodes])];

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
    totalLegRm: number;
    legSizes: Record<string, number>;
    intakeBirds: number;
    totalWeight: number;
  }>();
  for (const [key, val] of supplyMap.entries()) {
    initialSupplyMap.set(key, {
      totalLegRm: val.totalLegRm,
      legSizes: { ...val.legSizes },
      intakeBirds: val.intakeBirds,
      totalWeight: val.totalWeight,
    });
  }

  const startStr = orderStartDate || targetMonth + '-01';
  const start = new Date(`${startStr}T00:00:00`);
  // Using fixed end date for simplification
  const end = new Date(`${startStr}T23:59:59`); 
  end.setMonth(end.getMonth() + 3);

  let rawLines: StgErpOrderLine[] = await manager.find(StgErpOrderLine, {
    where: { erpOrderShipDate: Between(start, end) }
  });
  
  // Filter out cancelled orders manually to match the previous builder logic
  rawLines = rawLines.filter(line => line.erpOrderStatus !== 'CANCELLED');

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
    return (a.priority ?? 9999) - (b.priority ?? 9999);
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
      const rmNeeded = remainingQty / rmYieldPct;
      let allocRmQty = Math.min(sup.totalLegRm, rmNeeded);
      
      // If BL, check deboning capacity
      if (isBl) {
         const tracker = capacityTracker.get(dateStr) || { debonedKg: 0 };
         const DEBONE_CAPACITY = 10000; // Example: 10,000 kg per day max
         const allowedDebone = Math.max(0, DEBONE_CAPACITY - tracker.debonedKg);
         allocRmQty = Math.min(allocRmQty, allowedDebone);
      }

      if (allocRmQty <= 0) continue;

      // Deduct from RM Pool
      sup.totalLegRm -= allocRmQty;
      // TODO: Deduct specific Leg Sizes here

      if (isBl) {
        const tracker = capacityTracker.get(dateStr) || { debonedKg: 0 };
        tracker.debonedKg += allocRmQty;
        capacityTracker.set(dateStr, tracker);
      }

      const productProduced = Math.round(allocRmQty * rmYieldPct);
      remainingQty -= productProduced;

      // Generate By-Products
      generateByproducts(dateStr, allocRmQty, spec);

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
        reason: 'Shared Leg RM supply is insufficient',
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
        
        daySupply[bpId].qty -= allocQty;
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
          
          daySupply[bpId].qty -= allocQty;
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

  for (let i = 1; i <= daysInMonth; i++) {
    const dayStr = `${targetMonth}-${i.toString().padStart(2, '0')}`;
    const prodDate = new Date(`${dayStr}T00:00:00`);
    
    const initialSup = initialSupplyMap.get(dayStr);
    if (!initialSup) continue;
    
    totalIntakeBirds += initialSup.intakeBirds;
    totalRmFlKg += initialSup.totalLegRm;

    mpsDailiesToSave.push(manager.create(MpsPlanDaily, {
      mpsPlan: plan,
      productionDate: prodDate,
      intakeBirds: initialSup.intakeBirds,
      rmFlAvailKg: initialSup.totalLegRm,
      internalRmKg: initialSup.totalLegRm,
      externalRmKg: 0,
      demandKg: dailyDemand.get(dayStr) || 0,
      cuttingStaff: 0,
      supportStaff: 0,
      totalStaff: 0,
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
