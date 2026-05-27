import { EntityManager, Repository } from 'typeorm';
import { MpsPlan, MpsPlanDaily, MpsPlanOrder } from './mps-plan.entity';
import { MpsPlanSupply } from './mps-plan-supply.entity';
import { MpsPlanSupplySize } from './mps-plan-supply-size.entity';
import { MpsExceptionReport } from './mps-exception.entity';
import { BlBeltGateMatrix } from './bl-belt-gate-matrix.entity';
import { ProductSpec } from './product-spec.entity';
import { StgErpOrderLine } from './stg-erp-order-line.entity';
import { StgErpOrderHeader } from './stg-erp-order-header.entity';

interface BlDependencies {
  machineConfigs: any[];
  getItemCodesByPartType: (pt: string) => Promise<string[] | null>;
  parseLocalDate: (val: any) => string;
  formatDate: (val: any) => string;
  specRepo: Repository<ProductSpec>;
  masterYieldRepo: any;
  blBeltGateMatrixRepo: Repository<BlBeltGateMatrix>;
}

export async function executeBlPlanGeneration(
  body: any,
  manager: EntityManager,
  deps: BlDependencies,
) {
  const { targetMonth, orderStartDate, orderEndDate } = body;
  const { parseLocalDate, formatDate } = deps;

  // ──────────────────────────────────────
  // 1. Fetch Belt Gate Matrix
  // ──────────────────────────────────────
  const blBeltGateMatrix = await deps.blBeltGateMatrixRepo.find({ order: { priority: 'ASC' } });

  // ──────────────────────────────────────
  // 2. Fetch BIL Plan for RM Supply
  // ──────────────────────────────────────
  const bilPlan = await manager.findOne(MpsPlan, {
    where: { targetMonth, partType: 'bil' },
    relations: ['dailySummaries', 'supplyBreakdown', 'supplyBreakdown.sizes'],
    order: { createdAt: 'DESC' },
  });

  if (!bilPlan) {
    return {
      success: false,
      message: `ไม่สามารถสร้างแผน BL ได้ เนื่องจากไม่พบแผน BIL ของเดือน ${targetMonth} กรุณาสร้างแผน BIL ก่อน`,
    };
  }

  // ──────────────────────────────────────
  // 3. Create or Reset BL Plan
  // ──────────────────────────────────────
  const existingApproved = await manager.findOne(MpsPlan, { where: { targetMonth, partType: 'bl', status: 'APPROVED' } });
  if (existingApproved) {
    return { success: false, message: `มีแผน BL ที่ APPROVED แล้วสำหรับเดือน ${targetMonth} ต้อง Reject ก่อนถึงจะสร้างใหม่ได้` };
  }

  let plan = await manager.findOne(MpsPlan, { where: { targetMonth, partType: 'bl', status: 'DRAFT' } });
  if (plan) {
    await manager.delete(MpsPlanDaily, { mpsPlan: { id: plan.id } });
    await manager.delete(MpsPlanSupply, { mpsPlan: { id: plan.id } });
    await manager.delete(MpsPlanOrder, { mpsPlan: { id: plan.id } });
    await manager.delete(MpsExceptionReport, { mpsPlan: { id: plan.id } });
  } else {
    plan = manager.create(MpsPlan, {
      planName: `MPS ${targetMonth} - BL Draft`,
      targetMonth,
      partType: 'bl',
      status: 'DRAFT',
      createdBy: 'SYSTEM',
    });
    await manager.save(plan);
  }

  // ──────────────────────────────────────
  // 4. Build RM Supply from BIL byProducts
  // ──────────────────────────────────────
  const supplyMap = new Map<string, {
    totalBL: number;
    totalBLTH: number;
    totalBLDR: number;
    blSizes: Record<string, number>;
    available: { BL: number; BLTH: number; BLDR: number };
  }>();

  const supplyRecords: MpsPlanSupply[] = [];

  if (bilPlan.supplyBreakdown) {
    for (const supply of bilPlan.supplyBreakdown) {
      const dateStr = parseLocalDate(supply.productionDate);
      if (!dateStr) continue;

      let byProducts: Record<string, any> = {};
      try {
        byProducts = JSON.parse(supply.byProducts || '{}');
      } catch (e) { /* ignore */ }

      // Extract BL data from BIL byProducts
      // BIL stores BL as key "BL-DEBONE" with { name, qty, processName }
      const blData = byProducts['BL-DEBONE'] || byProducts['BL'] || byProducts['BL (Debone)'] || {};
      const bpVals = Object.values(byProducts) as any[];
      const blThData = bpVals.find(v => v.name && v.name.includes('สะโพก')) || byProducts['BL-TH'] || {};
      const blDrData = bpVals.find(v => v.name && v.name.includes('น่อง')) || byProducts['BL-DR'] || {};
      const blKg = Number(blData.qty || blData.kg || blData.quantity || 0);
      const blThKg = Number(blThData.qty || blThData.kg || blThData.quantity || 0) * 0.75;
      const blDrKg = Number(blDrData.qty || blDrData.kg || blDrData.quantity || 0) * 0.75;
      const blSizes: Record<string, number> = blData.sizes || {};
      
      const blThSizes: Record<string, number> = {};
      Object.entries(blThData.sizes || {}).forEach(([size, qty]: any) => {
        blThSizes[size] = Number(qty) * 0.75;
      });

      const blDrSizes: Record<string, number> = {};
      Object.entries(blDrData.sizes || {}).forEach(([size, qty]: any) => {
        blDrSizes[size] = Number(qty) * 0.75;
      });
      
      Object.entries(blThSizes).forEach(([size, qty]) => {
        blSizes[size] = (blSizes[size] || 0) + qty;
      });
      Object.entries(blDrSizes).forEach(([size, qty]) => {
        blSizes[size] = (blSizes[size] || 0) + qty;
      });

      supplyMap.set(dateStr, {
        totalBL: blKg,
        totalBLTH: blThKg,
        totalBLDR: blDrKg,
        blSizes,
        available: { BL: blKg, BLTH: blThKg, BLDR: blDrKg },
      });

      supplyRecords.push(manager.create(MpsPlanSupply, {
        mpsPlan: plan,
        productionDate: supply.productionDate,
        intakeBirds: 0,
        totalWeight: blKg + blThKg + blDrKg,
        avgWeight: 0,
        slaughteredWeight: blKg + blThKg + blDrKg,
        byProducts: JSON.stringify({
          'BL': { kg: blKg, sizes: blSizes },
          'BL-TH': { kg: blThKg, sizes: blThSizes },
          'BL-DR': { kg: blDrKg, sizes: blDrSizes },
        }),
      }));
    }
  }

  if (supplyRecords.length > 0) {
    const savedSupplies = await manager.save(supplyRecords);
    
    // Copy RM sizes from BIL plan so the frontend fallback logic has sizes to work with
    const supplySizeRecords: MpsPlanSupplySize[] = [];
    if (bilPlan.supplyBreakdown) {
      for (const bilSupply of bilPlan.supplyBreakdown) {
        if (!bilSupply.sizes || bilSupply.sizes.length === 0) continue;
        
        const dateStr = parseLocalDate(bilSupply.productionDate);
        const savedSup = savedSupplies.find(s => parseLocalDate(s.productionDate) === dateStr);
        if (!savedSup) continue;
        
        for (const bilSize of bilSupply.sizes) {
          supplySizeRecords.push(manager.create(MpsPlanSupplySize, {
            mpsPlanSupply: savedSup,
            groupSize: bilSize.groupSize,
            quantityKg: bilSize.quantityKg,
            partName: bilSize.partName || 'BL',
            productionDate: bilSize.productionDate || bilSupply.productionDate,
          }));
        }
      }
    }

    if (supplySizeRecords.length > 0) {
      await manager.save(supplySizeRecords);
    }
  }

  // ──────────────────────────────────────
  // 5. Fetch BL Orders
  // ──────────────────────────────────────
  const allSpecs = await deps.specRepo.find();
  const specMap = new Map(allSpecs.map(s => [s.erpItemCode, s]));

  const allowedItemCodes = await deps.getItemCodesByPartType('bl');
  const startStr = orderStartDate || targetMonth + '-01';
  const start = new Date(`${startStr}T00:00:00`);
  const endStr = orderEndDate || (() => {
    const d = new Date(start);
    d.setMonth(d.getMonth() + 2);
    d.setDate(0);
    return formatDate(d);
  })();
  const end = new Date(`${endStr}T23:59:59`);

  let rawLines: StgErpOrderLine[] = [];
  if (allowedItemCodes && allowedItemCodes.length > 0) {
    rawLines = await manager.createQueryBuilder(StgErpOrderLine, 'line')
      .where('line.erpOrderItemCode IN (:...itemCodes)', { itemCodes: allowedItemCodes })
      .andWhere('line.erpOrderShipDate >= :start AND line.erpOrderShipDate <= :end', { start, end })
      .andWhere("line.erpOrderStatus != 'CANCELLED'")
      .getMany();
  }

  const headerIds = [...new Set(rawLines.map(l => l.erpOrderHeaderId))];
  const headers: StgErpOrderHeader[] = headerIds.length > 0
    ? await manager.createQueryBuilder(StgErpOrderHeader, 'header')
        .where('header.erpOrderHeaderId IN (:...headerIds)', { headerIds })
        .getMany()
    : [];
  const headerMap = new Map(headers.map(h => [h.erpOrderHeaderId, h.erpOrderNumber]));

  // ──────────────────────────────────────
  // 6. Classify orders
  // ──────────────────────────────────────
  const classifyOrder = (order: StgErpOrderLine) => {
    const spec = specMap.get(order.erpOrderItemCode);
    const desc = ((spec as any)?.erpItemDesc || order.erpOrderItemCode || '').toUpperCase();
    if (desc.includes('BL TH') || desc.includes('BL-TH') || desc.includes('BLTH')) return 'BLTH';
    if (desc.includes('BL DR') || desc.includes('BL-DR') || desc.includes('BLDR')) return 'BLDR';
    if (desc.includes('BLK')) return 'BLK';
    return 'OTHER';
  };

  const getGradeWeight = (order: StgErpOrderLine) => {
    const header = headers.find(h => h.erpOrderHeaderId === order.erpOrderHeaderId);
    const grade = (header?.erpCustomerGrade || '').toUpperCase();
    if (grade === 'A' || grade.includes('GRADE A')) return 1;
    if (grade === 'B' || grade.includes('GRADE B')) return 2;
    return 3;
  };

  const prioritySort = (a: StgErpOrderLine, b: StgErpOrderLine) => {
    const dateA = new Date(a.erpOrderShipDate).getTime();
    const dateB = new Date(b.erpOrderShipDate).getTime();
    if (dateA !== dateB) return dateA - dateB;
    const gA = getGradeWeight(a);
    const gB = getGradeWeight(b);
    if (gA !== gB) return gA - gB;
    return (a.priority ?? 9999) - (b.priority ?? 9999);
  };

  const extractBeltGateSize = (desc: string): { rmSize: string, targetProduct: string, yieldPct: number } | null => {
    // Check against the database matrix rules (prioritized by 'priority' ASC)
    for (const rule of blBeltGateMatrix) {
      if (desc.includes(rule.targetProduct)) {
        return { rmSize: rule.rmSize, targetProduct: rule.targetProduct, yieldPct: Number(rule.yieldPct || 100) };
      }
    }
    return null;
  };

  // Phase 1: Belt Gate Sizing (BLK, icutSpeed == 0, has Belt Gate mapping)
  // Phase 2: Special Orders (BLTH, BLDR, icutSpeed == 0)
  // Phase 3: I-Cut Orders (icutSpeed > 0)
  // Phase 4: Manual Trimming (BLK or OTHER, icutSpeed == 0, no Belt Gate mapping)
  
  const phase1Orders: StgErpOrderLine[] = [];
  const phase2Orders: StgErpOrderLine[] = [];
  const phase3Orders: StgErpOrderLine[] = [];
  const phase4Orders: StgErpOrderLine[] = [];

  for (const order of rawLines) {
    const spec = specMap.get(order.erpOrderItemCode);
    const icutSpeed = Number((spec as any)?.icutSpeed || 0);
    const classification = classifyOrder(order);
    const itemDesc = ((spec as any)?.erpItemDesc || order.erpOrderItemCode || '').toUpperCase();

    if (icutSpeed > 0) {
      phase3Orders.push(order);
    } else if (['BLTH', 'BLDR'].includes(classification)) {
      phase2Orders.push(order);
    } else if (classification === 'BLK') {
      const mapping = extractBeltGateSize(itemDesc);
      if (mapping) {
        phase1Orders.push(order);
      } else {
        phase4Orders.push(order);
      }
    } else {
      phase4Orders.push(order);
    }
  }

  phase1Orders.sort(prioritySort);
  phase2Orders.sort(prioritySort);
  phase3Orders.sort(prioritySort);
  phase4Orders.sort(prioritySort);
  // ──────────────────────────────────────
  // 7. Allocation helpers
  // ──────────────────────────────────────
  const mpsOrdersToSave: MpsPlanOrder[] = [];
  const exceptionsToSave: MpsExceptionReport[] = [];
  const dailyTracker = new Map<string, { icutUsedKg: number; manualUsedKg: number }>();

  const getTracker = (dateStr: string) => {
    if (!dailyTracker.has(dateStr)) {
      dailyTracker.set(dateStr, { icutUsedKg: 0, manualUsedKg: 0 });
    }
    return dailyTracker.get(dateStr)!;
  };

  // I-CUT Capacity from MachineConfig (default 10,000 kg/day)
  const icutConfig = deps.machineConfigs.find((c: any) => c.machineKey === 'ICUT');
  const MAX_ICUT_KG_PER_DAY = icutConfig ? Number(icutConfig.capacityPcsPerHour) * 8 : 10000;

  const subtractDays = (d: Date, days: number) => {
    const nd = new Date(d.getTime());
    nd.setDate(nd.getDate() - days);
    return nd;
  };

  const createOrderRecord = (order: StgErpOrderLine, allocQty: number, prodDate: Date, shipDate: Date, itemDesc: string, productType: string) => {
    return manager.create(MpsPlanOrder, {
      mpsPlan: plan,
      erpOrderLineId: order.erpOrderLineId,
      soNumber: headerMap.get(order.erpOrderHeaderId) || '-',
      itemCode: order.erpOrderItemCode,
      itemDesc: itemDesc,
      productType: productType,
      quantityKg: allocQty,
      shipDate: shipDate,
      plannedProductionDate: prodDate,
      finishedProductionDate: prodDate,
      isManualOverride: false,
    });
  };

  const createExceptionRecord = (order: StgErpOrderLine, remainingQty: number, shipDate: Date, reason: string) => {
    return manager.create(MpsExceptionReport, {
      mpsPlan: plan,
      erpOrderLineId: order.erpOrderLineId,
      soNumber: headerMap.get(order.erpOrderHeaderId) || '-',
      itemCode: order.erpOrderItemCode,
      shipDate: shipDate,
      requiredKg: Number(order.erpOrderItemQty || 0),
      shortageKg: remainingQty,
      reason: reason,
    });
  };

  // ──────────────────────────────────────
  // Phase 1: Allocate Belt Gate Sizing Orders (BLK, icutSpeed == 0)
  // ──────────────────────────────────────
  for (const order of phase1Orders) {
    const spec = specMap.get(order.erpOrderItemCode);
    const itemDesc = (spec as any)?.erpItemDesc || order.erpOrderItemCode;
    const descUpper = itemDesc.toUpperCase();
    const productType = (spec as any)?.productType || 'Freeze';
    const minLead = (spec as any)?.minProductLead ?? 1;
    const maxLead = (spec as any)?.maxProductLead ?? 3;
    const orderQty = Number(order.erpOrderItemQty || 0);
    let remainingQty = orderQty;
    const shipDate = new Date(order.erpOrderShipDate);

    const requiredMapping = extractBeltGateSize(descUpper);
    if (!requiredMapping) {
      // Should not happen due to pre-filtering, but fallback
      phase4Orders.push(order);
      continue;
    }
    const requiredSize = requiredMapping.rmSize;
    const yieldMultiplier = requiredMapping.yieldPct / 100;

    // Try to allocate from specific size bucket
    for (let leadDay = minLead; leadDay <= maxLead; leadDay++) {
      if (remainingQty <= 0) break;
      const prodDate = subtractDays(shipDate, leadDay);
      const dateStr = formatDate(prodDate);
      const sup = supplyMap.get(dateStr);
      if (!sup) continue;

      const availSizeKg = sup.blSizes[requiredSize] || 0;
      if (availSizeKg <= 0) continue;

      const rmNeeded = remainingQty / yieldMultiplier;
      const allocRmQty = Math.round(Math.min(availSizeKg, rmNeeded));
      if (allocRmQty <= 0) continue;

      const productProduced = Math.round(allocRmQty * yieldMultiplier);

      sup.blSizes[requiredSize] -= allocRmQty;
      sup.available.BL -= allocRmQty;
      remainingQty -= productProduced;

      mpsOrdersToSave.push(createOrderRecord(order, productProduced, prodDate, shipDate, itemDesc, productType));
    }

    if (remainingQty > 0) {
      exceptionsToSave.push(createExceptionRecord(order, remainingQty, shipDate, `RM BL Size ${requiredSize} supply ไม่เพียงพอสำหรับ order Sizing นี้`));
    }
  }

  // ──────────────────────────────────────
  // Phase 2: Allocate Special Orders (BL-TH, BL-DR)
  // ──────────────────────────────────────
  for (const order of phase2Orders) {
    const type = classifyOrder(order);
    const rmType = type === 'BLTH' ? 'BLTH' : 'BLDR';
    const spec = specMap.get(order.erpOrderItemCode);
    const itemDesc = (spec as any)?.erpItemDesc || order.erpOrderItemCode;
    const productType = (spec as any)?.productType || 'Freeze';
    const minLead = (spec as any)?.minProductLead ?? 1;
    const maxLead = (spec as any)?.maxProductLead ?? 3;
    const orderQty = Number(order.erpOrderItemQty || 0);
    let remainingQty = orderQty;
    const shipDate = new Date(order.erpOrderShipDate);

    for (let leadDay = minLead; leadDay <= maxLead; leadDay++) {
      if (remainingQty <= 0) break;
      const prodDate = subtractDays(shipDate, leadDay);
      const dateStr = formatDate(prodDate);
      const sup = supplyMap.get(dateStr);
      if (!sup) continue;

      const avail = sup.available[rmType];
      if (avail <= 0) continue;

      const allocQty = Math.round(Math.min(avail, remainingQty));
      if (allocQty <= 0) continue;

      sup.available[rmType] -= allocQty;
      remainingQty -= allocQty;

      mpsOrdersToSave.push(createOrderRecord(order, allocQty, prodDate, shipDate, itemDesc, productType));
    }

    if (remainingQty > 0) {
      exceptionsToSave.push(createExceptionRecord(order, remainingQty, shipDate, `RM ${rmType} supply ไม่เพียงพอสำหรับ order Special นี้`));
    }
  }

  // ──────────────────────────────────────
  // Phase 3: Allocate I-CUT Orders (icutSpeed > 0)
  // ──────────────────────────────────────
  // I-Cut produces Co-Product "BL BLOCK" which is used in Phase 4
  const icutMaster = await manager.getRepository('ICutMaster').findOne({ where: { status: 'ACTIVE' } });
  const coproductYieldPct = Number((icutMaster as any)?.coproductYieldPct || 20); // Default 20% BL BLOCK
  const mainYieldPct = 100 - coproductYieldPct;

  for (const order of phase3Orders) {
    const spec = specMap.get(order.erpOrderItemCode);
    const itemDesc = (spec as any)?.erpItemDesc || order.erpOrderItemCode;
    const descUpper = itemDesc.toUpperCase();
    const productType = (spec as any)?.productType || 'Freeze';
    const minLead = (spec as any)?.minProductLead ?? 1;
    const maxLead = (spec as any)?.maxProductLead ?? 3;
    const orderQty = Number(order.erpOrderItemQty || 0);
    let remainingQty = orderQty;
    const shipDate = new Date(order.erpOrderShipDate);

    // Determine target size for BL BLOCK (1 step lower)
    const weightMatch = descUpper.match(/(\d+)\s*[-–]\s*(\d+)/);
    let generatedBlockKey = 'BL_BLOCK_UNSIZED';
    if (weightMatch) {
      const minW = parseInt(weightMatch[1]);
      const maxW = parseInt(weightMatch[2]);
      const diff = maxW - minW;
      generatedBlockKey = `BL_BLOCK_${Math.max(0, minW - diff)}_${Math.max(0, maxW - diff)}`;
    }

    const yieldMultiplier = mainYieldPct / 100;

    for (let leadDay = minLead; leadDay <= maxLead; leadDay++) {
      if (remainingQty <= 0) break;
      const prodDate = subtractDays(shipDate, leadDay);
      const dateStr = formatDate(prodDate);
      const sup = supplyMap.get(dateStr);
      if (!sup) continue;

      const avail = sup.available.BL;
      if (avail <= 0) continue;

      const rmNeeded = remainingQty / yieldMultiplier;
      const allocRmQty = Math.round(Math.min(avail, rmNeeded));
      if (allocRmQty <= 0) continue;

      const productProduced = Math.round(allocRmQty * yieldMultiplier);
      const blockProduced = allocRmQty - productProduced;

      // Track I-Cut Capacity
      const tracker = getTracker(dateStr);
      tracker.icutUsedKg += allocRmQty;

      // Deduct RM and add BL BLOCK
      sup.available.BL -= allocRmQty;
      remainingQty -= productProduced;
      
      sup.blSizes[generatedBlockKey] = (sup.blSizes[generatedBlockKey] || 0) + blockProduced;
      // Mark total BL BLOCK for reporting
      sup.blSizes['TOTAL_BL_BLOCK'] = (sup.blSizes['TOTAL_BL_BLOCK'] || 0) + blockProduced;

      // Deduct from general blSizes proportionally
      let remainingToDeduct = allocRmQty;
      for (const [sz, qty] of Object.entries(sup.blSizes)) {
        if (sz.startsWith('BL_BLOCK_') || sz === 'TOTAL_BL_BLOCK') continue;
        if (remainingToDeduct <= 0) break;
        if (qty > 0) {
          const deduct = Math.min(qty, remainingToDeduct);
          sup.blSizes[sz] -= deduct;
          remainingToDeduct -= deduct;
        }
      }

      mpsOrdersToSave.push(createOrderRecord(order, productProduced, prodDate, shipDate, itemDesc, productType));
    }

    if (remainingQty > 0) {
      exceptionsToSave.push(createExceptionRecord(order, remainingQty, shipDate, `RM BL supply ไม่เพียงพอสำหรับ order I-Cut นี้`));
    }
  }

  // ──────────────────────────────────────
  // Phase 4: Allocate Manual Trimming Orders (No I-Cut, No Belt Gate)
  // ──────────────────────────────────────
  phase4Orders.sort(prioritySort);
  for (const order of phase4Orders) {
    const spec = specMap.get(order.erpOrderItemCode);
    const itemDesc = (spec as any)?.erpItemDesc || order.erpOrderItemCode;
    const descUpper = itemDesc.toUpperCase();
    const productType = (spec as any)?.productType || 'Freeze';
    const minLead = (spec as any)?.minProductLead ?? 1;
    const maxLead = (spec as any)?.maxProductLead ?? 3;
    const orderQty = Number(order.erpOrderItemQty || 0);
    let remainingQty = orderQty;
    const shipDate = new Date(order.erpOrderShipDate);

    // Manual Trimming matches the BL BLOCK size
    const weightMatch = descUpper.match(/(\d+)\s*[-–]\s*(\d+)/);
    let targetBlockKey = 'BL_BLOCK_UNSIZED';
    if (weightMatch) {
      const minW = parseInt(weightMatch[1]);
      const maxW = parseInt(weightMatch[2]);
      targetBlockKey = `BL_BLOCK_${minW}_${maxW}`;
    }

    const manualConfig = deps.machineConfigs.find((c: any) => c.machineKey === 'manual_trim');
    const manualYield = manualConfig ? Number(manualConfig.yieldPercentage || 0.90) : 0.90;

    for (let leadDay = minLead; leadDay <= maxLead; leadDay++) {
      if (remainingQty <= 0) break;
      const prodDate = subtractDays(shipDate, leadDay);
      const dateStr = formatDate(prodDate);
      const sup = supplyMap.get(dateStr);
      if (!sup) continue;

      const rmNeeded = remainingQty / manualYield;
      let allocRmQty = 0;

      // 1. Try to use matching BL BLOCK first
      const availBlock = sup.blSizes[targetBlockKey] || 0;
      if (availBlock > 0) {
        const blockToUse = Math.min(availBlock, rmNeeded);
        sup.blSizes[targetBlockKey] -= blockToUse;
        sup.blSizes['TOTAL_BL_BLOCK'] -= blockToUse;
        allocRmQty += blockToUse;
      }

      // 2. Try any other BL BLOCK
      if (allocRmQty < rmNeeded) {
        for (const sz of Object.keys(sup.blSizes)) {
          if (sz.startsWith('BL_BLOCK_') && sz !== 'TOTAL_BL_BLOCK' && sz !== targetBlockKey) {
            const availOther = sup.blSizes[sz];
            if (availOther > 0) {
              const toUse = Math.min(availOther, rmNeeded - allocRmQty);
              sup.blSizes[sz] -= toUse;
              sup.blSizes['TOTAL_BL_BLOCK'] -= toUse;
              allocRmQty += toUse;
              if (allocRmQty >= rmNeeded) break;
            }
          }
        }
      }

      // 3. Fallback to normal RM BL if still needed
      if (allocRmQty < rmNeeded && sup.available.BL > 0) {
        const normalRmToUse = Math.min(sup.available.BL, rmNeeded - allocRmQty);
        sup.available.BL -= normalRmToUse;
        allocRmQty += normalRmToUse;

        // Deduct from general blSizes proportionally
        let remainingToDeduct = normalRmToUse;
        for (const [sz, qty] of Object.entries(sup.blSizes)) {
          if (sz.startsWith('BL_BLOCK_') || sz === 'TOTAL_BL_BLOCK') continue;
          if (remainingToDeduct <= 0) break;
          if (qty > 0) {
            const deduct = Math.min(qty, remainingToDeduct);
            sup.blSizes[sz] -= deduct;
            remainingToDeduct -= deduct;
          }
        }
      }

      if (allocRmQty <= 0) continue;

      const productProduced = Math.round(allocRmQty * manualYield);
      const tracker = getTracker(dateStr);
      tracker.manualUsedKg += allocRmQty;

      remainingQty -= productProduced;
      mpsOrdersToSave.push(createOrderRecord(order, productProduced, prodDate, shipDate, itemDesc, productType));
    }

    if (remainingQty > 0) {
      exceptionsToSave.push(createExceptionRecord(order, remainingQty, shipDate, `RM BL supply ไม่เพียงพอสำหรับ order Manual (รวมถึง BL BLOCK)`));
    }
  }

  // ──────────────────────────────────────
  // Save Orders and Exceptions
  // ──────────────────────────────────────
  if (mpsOrdersToSave.length > 0) {
    await manager.save(mpsOrdersToSave);
  }
  if (exceptionsToSave.length > 0) {
    await manager.save(exceptionsToSave);
  }

  // ──────────────────────────────────────
  // Build and Save Daily Summaries
  // ──────────────────────────────────────
  const dailyToSave: MpsPlanDaily[] = [];
  let totalDemandKg = 0;
  let totalSupplyKg = 0;

  for (const [dateStr, sup] of supplyMap.entries()) {
    const tracker = getTracker(dateStr);
    const ordersForDay = mpsOrdersToSave.filter(o => formatDate(o.plannedProductionDate) === dateStr);
    const dayDemand = ordersForDay.reduce((sum, o) => sum + Number(o.quantityKg || 0), 0);
    totalDemandKg += dayDemand;
    totalSupplyKg += sup.totalBL + sup.totalBLTH + sup.totalBLDR;

    dailyToSave.push(manager.create(MpsPlanDaily, {
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
    }));
  }

  if (dailyToSave.length > 0) {
    await manager.save(dailyToSave);
  }

  // Update plan
  plan.status = 'DRAFT';
  await manager.save(plan);

  return {
    success: true,
    message: `สร้างแผน BL สำเร็จ: ${mpsOrdersToSave.length} orders, ${exceptionsToSave.length} exceptions`,
    plan: {
      id: plan.id,
      targetMonth,
      totalSupplyKg: Math.round(totalSupplyKg),
      totalDemandKg: Math.round(totalDemandKg),
      ordersPlaced: mpsOrdersToSave.length,
      exceptions: exceptionsToSave.length,
      icutCapacityPerDay: MAX_ICUT_KG_PER_DAY,
    },
  };
}
