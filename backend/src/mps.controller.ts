import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { StgErpOrderLine } from './stg-erp-order-line.entity';
import { StgErpOrderHeader } from './stg-erp-order-header.entity';
import { ProductSpec } from './product-spec.entity';
import { MpsPlan, MpsPlanDaily, MpsPlanOrder } from './mps-plan.entity';
import { MpsPlanSupply } from './mps-plan-supply.entity';
import { WeightDistribution } from './weight-distribution.entity';
import { FilletSizeCalc } from './fillet-size.entity';
import { MpsExceptionReport } from './mps-exception.entity';
import { ChickenReceivingService } from './chicken-receiving/chicken-receiving.service';

@Controller('api/mps')
export class MpsController {
  constructor(
    @InjectRepository(StgErpOrderLine)
    private orderLineRepo: Repository<StgErpOrderLine>,
    @InjectRepository(StgErpOrderHeader)
    private orderHeaderRepo: Repository<StgErpOrderHeader>,
    @InjectRepository(ProductSpec)
    private specRepo: Repository<ProductSpec>,
    @InjectRepository(MpsPlan)
    private mpsPlanRepo: Repository<MpsPlan>,
    @InjectRepository(MpsPlanDaily)
    private mpsDailyRepo: Repository<MpsPlanDaily>,
    @InjectRepository(MpsPlanOrder)
    private mpsOrderRepo: Repository<MpsPlanOrder>,
    @InjectRepository(MpsPlanSupply)
    private mpsSupplyRepo: Repository<MpsPlanSupply>,
    @InjectRepository(WeightDistribution)
    private weightDistRepo: Repository<WeightDistribution>,
    @InjectRepository(MpsExceptionReport)
    private exceptionRepo: Repository<MpsExceptionReport>,
    @InjectRepository(FilletSizeCalc)
    private filletSizeRepo: Repository<FilletSizeCalc>,
    private chickenReceivingService: ChickenReceivingService,
  ) { }

  // 1. Manually update planned production date in MpsPlanOrder (Drag & Drop)
  @Post('update-date')
  async updateDate(@Body() body: { planId?: number, mpsOrderId?: number, lineId: number; date: string; splitQty?: number }) {
    // Guard: check if plan is locked (APPROVED)
    if (body.planId) {
      const plan = await this.mpsPlanRepo.findOne({ where: { id: body.planId } });
      if (plan && plan.status === 'APPROVED') {
        return { success: false, message: 'Cannot modify an approved plan' };
      }
    }

    if (body.mpsOrderId) {
      const planOrder = await this.mpsOrderRepo.findOne({ where: { id: body.mpsOrderId }, relations: ['mpsPlan'] });
      if (planOrder) {
        // Double-check lock via order's parent plan
        if (planOrder.mpsPlan && planOrder.mpsPlan.status === 'APPROVED') {
          return { success: false, message: 'Cannot modify an approved plan' };
        }

        if (body.splitQty && body.splitQty > 0 && body.splitQty < planOrder.quantityKg) {
          // Splitting the order
          const remainQty = planOrder.quantityKg - body.splitQty;
          planOrder.quantityKg = remainQty;
          await this.mpsOrderRepo.save(planOrder);

          // Create new split order
          const splitOrder = this.mpsOrderRepo.create({
            mpsPlan: planOrder.mpsPlan,
            erpOrderLineId: planOrder.erpOrderLineId,
            soNumber: planOrder.soNumber,
            itemCode: planOrder.itemCode,
            itemDesc: planOrder.itemDesc,
            productType: planOrder.productType,
            quantityKg: body.splitQty,
            shipDate: planOrder.shipDate,
            plannedProductionDate: new Date(body.date),
            isManualOverride: true
          });
          await this.mpsOrderRepo.save(splitOrder);
        } else {
          // Move whole order
          planOrder.plannedProductionDate = new Date(body.date);
          planOrder.isManualOverride = true; // Mark as manually overridden
          await this.mpsOrderRepo.save(planOrder);
        }
        return { success: true };
      }
    } else if (body.planId && body.lineId) {
      // Find the specific order in the plan
      const planOrder = await this.mpsOrderRepo.findOne({
        where: { mpsPlan: { id: body.planId }, erpOrderLineId: body.lineId }
      });
      if (planOrder) {
        planOrder.plannedProductionDate = new Date(body.date);
        planOrder.isManualOverride = true;
        await this.mpsOrderRepo.save(planOrder);

        // Optionally update the source order line as well
        const line = await this.orderLineRepo.findOne({ where: { erpOrderLineId: body.lineId } });
        if (line) {
          line.plannedProductionDate = new Date(body.date);
          await this.orderLineRepo.save(line);
        }

        return { success: true };
      }
    }

    // Fallback to original logic if planId is not provided
    const line = await this.orderLineRepo.findOne({ where: { erpOrderLineId: body.lineId } });
    if (line) {
      line.plannedProductionDate = new Date(body.date);
      await this.orderLineRepo.save(line);
      return { success: true };
    }
    return { success: false, message: 'Line not found' };
  }

