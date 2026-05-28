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
  // Flow การผลิต BL ที่ถูกต้อง:
  // Phase 1: I-Cut → RM BL → BLK ≤60g + BL-TH (20g range) + BL BLOCK (Co-Product)
  // Phase 2: BL BLOCK ขายตรง (ถ้ามีออเดอร์)
  // Phase 3: BL BLOCK ที่เหลือ → BLK (Belt Gate Sizing)
  // Phase 4: BLK > 60g (คนตัด Manual) → RM BL
  // Phase 5: BL-DR → RM BL-DR
  // Phase 6: Manual Trimming อื่นๆ → RM BL ที่เหลือ

  const classifyOrder = (order: StgErpOrderLine) => {
    const spec = specMap.get(order.erpOrderItemCode);
    const desc = ((spec as any)?.erpItemDesc || order.erpOrderItemCode || '').toUpperCase();
    if (desc.includes('BL BLOCK') || desc.includes('BL_BLOCK') || desc.includes('BLBLOCK')) return 'BL_BLOCK';
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
    for (const rule of blBeltGateMatrix) {
      if (desc.includes(rule.targetProduct)) {
        return { rmSize: rule.rmSize, targetProduct: rule.targetProduct, yieldPct: Number(rule.yieldPct || 100) };
      }
    }
    return null;
  };

  // Phase 1: I-Cut (icutSpeed > 0) → BLK ≤60g, BL-TH 20g range
  // Phase 2: BL BLOCK direct sale
  // Phase 3: BLK with Belt Gate mapping (uses BL BLOCK first, then RM BL)
  // Phase 4: BLK manual (icutSpeed == 0, no Belt Gate mapping, > 60g) → RM BL
  // Phase 5: BL-DR → RM BL-DR
  // Phase 6: Manual Trimming / Other → remaining RM

  const phase1IcutOrders: StgErpOrderLine[] = [];
  const phase2BlBlockSaleOrders: StgErpOrderLine[] = [];
  const phase3BlkFromBlockOrders: StgErpOrderLine[] = [];
  const phase4ManualBlkOrders: StgErpOrderLine[] = [];
  const phase5BlDrOrders: StgErpOrderLine[] = [];
  const phase6ManualOtherOrders: StgErpOrderLine[] = [];

  for (const order of rawLines) {
    const spec = specMap.get(order.erpOrderItemCode);
    const icutSpeed = Number((spec as any)?.icutSpeed || 0);
    const classification = classifyOrder(order);
    const itemDesc = ((spec as any)?.erpItemDesc || order.erpOrderItemCode || '').toUpperCase();

    if (classification === 'BL_BLOCK') {
      // BL BLOCK direct sale orders
      phase2BlBlockSaleOrders.push(order);
    } else if (icutSpeed > 0) {
      // I-Cut orders (BLK ≤60g, BL-TH 20g range)
      phase1IcutOrders.push(order);
    } else if (classification === 'BLDR') {
      // BL-DR special orders
      phase5BlDrOrders.push(order);
    } else if (classification === 'BLK') {
      // BLK without I-Cut → check Belt Gate mapping
      const mapping = extractBeltGateSize(itemDesc);
      if (mapping) {
        // BLK with Belt Gate → use BL BLOCK first, then RM BL
        phase3BlkFromBlockOrders.push(order);
      } else {
        // BLK manual (> 60g, no Belt Gate) → RM BL directly
        phase4ManualBlkOrders.push(order);
      }
    } else if (classification === 'BLTH') {
      // BL-TH without I-Cut → manual trimming
      phase6ManualOtherOrders.push(order);
    } else {
      // Other → manual trimming
      phase6ManualOtherOrders.push(order);
    }
  }

  phase1IcutOrders.sort(prioritySort);
  phase2BlBlockSaleOrders.sort(prioritySort);
  phase3BlkFromBlockOrders.sort(prioritySort);
  phase4ManualBlkOrders.sort(prioritySort);
  phase5BlDrOrders.sort(prioritySort);
  phase6ManualOtherOrders.sort(prioritySort);
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

  // ══════════════════════════════════════
  // Phase 1: I-Cut Orders (icutSpeed > 0)
  // RM BL → สินค้าหลัก (BLK ≤60g / BL-TH) + BL BLOCK (Co-Product)
  // ══════════════════════════════════════
  const icutMaster = await manager.getRepository('ICutMaster').findOne({ where: { isActive: true } });
  const coproductYieldPct = Number((icutMaster as any)?.coproductYieldPct ?? 0.20); // Default 0.20 (20%)
  const mainYieldPct = 1.0 - coproductYieldPct;

  for (const order of phase1IcutOrders) {
    const spec = specMap.get(order.erpOrderItemCode);
    const itemDesc = (spec as any)?.erpItemDesc || order.erpOrderItemCode;
    const descUpper = itemDesc.toUpperCase();
    const productType = (spec as any)?.productType || 'Freeze';
    const minLead = (spec as any)?.minProductLead ?? 1;
    const maxLead = (spec as any)?.maxProductLead ?? 3;
    const orderQty = Number(order.erpOrderItemQty || 0);
    let remainingQty = orderQty;
    const shipDate = new Date(order.erpOrderShipDate);

    const yieldMultiplier = mainYieldPct;

    for (let leadDay = minLead; leadDay <= maxLead; leadDay++) {
      if (remainingQty <= 0) break;
      const prodDate = subtractDays(shipDate, leadDay);
      const dateStr = formatDate(prodDate);
      const sup = supplyMap.get(dateStr);
      if (!sup) continue;

      const avail = sup.available.BL;
      if (avail <= 0) continue;

      // Check I-Cut capacity
      const tracker = getTracker(dateStr);
      const icutRemaining = MAX_ICUT_KG_PER_DAY - tracker.icutUsedKg;
      if (icutRemaining <= 0) continue;

      const rmNeeded = remainingQty / yieldMultiplier;
      const allocRmQty = Math.round(Math.min(avail, rmNeeded, icutRemaining));
      if (allocRmQty <= 0) continue;

      const productProduced = Math.round(allocRmQty * yieldMultiplier);
      const blockProduced = allocRmQty - productProduced;

      // Track I-Cut Capacity
      tracker.icutUsedKg += allocRmQty;

      // Deduct RM BL
      sup.available.BL -= allocRmQty;
      remainingQty -= productProduced;

      // Generate BL BLOCK co-product (available for Phase 2 & 3)
      sup.blSizes['BL_BLOCK_UNSIZED'] = (sup.blSizes['BL_BLOCK_UNSIZED'] || 0) + blockProduced;
      sup.blSizes['TOTAL_BL_BLOCK'] = (sup.blSizes['TOTAL_BL_BLOCK'] || 0) + blockProduced;

      // Deduct from general blSizes proportionally
      let remainingToDeduct = allocRmQty;
      for (const [sz, qty] of Object.entries(sup.blSizes)) {
        if (sz.startsWith('BL_BLOCK') || sz === 'TOTAL_BL_BLOCK') continue;
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
      exceptionsToSave.push(createExceptionRecord(order, remainingQty, shipDate, `RM BL supply หรือ I-Cut capacity ไม่เพียงพอสำหรับ order I-Cut นี้`));
    }
  }

  // ══════════════════════════════════════
  // Phase 2: BL BLOCK Direct Sale (ถ้ามีออเดอร์ขาย BL BLOCK ตรง)
  // ══════════════════════════════════════
  for (const order of phase2BlBlockSaleOrders) {
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

      const availBlock = sup.blSizes['TOTAL_BL_BLOCK'] || 0;
      if (availBlock <= 0) continue;

      const allocQty = Math.round(Math.min(availBlock, remainingQty));
      if (allocQty <= 0) continue;

      // Deduct from BL BLOCK pools
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
      sup.blSizes['TOTAL_BL_BLOCK'] -= allocQty;
      remainingQty -= allocQty;

      mpsOrdersToSave.push(createOrderRecord(order, allocQty, prodDate, shipDate, itemDesc, productType));
    }

    if (remainingQty > 0) {
      exceptionsToSave.push(createExceptionRecord(order, remainingQty, shipDate, `BL BLOCK supply ไม่เพียงพอสำหรับ order ขายตรง BL BLOCK นี้`));
    }
  }

  // ══════════════════════════════════════
  // Phase 3: BLK from BL BLOCK (Belt Gate Sizing, ดึง BL BLOCK ก่อน แล้วค่อยดึง RM BL)
  // ══════════════════════════════════════
  for (const order of phase3BlkFromBlockOrders) {
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
      phase4ManualBlkOrders.push(order);
      continue;
    }
    const yieldMultiplier = requiredMapping.yieldPct / 100;

    for (let leadDay = minLead; leadDay <= maxLead; leadDay++) {
      if (remainingQty <= 0) break;
      const prodDate = subtractDays(shipDate, leadDay);
      const dateStr = formatDate(prodDate);
      const sup = supplyMap.get(dateStr);
      if (!sup) continue;

      const rmNeeded = remainingQty / yieldMultiplier;
      let allocRmQty = 0;

      // 1. ดึง BL BLOCK ก่อน (Co-Product จาก I-Cut)
      const availBlock = sup.blSizes['TOTAL_BL_BLOCK'] || 0;
      if (availBlock > 0) {
        const blockToUse = Math.min(availBlock, rmNeeded);
        // Deduct from BL BLOCK pools
        let toDeduct = blockToUse;
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
        sup.blSizes['TOTAL_BL_BLOCK'] -= blockToUse;
        allocRmQty += blockToUse;
      }

      // 2. ถ้า BL BLOCK ไม่พอ ค่อยดึง RM BL ปกติ
      if (allocRmQty < rmNeeded && sup.available.BL > 0) {
        const normalRmToUse = Math.min(sup.available.BL, rmNeeded - allocRmQty);
        sup.available.BL -= normalRmToUse;
        allocRmQty += normalRmToUse;

        // Deduct from general blSizes proportionally
        let remainingToDeduct = normalRmToUse;
        for (const [sz, qty] of Object.entries(sup.blSizes)) {
          if (sz.startsWith('BL_BLOCK') || sz === 'TOTAL_BL_BLOCK') continue;
          if (remainingToDeduct <= 0) break;
          if (qty > 0) {
            const deduct = Math.min(qty, remainingToDeduct);
            sup.blSizes[sz] -= deduct;
            remainingToDeduct -= deduct;
          }
        }
      }

      if (allocRmQty <= 0) continue;

      const productProduced = Math.round(allocRmQty * yieldMultiplier);
      remainingQty -= productProduced;
      mpsOrdersToSave.push(createOrderRecord(order, productProduced, prodDate, shipDate, itemDesc, productType));
    }

    if (remainingQty > 0) {
      exceptionsToSave.push(createExceptionRecord(order, remainingQty, shipDate, `BL BLOCK + RM BL supply ไม่เพียงพอสำหรับ order BLK (Belt Gate) นี้`));
    }
  }

  // ══════════════════════════════════════
  // Phase 4: Manual BLK > 60g (คนตัด, ดึง RM BL โดยตรง)
  // ══════════════════════════════════════
  for (const order of phase4ManualBlkOrders) {
    const spec = specMap.get(order.erpOrderItemCode);
    const itemDesc = (spec as any)?.erpItemDesc || order.erpOrderItemCode;
    const productType = (spec as any)?.productType || 'Freeze';
    const productYield = Number((spec as any)?.productYield || 0.90);
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

      const avail = sup.available.BL;
      if (avail <= 0) continue;

      const rmNeeded = remainingQty / productYield;
      const allocRmQty = Math.round(Math.min(avail, rmNeeded));
      if (allocRmQty <= 0) continue;

      const productProduced = Math.round(allocRmQty * productYield);
      sup.available.BL -= allocRmQty;
      remainingQty -= productProduced;

      const tracker = getTracker(dateStr);
      tracker.manualUsedKg += allocRmQty;

      // Deduct from general blSizes proportionally
      let remainingToDeduct = allocRmQty;
      for (const [sz, qty] of Object.entries(sup.blSizes)) {
        if (sz.startsWith('BL_BLOCK') || sz === 'TOTAL_BL_BLOCK') continue;
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
      exceptionsToSave.push(createExceptionRecord(order, remainingQty, shipDate, `RM BL supply ไม่เพียงพอสำหรับ order BLK Manual (> 60g) นี้`));
    }
  }

  // ══════════════════════════════════════
  // Phase 5: BL-DR Special Orders (ดึง RM BL-DR)
  // ══════════════════════════════════════
  for (const order of phase5BlDrOrders) {
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

      const avail = sup.available.BLDR;
      if (avail <= 0) continue;

      const allocQty = Math.round(Math.min(avail, remainingQty));
      if (allocQty <= 0) continue;

      sup.available.BLDR -= allocQty;
      remainingQty -= allocQty;

      mpsOrdersToSave.push(createOrderRecord(order, allocQty, prodDate, shipDate, itemDesc, productType));
    }

    if (remainingQty > 0) {
      exceptionsToSave.push(createExceptionRecord(order, remainingQty, shipDate, `RM BL-DR supply ไม่เพียงพอสำหรับ order BL-DR นี้`));
    }
  }

  // ══════════════════════════════════════
  // Phase 6: Manual Trimming / Other (ดึง BL BLOCK ที่เหลือ + RM BL)
  // ══════════════════════════════════════
  for (const order of phase6ManualOtherOrders) {
    const spec = specMap.get(order.erpOrderItemCode);
    const itemDesc = (spec as any)?.erpItemDesc || order.erpOrderItemCode;
    const productType = (spec as any)?.productType || 'Freeze';
    const productYield = Number((spec as any)?.productYield || 0.90);
    const minLead = (spec as any)?.minProductLead ?? 1;
    const maxLead = (spec as any)?.maxProductLead ?? 3;
    const orderQty = Number(order.erpOrderItemQty || 0);
    let remainingQty = orderQty;
    const shipDate = new Date(order.erpOrderShipDate);
    const classification = classifyOrder(order);

    for (let leadDay = minLead; leadDay <= maxLead; leadDay++) {
      if (remainingQty <= 0) break;
      const prodDate = subtractDays(shipDate, leadDay);
      const dateStr = formatDate(prodDate);
      const sup = supplyMap.get(dateStr);
      if (!sup) continue;

      const rmNeeded = remainingQty / productYield;
      let allocRmQty = 0;

      // 1. ดึง BL BLOCK ที่เหลือก่อน (ถ้ามี)
      const availBlock = sup.blSizes['TOTAL_BL_BLOCK'] || 0;
      if (availBlock > 0) {
        const blockToUse = Math.min(availBlock, rmNeeded);
        let toDeduct = blockToUse;
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
        sup.blSizes['TOTAL_BL_BLOCK'] -= blockToUse;
        allocRmQty += blockToUse;
      }

      // 2. ดึง RM ตามประเภท (BLTH ดึง BL-TH, อื่นๆ ดึง BL)
      if (allocRmQty < rmNeeded) {
        if (classification === 'BLTH' && sup.available.BLTH > 0) {
          const rmToUse = Math.min(sup.available.BLTH, rmNeeded - allocRmQty);
          sup.available.BLTH -= rmToUse;
          allocRmQty += rmToUse;
        }
        // Fallback to RM BL
        if (allocRmQty < rmNeeded && sup.available.BL > 0) {
          const normalRmToUse = Math.min(sup.available.BL, rmNeeded - allocRmQty);
          sup.available.BL -= normalRmToUse;
          allocRmQty += normalRmToUse;

          let remainingToDeduct = normalRmToUse;
          for (const [sz, qty] of Object.entries(sup.blSizes)) {
            if (sz.startsWith('BL_BLOCK') || sz === 'TOTAL_BL_BLOCK') continue;
            if (remainingToDeduct <= 0) break;
            if (qty > 0) {
              const deduct = Math.min(qty, remainingToDeduct);
              sup.blSizes[sz] -= deduct;
              remainingToDeduct -= deduct;
            }
          }
        }
      }

      if (allocRmQty <= 0) continue;

      const productProduced = Math.round(allocRmQty * productYield);
      const tracker = getTracker(dateStr);
      tracker.manualUsedKg += allocRmQty;

      remainingQty -= productProduced;
      mpsOrdersToSave.push(createOrderRecord(order, productProduced, prodDate, shipDate, itemDesc, productType));
    }

    if (remainingQty > 0) {
      exceptionsToSave.push(createExceptionRecord(order, remainingQty, shipDate, `RM supply ไม่เพียงพอสำหรับ order Manual นี้`));
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