  // 2. Auto-Allocate logic (Backwards Scheduling)
  @Post('auto-allocate')
  async autoAllocate() {
    // Get all unallocated lines
    const unallocated = await this.orderLineRepo.createQueryBuilder('line')
      .where('line.planned_production_date IS NULL')
      .andWhere('line.erp_order_ship_date IS NOT NULL')
      .getMany();

    // Get specs to know chill/freeze
    const specs = await this.specRepo.find();
    const specMap = new Map();
    specs.forEach(s => specMap.set(s.erpItemCode, s.productType));

    let allocatedCount = 0;

    for (const line of unallocated) {
      const type = specMap.get(line.erpOrderItemCode) || 'chilled';
      const shipDate = new Date(line.erpOrderShipDate);

      const plannedDate = new Date(shipDate);

      // Logic: Chill = -1 day, Freeze = -5 days
      if (type === 'chilled') {
        plannedDate.setDate(plannedDate.getDate() - 1);
      } else {
        plannedDate.setDate(plannedDate.getDate() - 5);
      }

      // Normally we would check supply here. For now, we allocate to the ideal date.
      line.plannedProductionDate = plannedDate;
      await this.orderLineRepo.save(line);
      allocatedCount++;
    }

    return { success: true, allocatedCount };
  }

  // 3. Generate & Snapshot MPS Plan
  @Post('generate')
  async generatePlan(@Body() body: { targetMonth: string; orderStartDate?: string; orderEndDate?: string }) { // targetMonth format: '2026-05'
    const targetMonth = body.targetMonth;

    // Step 1: Check for existing plans for this month
    // Block if an APPROVED plan already exists
    const existingApproved = await this.mpsPlanRepo.findOne({ where: { targetMonth, status: 'APPROVED' } });
    if (existingApproved) {
      return { success: false, message: `An approved plan already exists for ${targetMonth}. Reject it first to regenerate.` };
    }

    let plan = await this.mpsPlanRepo.findOne({ where: { targetMonth, status: 'DRAFT' } });
    if (plan) {
      // Clear old details
      await this.mpsDailyRepo.delete({ mpsPlan: { id: plan.id } });
      await this.mpsSupplyRepo.delete({ mpsPlan: { id: plan.id } });
      await this.mpsOrderRepo.delete({ mpsPlan: { id: plan.id } });
      await this.exceptionRepo.delete({ mpsPlan: { id: plan.id } });
    } else {
      plan = this.mpsPlanRepo.create({
        planName: `MPS ${targetMonth} - Draft`,
        targetMonth,
        status: 'DRAFT',
      });
      plan = await this.mpsPlanRepo.save(plan);
    }

    // Use custom date range if provided, otherwise fall back to targetMonth
    let startOfRange: Date;
    let endOfRange: Date;

    if (body.orderStartDate && body.orderEndDate) {
      startOfRange = new Date(`${body.orderStartDate}T00:00:00`);
      endOfRange = new Date(`${body.orderEndDate}T23:59:59`);
    } else {
      const targetDate = new Date(`${targetMonth}-01T00:00:00Z`);
      startOfRange = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1, 0, 0, 0);
      endOfRange = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59);
    }

    // Supply still uses targetMonth for chicken intake
    const targetDate = new Date(`${targetMonth}-01T00:00:00Z`);
    const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1, 0, 0, 0);
    const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59);

    // Step 2: Fetch Orders & Specs using the custom date range
    const orders = await this.orderLineRepo.find({
      where: { erpOrderShipDate: Between(startOfRange, endOfRange) }
    });

    // Fetch order headers to get the actual SO numbers and Customer Grade
    const orderHeaders = await this.orderHeaderRepo.find();
    const headerMap = new Map();
    const gradeMap = new Map();
    orderHeaders.forEach(h => {
      headerMap.set(h.erpOrderHeaderId, h.erpOrderNumber);
      gradeMap.set(h.erpOrderHeaderId, h.erpCustomerGrade);
    });

    const specs = await this.specRepo.find();
    const specMap = new Map();
    specs.forEach(s => specMap.set(s.erpItemCode, s));

    // Helper functions — use LOCAL date to avoid UTC timezone shift
    // (toISOString() converts to UTC, shifting +7 timezone dates back by 1 day)
    const formatDate = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };
    const parseLocalDate = (val: any): string | null => {
      if (!val) return null;
      if (val instanceof Date) return formatDate(val);
      if (typeof val === 'string') return val.split('T')[0];
      return null;
    };
    const subtractDays = (date: Date, days: number) => {
      const d = new Date(date);
      d.setDate(d.getDate() - days);
      return d;
    };

    // Step 3: Fetch Supply (Chicken Receiving Month)
    // We use monthly plan to represent the actual supply for continuous mapping
    const allIntakesRaw = await this.chickenReceivingService.findAll('monthly');
    // Filter to only this target month
    const allIntakes = allIntakesRaw.filter((intake: any) => {
      const d = parseLocalDate(intake.receive_date);
      return d && d.startsWith(targetMonth);
    });

    const supplyMap = new Map<string, number>();
    allIntakes.forEach((intake: any) => {
      const d = parseLocalDate(intake.receive_date);
      if (d) {
        const intakeKg = Number(intake.chicken_weight || 0);
        // Formula matching the previous system mapping logic
        // Formula: Slaughtered Weight * 4% (Fillet Yield) * 90%
        const rmFlAvailKg = intakeKg * 0.9575 * 0.95 * 0.04 * 0.9;
        supplyMap.set(d, (supplyMap.get(d) || 0) + rmFlAvailKg);
      }
    });

    const chillOrders: any[] = [];
    const freezeOrders: any[] = [];

    for (const order of orders) {
      const spec = specMap.get(order.erpOrderItemCode);
      if (!spec) continue;

      const orderObj = {
        ...order,
        productType: spec.productType,
        qty: Number(order.erpOrderItemQty || 0),
        shipDate: new Date(order.erpOrderShipDate)
      };

      if (orderObj.productType === 'chilled') {
        chillOrders.push(orderObj);
      } else {
        freezeOrders.push(orderObj);
      }
    }

    // Define Grade Weights: lower number = higher priority
    const gradeWeight: Record<string, number> = {
      'A+': 1,
      'A': 2,
      'B': 3,
      'C': 4,
      'D': 5,
      'DEFAULT': 6,
      '-': 7
    };

    const getGradeWeight = (line: any) => {
      const grade = gradeMap.get(line.erpOrderHeaderId) || '';
      return gradeWeight[grade] || 8; // Default weight for unknown/empty
    };

    // Sort by: 1. Ship Date, 2. Grade, 3. SO Number, 4. Manual Priority
    const prioritySort = (a: any, b: any) => {
      // 1. Ship Date
      const dateDiff = a.shipDate.getTime() - b.shipDate.getTime();
      if (dateDiff !== 0) return dateDiff;

      // 2. Customer Grade
      const aGrade = getGradeWeight(a);
      const bGrade = getGradeWeight(b);
      if (aGrade !== bGrade) return aGrade - bGrade;

      // 3. SO Number
      const soA = headerMap.get(a.erpOrderHeaderId) || a.erpOrderHeaderId?.toString() || '';
      const soB = headerMap.get(b.erpOrderHeaderId) || b.erpOrderHeaderId?.toString() || '';
      const soDiff = soA.localeCompare(soB);
      if (soDiff !== 0) return soDiff;

      // 4. Manual Priority (as tie-breaker for lines within same SO)
      const aPri = a.priority ?? 9999;
      const bPri = b.priority ?? 9999;
      return aPri - bPri;
    };
    chillOrders.sort(prioritySort);
    freezeOrders.sort(prioritySort);

    const mpsOrdersToSave: MpsPlanOrder[] = [];
    const exceptionsToSave: any[] = [];
    let totalDemandKg = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Step 4: Map CHILL Orders First (Flexible Lead Time: Ship Date -1 to -3 Days)
    for (const order of chillOrders) {
      totalDemandKg += order.qty;
      let remainingQty = order.qty;

      // Try to find supply starting from Ship Date - 1 backwards to Ship Date - 3
      for (let d = subtractDays(order.shipDate, 1); d >= subtractDays(order.shipDate, 3); d = subtractDays(d, 1)) {
        if (remainingQty <= 0) break;

        const dateStr = formatDate(d);
        const supply = supplyMap.get(dateStr) || 0;

        if (supply > 0) {
          const allocQty = Math.round(Math.min(supply, remainingQty));
          if (allocQty > 0) {
            mpsOrdersToSave.push(this.mpsOrderRepo.create({
              mpsPlan: plan,
              erpOrderLineId: order.erpOrderLineId,
              soNumber: headerMap.get(order.erpOrderHeaderId) || order.erpOrderHeaderId?.toString(),
              itemCode: order.erpOrderItemCode,
              itemDesc: order.erpOrderItemCode,
              productType: order.productType,
              quantityKg: allocQty,
              shipDate: order.shipDate,
              plannedProductionDate: d,
              isManualOverride: false
            }));
            supplyMap.set(dateStr, supply - allocQty);
            remainingQty -= allocQty;
          }
        }
      }

      if (remainingQty > 0) {
        // Discard unmet demand from calendar, log as exception
        exceptionsToSave.push(this.exceptionRepo.create({
          mpsPlan: plan,
          erpOrderLineId: order.erpOrderLineId,
          soNumber: headerMap.get(order.erpOrderHeaderId) || order.erpOrderHeaderId?.toString() || '-',
          itemCode: order.erpOrderItemCode,
          shipDate: order.shipDate,
          requiredKg: order.qty,
          shortageKg: remainingQty,
          reason: `No supply available for Chill order on or before ${formatDate(order.shipDate)}`
        }));
      }
    }

    // Step 5: Map FREEZE Orders — Waterfall FIFO with Size Matching
    // ─────────────────────────────────────────────────────────────
    // 5a. Build per-date SIZE supply map using Fillet Size Calc (Manual Groups)
    const weightMatrix = await this.weightDistRepo.find();
    const filletCalcs = await this.filletSizeRepo.find();
    const filletMap = new Map<string, string>(); // colLabel -> groupName
    filletCalcs.forEach(c => {
      if (c.groupName) filletMap.set(c.colLabel, c.groupName);
    });

    const sizeSupplyMap = new Map<string, { total: number, bins: Record<string, number> }>();

    allIntakes.forEach((intake: any) => {
      const d = parseLocalDate(intake.receive_date);
      if (!d) return;

      const intakeKg = Number(intake.chicken_weight || 0);
      const intakeBirds = Number(intake.chicken_count || 0);
      if (intakeBirds <= 0 || intakeKg <= 0) return;

      const avgWeight = parseFloat((intakeKg / intakeBirds).toFixed(2)); // ปรับทศนิยม 2 ตำแหน่งเพื่อแก้บัค Range
      const slaughteredWeight = intakeKg * 0.9575 * 0.95;

      // Find matching weight distribution rows
      const matchingRows = weightMatrix.filter(row => {
        const label = row.rowLabel;
        if (label.includes('-')) {
          const parts = label.split('-').map(s => parseFloat(s.trim()));
          return avgWeight >= parts[0] && avgWeight <= parts[1];
        }
        return Math.abs(Number(label) - avgWeight) < 0.05;
      });

      // Calculate size bins for this date using MANUAL GROUPS
      const existing = sizeSupplyMap.get(d) || {
        total: 0,
        bins: { '40Down': 0, '40_45': 0, '45_50': 0, '50_55': 0, '55_60': 0, '60_65': 0, '65_70': 0, '70Up': 0 }
      };

      matchingRows.forEach(row => {
        const pct = Number(row.distValue || 0);
        if (pct <= 0) return;

        // KG for this cell = Slaughtered * 4% * cell * 90%
        const kg = Math.round(slaughteredWeight * 0.04 * pct * 0.9);

        // Get group from manual assignment map
        const groupName = filletMap.get(row.colLabel);
        if (groupName) {
          // Map group name to bin key
          const binKey = groupName.replace(/\s+/g, '').replace(/-/g, '_'); // "40 Down" -> "40Down", "40-45" -> "40_45"
          // Special cases for entity fields
          let key = binKey;
          if (key === '40Down') key = '40Down';
          else if (key === '70Up') key = '70Up';
          else if (key.includes('_')) { /* already 40_45 style */ }
          else { /* fallback or exact match */ }

          if (existing.bins[key] !== undefined) {
            existing.bins[key] += kg;
          } else if (key === '40Down') existing.bins['40Down'] += kg;
          else if (key === '40_45') existing.bins['40_45'] += kg;
          else if (key === '45_50') existing.bins['45_50'] += kg;
          else if (key === '50_55') existing.bins['50_55'] += kg;
          else if (key === '55_60') existing.bins['55_60'] += kg;
          else if (key === '60_65') existing.bins['60_65'] += kg;
          else if (key === '65_70') existing.bins['65_70'] += kg;
          else if (key === '70Up') existing.bins['70Up'] += kg;
        }

        existing.total += kg;
      });

      sizeSupplyMap.set(d, existing);
    });

    // 5b. Helper: Map productSize from Spec → size bin key(s)
    const getSizeBinKeys = (productSize: string): string[] => {
      if (!productSize) return [];
      const s = productSize.toLowerCase().trim();
      if (s === 'unsize' || s === '') return []; // unsize matches all — handled separately
      if (s.includes('40 down') || s === '40down') return ['40Down'];
      if (s.includes('70 up') || s === '70up' || s.includes('60 up') || s === '60up') return ['60_65', '65_70', '70Up'];
      // Parse range like "50-55", "50-65", etc.
      const rangeMatch = s.match(/(\d+)\s*[-–]\s*(\d+)/);
      if (rangeMatch) {
        const lo = parseInt(rangeMatch[1]);
        const hi = parseInt(rangeMatch[2]);
        const allBins = [
          { key: '40Down', lo: 0, hi: 40 },
          { key: '40_45', lo: 40, hi: 45 },
          { key: '45_50', lo: 45, hi: 50 },
          { key: '50_55', lo: 50, hi: 55 },
          { key: '55_60', lo: 55, hi: 60 },
          { key: '60_65', lo: 60, hi: 65 },
          { key: '65_70', lo: 65, hi: 70 },
          { key: '70Up', lo: 70, hi: 999 },
        ];
        return allBins.filter(b => b.hi > lo && b.lo < hi).map(b => b.key);
      }
      return []; // Unrecognized → treat as unsize
    };

    // 5c. Sort freeze orders: Ship Date ASC → Grade ASC → SO Number ASC → Priority ASC
    freezeOrders.sort((a, b) => {
      // 1. Ship Date
      const dateDiff = a.shipDate.getTime() - b.shipDate.getTime();
      if (dateDiff !== 0) return dateDiff;

      // 2. Grade
      const aGrade = getGradeWeight(a);
      const bGrade = getGradeWeight(b);
      if (aGrade !== bGrade) return aGrade - bGrade;

      // 3. SO Number
      const soA = headerMap.get(a.erpOrderHeaderId) || a.erpOrderHeaderId?.toString() || '';
      const soB = headerMap.get(b.erpOrderHeaderId) || b.erpOrderHeaderId?.toString() || '';
      const soDiff = soA.localeCompare(soB);
      if (soDiff !== 0) return soDiff;

      // 4. Manual Priority
      const aPri = a.priority ?? 9999;
      const bPri = b.priority ?? 9999;
      return aPri - bPri;
    });

    // 5d. Prepare for allocation (Priority already handled in 5c sort)


    // 5e. Collect all available dates (today → end of month range) sorted ascending
    const addDays = (date: Date, days: number) => {
      const d = new Date(date);
      d.setDate(d.getDate() + days);
      return d;
    };
    const allDateStrs: string[] = [];
    for (let d = new Date(startOfMonth); d <= endOfMonth; d = addDays(d, 1)) {
      allDateStrs.push(formatDate(d));
    }

    // 5f. Allocate function for freeze orders
    const allocateFreeze = (orderList: any[], useSizeMatch: boolean) => {
      for (const order of orderList) {
        totalDemandKg += order.qty;
        let remainingQty = order.qty;

        const spec = specMap.get(order.erpOrderItemCode);
        const productSize = spec?.productSize || '';
        const sizeBinKeys = getSizeBinKeys(productSize);
        const isUnsize = sizeBinKeys.length === 0;

        // Valid production window: earliest date first → shipDate - 5 (max 30 days window)
        const latestProdDate = subtractDays(order.shipDate, 5);
        const earliestProdDate = subtractDays(order.shipDate, 30);

        // Waterfall forward: earliest date first
        for (const dateStr of allDateStrs) {
          if (remainingQty <= 0) break;
          const dateObj = new Date(dateStr + 'T00:00:00');
          if (dateObj < earliestProdDate || dateObj > latestProdDate) continue;

          // Check total RM supply first (hard gate)
          const totalRmForDate = supplyMap.get(dateStr) || 0;
          if (totalRmForDate <= 0) continue;

          const sizeData = sizeSupplyMap.get(dateStr);

          let availableQty = 0;
          if (useSizeMatch && !isUnsize && sizeData) {
            // Sum available from matching size bins only
            availableQty = sizeBinKeys.reduce((sum, key) => sum + (sizeData.bins[key] || 0), 0);
          } else {
            // Unsize or no size data available: use whatever RM is left
            availableQty = totalRmForDate;
          }

          if (availableQty <= 0) continue;

          const allocQty = Math.round(Math.min(availableQty, remainingQty, totalRmForDate));
          if (allocQty <= 0) continue;

          mpsOrdersToSave.push(this.mpsOrderRepo.create({
            mpsPlan: plan,
            erpOrderLineId: order.erpOrderLineId,
            soNumber: headerMap.get(order.erpOrderHeaderId) || order.erpOrderHeaderId?.toString(),
            itemCode: order.erpOrderItemCode,
            itemDesc: order.erpOrderItemCode,
            productType: order.productType,
            quantityKg: allocQty,
            shipDate: order.shipDate,
            plannedProductionDate: dateObj,
            isManualOverride: false
          }));

          // Deduct from supply maps
          supplyMap.set(dateStr, totalRmForDate - allocQty);
          if (sizeData) {
            sizeData.total -= allocQty;
            if (useSizeMatch && !isUnsize) {
              let deductRemaining = allocQty;
              for (const key of sizeBinKeys) {
                if (deductRemaining <= 0) break;
                const binVal = sizeData.bins[key] || 0;
                const deduct = Math.min(binVal, deductRemaining);
                sizeData.bins[key] = binVal - deduct;
                deductRemaining -= deduct;
              }
            }
          }
          remainingQty -= allocQty;
        }

        if (remainingQty > 0) {
          exceptionsToSave.push(this.exceptionRepo.create({
            mpsPlan: plan,
            erpOrderLineId: order.erpOrderLineId,
            soNumber: headerMap.get(order.erpOrderHeaderId) || order.erpOrderHeaderId?.toString() || '-',
            itemCode: order.erpOrderItemCode,
            shipDate: order.shipDate,
            requiredKg: order.qty,
            shortageKg: remainingQty,
            reason: `Insufficient ${isUnsize ? 'total' : productSize} supply for Freeze order (Ship: ${formatDate(order.shipDate)})`
          }));
        }
      }
    };

    // 5g. Run allocation: Follow Priority Sort (Absolute)
    allocateFreeze(freezeOrders, true);

    await this.mpsOrderRepo.save(mpsOrdersToSave, { chunk: 500 });
    if (exceptionsToSave.length > 0) {
      await this.exceptionRepo.save(exceptionsToSave, { chunk: 500 });
    }

    // Step 6: Generate Daily Summaries for the Month
    const mpsDailiesToSave: MpsPlanDaily[] = [];
    let totalIntakeBirds = 0;
    let totalRmFlKg = 0;

    const dailyDemand = new Map<string, number>();
    const dailyStaff = new Map<string, number>();

    mpsOrdersToSave.forEach(o => {
      const d = formatDate(o.plannedProductionDate);
      dailyDemand.set(d, (dailyDemand.get(d) || 0) + Number(o.quantityKg));

      const spec = specMap.get(o.itemCode);
      const speed = Number(spec?.productSpeed || 45);
      dailyStaff.set(d, (dailyStaff.get(d) || 0) + (Number(o.quantityKg) / speed));
    });

    const daysInMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      const dayStr = `${targetMonth}-${i.toString().padStart(2, '0')}`;

      let intakeBirds = 0;
      let originalSupplyKg = 0;
      allIntakes.forEach((intake: any) => {
        const d = parseLocalDate(intake.receive_date);
        if (d === dayStr) {
          intakeBirds += Number(intake.chicken_count || 0);
          const intakeKg = Number(intake.chicken_weight || 0);
          originalSupplyKg += intakeKg * 0.9575 * 0.95 * 0.04 * 0.9;
        }
      });

      const demand = dailyDemand.get(dayStr) || 0;

      totalIntakeBirds += intakeBirds;
      totalRmFlKg += originalSupplyKg;

      const cuttingStaff = demand > 0 ? (dailyStaff.get(dayStr) || 0) / 10 : 0;
      const supportStaff = demand > 0 ? 28 : 0;

      mpsDailiesToSave.push(this.mpsDailyRepo.create({
        mpsPlan: plan,
        productionDate: new Date(dayStr),
        intakeBirds: intakeBirds,
        rmFlAvailKg: originalSupplyKg,
        demandKg: demand,
        cuttingStaff: Math.ceil(cuttingStaff),
        supportStaff,
        totalStaff: Math.ceil(cuttingStaff + supportStaff)
      }));
    }

    await this.mpsDailyRepo.save(mpsDailiesToSave, { chunk: 500 });

    // Step 7: Generate Detailed Supply Breakdown (Size Distribution)
    const mpsSuppliesToSave: MpsPlanSupply[] = [];
    // Reuse weightMatrix from Step 5

    for (let i = 1; i <= daysInMonth; i++) {
      const dayStr = `${targetMonth}-${i.toString().padStart(2, '0')}`;

      let dailyIntakeBirds = 0;
      let dailyTotalWeight = 0;

      allIntakes.forEach((intake: any) => {
        const d = parseLocalDate(intake.receive_date);
        if (d === dayStr) {
          dailyIntakeBirds += Number(intake.chicken_count || 0);
          dailyTotalWeight += Number(intake.chicken_weight || 0);
        }
      });

      if (dailyIntakeBirds > 0) {
        const avgWeight = parseFloat((dailyTotalWeight / dailyIntakeBirds).toFixed(2)); // ปรับทศนิยม 2 ตำแหน่งเพื่อแก้บัค Range
        // Slaughtered Weight = Weight * 0.9575 * 0.95 (Based on user loss factors: 4.25% loss + 5% loss)
        const slaughteredWeight = dailyTotalWeight * 0.9575 * 0.95;

        // Find matching row in matrix
        // Logic: Matrix labels might be "2.40-2.50" or "2.4"
        const matchingRows = weightMatrix.filter(row => {
          const label = row.rowLabel;
          if (label.includes('-')) {
            const parts = label.split('-').map(s => parseFloat(s.trim()));
            const min = parts[0];
            const max = parts[1];
            return avgWeight >= min && avgWeight <= max;
          }
          return Math.abs(Number(label) - avgWeight) < 0.05; // Fallback for single values
        });

        const supplyEntry = this.mpsSupplyRepo.create({
          mpsPlan: plan,
          productionDate: new Date(dayStr),
          intakeBirds: dailyIntakeBirds,
          totalWeight: dailyTotalWeight,
          avgWeight: parseFloat(avgWeight.toFixed(2)), // ทศนิยม 2 ตำแหน่งตามที่ขอ
          slaughteredWeight: slaughteredWeight,
          size40Down: 0,
          size40_45: 0,
          size45_50: 0,
          size50_55: 0,
          size55_60: 0,
          size60_65: 0,
          size65_70: 0,
          size70_up: 0
        });

        matchingRows.forEach(row => {
          const pct = Number(row.distValue || 0);
          if (pct <= 0) return;

          // สูตร: Slaughtered Weight * 4% (Fillet Yield) * % ใน Cell * 90%
          const kg = Math.round(slaughteredWeight * 0.04 * pct * 0.9);

          // หา Group จากการชน colLabel กับตาราง fillet_size_calc
          const groupName = filletMap.get(row.colLabel);
          if (groupName) {
            const key = groupName.replace(/\s+/g, '').replace(/-/g, '_');
            if (key === '40Down') supplyEntry.size40Down += kg;
            else if (key === '40_45') supplyEntry.size40_45 += kg;
            else if (key === '45_50') supplyEntry.size45_50 += kg;
            else if (key === '50_55') supplyEntry.size50_55 += kg;
            else if (key === '55_60') supplyEntry.size55_60 += kg;
            else if (key === '60_65') supplyEntry.size60_65 += kg;
            else if (key === '65_70') supplyEntry.size65_70 += kg;
            else if (key === '70Up') supplyEntry.size70_up += kg;
          }
        });

        mpsSuppliesToSave.push(supplyEntry);
      }
    }

    if (mpsSuppliesToSave.length > 0) {
      await this.mpsSupplyRepo.save(mpsSuppliesToSave, { chunk: 500 });
    }

    plan.totalIntakeBirds = totalIntakeBirds;
    plan.totalRmFlKg = totalRmFlKg;
    plan.totalDemandKg = totalDemandKg;
    await this.mpsPlanRepo.save(plan);

    return { success: true, planId: plan.id, status: plan.status };
  }

  // 4. List all MPS Plans
  @Get('plans')
  async getPlans() {
    return this.mpsPlanRepo.find({
      order: {
        createdAt: 'DESC'
      }
    });
  }

  // 5. Delete an MPS Plan
  @Post('plans/:id/delete')
  async deletePlan(@Body() body: any, @Param('id') id: number) {
    const plan = await this.mpsPlanRepo.findOne({ where: { id } });
    if (!plan) return { success: false, message: 'Plan not found' };
    if (plan.status === 'APPROVED') {
      return { success: false, message: 'Cannot delete an approved plan. Reject it first.' };
    }
    await this.mpsPlanRepo.remove(plan);
    return { success: true };
  }

  @Get('plans/:id')
  async getPlan(@Param('id') id: number) {
    // 1. Fetch Plan with small relations first
    const plan = await this.mpsPlanRepo.findOne({
      where: { id },
      relations: ['dailySummaries', 'exceptions', 'supplyBreakdown']
    });

    if (!plan) {
      return { success: false, message: 'Plan not found' };
    }

    // 2. Fetch Orders separately to avoid heavy join and serialization crash
    // This also avoids circular references by default
    const orders = await this.mpsOrderRepo.find({
      where: { mpsPlan: { id: plan.id } }
    });

    plan.orders = orders;

    // Safety: Ensure no leftover circular refs in other relations
    if (plan.dailySummaries) plan.dailySummaries.forEach(d => delete (d as any).mpsPlan);
    if (plan.supplyBreakdown) plan.supplyBreakdown.forEach(s => delete (s as any).mpsPlan);
    if (plan.exceptions) plan.exceptions.forEach(e => delete (e as any).mpsPlan);

    return { success: true, data: plan };
  }

  // 7. Approve an MPS Plan (locks the plan from further edits)
  @Post('plans/:id/approve')
  async approvePlan(@Param('id') id: number) {
    const plan = await this.mpsPlanRepo.findOne({ where: { id } });
    if (!plan) return { success: false, message: 'Plan not found' };
    if (plan.status === 'APPROVED') return { success: false, message: 'Plan is already approved' };

    plan.status = 'APPROVED';
    await this.mpsPlanRepo.save(plan);
    return { success: true, message: 'Plan approved and locked' };
  }

  // 8. Reject / Revert an approved plan back to DRAFT
  @Post('plans/:id/reject')
  async rejectPlan(@Param('id') id: number) {
    const plan = await this.mpsPlanRepo.findOne({ where: { id } });
    if (!plan) return { success: false, message: 'Plan not found' };

    plan.status = 'DRAFT';
    await this.mpsPlanRepo.save(plan);
    return { success: true, message: 'Plan reverted to draft' };
  }

  // 9. Get Approved Orders for DPS (Daily Production Scheduling)
  @Get('approved-orders/:date')
  async getApprovedOrdersForDate(@Param('date') date: string) {
    const orders = await this.mpsOrderRepo.createQueryBuilder('order')
      .leftJoinAndSelect('order.mpsPlan', 'plan')
      .where('plan.status = :status', { status: 'APPROVED' })
      .andWhere('order.planned_production_date = :date', { date })
      .getMany();
    return orders;
  }

  // 10. Update Order Priorities (Batch)
  @Post('update-priorities')
  async updatePriorities(@Body() body: { priorities: { lineId: number; priority: number | null }[] }) {
    if (!body.priorities || !Array.isArray(body.priorities)) {
      return { success: false, message: 'Invalid input' };
    }

    for (const item of body.priorities) {
      await this.orderLineRepo.update(
        { erpOrderLineId: item.lineId },
        { priority: item.priority === null ? undefined : item.priority } as any
      );
    }

    return { success: true, updated: body.priorities.length };
  }
}

