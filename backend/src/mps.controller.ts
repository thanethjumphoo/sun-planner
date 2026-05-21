import { Controller, Post, Body, Get, Param, Res, Query } from '@nestjs/common';
import * as express from 'express';
import * as ExcelJS from 'exceljs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource, In } from 'typeorm';
import { StgErpOrderLine } from './stg-erp-order-line.entity';
import { StgErpOrderHeader } from './stg-erp-order-header.entity';
import { ProductSpec } from './product-spec.entity';
import { MpsPlan, MpsPlanDaily, MpsPlanOrder } from './mps-plan.entity';
import { MpsPlanSupply } from './mps-plan-supply.entity';
import { MpsPlanSupplySize } from './mps-plan-supply-size.entity';
import { WeightDistribution } from './weight-distribution.entity';
import { BilWeightDistribution } from './bil-weight-distribution.entity';
import { FilletSizeCalc, FilletConfig } from './fillet-size.entity';
import { MpsExceptionReport } from './mps-exception.entity';
import { ChickenReceivingService } from './chicken-receiving/chicken-receiving.service';
import { ChickenReceivingWeeklySize } from './chicken-receiving/entities/weekly-size.entity';
import { ManualOperation } from './manual-operation.entity';
import { StgErpItem } from './stg-erp-item.entity';
import { MasterYield } from './master-yield.entity';
import { MachineConfig } from './machine-config.entity';

@Controller('api/mps')
export class MpsController {
  constructor(
    private dataSource: DataSource,
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
    @InjectRepository(BilWeightDistribution)
    private bilWeightDistRepo: Repository<BilWeightDistribution>,
    @InjectRepository(MpsExceptionReport)
    private exceptionRepo: Repository<MpsExceptionReport>,
    @InjectRepository(FilletSizeCalc)
    private filletSizeRepo: Repository<FilletSizeCalc>,
    @InjectRepository(FilletConfig)
    private filletConfigRepo: Repository<FilletConfig>,
    @InjectRepository(ManualOperation)
    private manualOpRepo: Repository<ManualOperation>,
    @InjectRepository(StgErpItem)
    private itemRepo: Repository<StgErpItem>,
    @InjectRepository(MasterYield)
    private masterYieldRepo: Repository<MasterYield>,
    @InjectRepository(MpsPlanSupplySize)
    private mpsSupplySizeRepo: Repository<MpsPlanSupplySize>,
    @InjectRepository(ChickenReceivingWeeklySize)
    private weeklySizeRepo: Repository<ChickenReceivingWeeklySize>,
    @InjectRepository(MachineConfig)
    private machineConfigRepo: Repository<MachineConfig>,
    private chickenReceivingService: ChickenReceivingService,
  ) { }

  // Helper: Get allowed item codes by partType using Master Yield Tree CATEGORY
  private async getItemCodesByPartType(partType: string): Promise<string[] | null> {
    const categoryMap: Record<string, string[]> = {
      'fillet': ['สันใน'],
      'bil': ['BIL L/C'],
    };
    const categoryNames = categoryMap[partType];
    if (!categoryNames) return null;

    const allNodes = await this.masterYieldRepo.find();
    const nodeIds: string[] = [];

    const collectTree = (parentId: string) => {
      const children = allNodes.filter(n => n.parentId === parentId);
      for (const child of children) {
        nodeIds.push(child.id);
        collectTree(child.id);
      }
    };

    for (const name of categoryNames) {
      const matches = allNodes.filter(n => n.type === 'CATEGORY' && n.name === name);
      for (const m of matches) {
        nodeIds.push(m.id);
        collectTree(m.id);
      }
    }

    if (nodeIds.length === 0) return null;

    const specs = await this.specRepo.find();
    const codes = specs
      .filter(s => {
        if (!s.masterYieldIds) return false;
        const ids = s.masterYieldIds.split(',').map(id => id.trim());
        return ids.some(id => nodeIds.includes(id));
      })
      .map(s => s.erpItemCode);

    return codes.length > 0 ? codes : null;
  }

  private async getItemCodesByProcessName(categoryName: string, processName: string): Promise<string[]> {
    const allNodes = await this.masterYieldRepo.find();
    
    // Find category node
    const catNodes = allNodes.filter(n => n.type === 'CATEGORY' && n.name === categoryName);
    if (catNodes.length === 0) return [];

    // Find process node under category
    const processNodes = allNodes.filter(n => n.type === 'PROCESS' && n.name === processName && catNodes.some(c => c.id === n.parentId));
    if (processNodes.length === 0) return [];

    const nodeIds: string[] = [];
    const collectTree = (parentId: string) => {
      const children = allNodes.filter(n => n.parentId === parentId);
      for (const child of children) {
        nodeIds.push(child.id);
        collectTree(child.id);
      }
    };

    for (const p of processNodes) {
      nodeIds.push(p.id);
      collectTree(p.id);
    }

    if (nodeIds.length === 0) return [];

    const specs = await this.specRepo.find();
    const codes = specs
      .filter(s => {
        if (!s.masterYieldIds) return false;
        const ids = s.masterYieldIds.split(',').map(id => id.trim());
        return ids.some(id => nodeIds.includes(id));
      })
      .map(s => s.erpItemCode);

    return codes;
  }

  // 0. Get allowed item codes for a partType (used by Demand Plan tab to filter)
  @Get('allowed-items')
  async getAllowedItems(@Query('partType') partType: string) {
    const pt = partType || 'fillet';
    const codes = await this.getItemCodesByPartType(pt);
    return { partType: pt, itemCodes: codes || [] };
  }

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
            finishedProductionDate: planOrder.productType === 'chilled'
              ? new Date(body.date)
              : new Date(new Date(body.date).getTime() + 4 * 24 * 60 * 60 * 1000),
            isManualOverride: true
          });
          await this.mpsOrderRepo.save(splitOrder);
        } else {
          // Move whole order
          const newDate = new Date(body.date);
          planOrder.plannedProductionDate = newDate;
          planOrder.finishedProductionDate = planOrder.productType === 'chilled'
            ? newDate
            : new Date(newDate.getTime() + 4 * 24 * 60 * 60 * 1000);
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
        const newDate = new Date(body.date);
        planOrder.plannedProductionDate = newDate;
        planOrder.finishedProductionDate = planOrder.productType === 'chilled'
          ? newDate
          : new Date(newDate.getTime() + 4 * 24 * 60 * 60 * 1000);
        planOrder.isManualOverride = true;
        await this.mpsOrderRepo.save(planOrder);

        // Optionally update the source order line as well
        const line = await this.orderLineRepo.findOne({ where: { erpOrderLineId: body.lineId } });
        if (line) {
          const newDate = new Date(body.date);
          line.plannedProductionDate = newDate;
          line.finishedProductionDate = planOrder.productType === 'chilled'
            ? newDate
            : new Date(newDate.getTime() + 4 * 24 * 60 * 60 * 1000);
          await this.orderLineRepo.save(line);
        }

        return { success: true };
      }
    }

    // Fallback to original logic if planId is not provided
    const line = await this.orderLineRepo.findOne({ where: { erpOrderLineId: body.lineId } });
    if (line) {
      const newDate = new Date(body.date);
      line.plannedProductionDate = newDate;
      // We don't have spec here, but we can try to guess or just use plannedDate
      // For fallback, let's just use plannedDate for now or search spec
      line.finishedProductionDate = newDate;
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
      line.finishedProductionDate = type === 'chilled'
        ? plannedDate
        : new Date(plannedDate.getTime() + 4 * 24 * 60 * 60 * 1000);
      await this.orderLineRepo.save(line);
      allocatedCount++;
    }

    return { success: true, allocatedCount };
  }

  // 3. Generate & Snapshot MPS Plan
  @Post('generate')
  async generatePlan(@Body() body: { targetMonth: string; orderStartDate?: string; orderEndDate?: string; partType?: string; _allocatedMap?: Map<number, number> }) {
    const { targetMonth } = body;
    const partType = body.partType || 'fillet';
    
    // Fetch active machine configurations
    const machineConfigs = await this.machineConfigRepo.find({ where: { isActive: true } });
    const getMachineConfig = (key: string, defaults: any) => {
        const conf = machineConfigs.find(c => c.machineKey === key);
        if (!conf) return defaults;
        return {
            speed: Number(conf.capacityPcsPerHour),
            yield: Number(conf.yieldPercentage),
            lines: Number(conf.defaultLines),
            machinesPerLine: Number(conf.machinesPerLine),
            workers: Number(conf.workersPerUnit)
        };
    };

    return await this.dataSource.transaction(async (manager) => {
      const targetMonth = body.targetMonth;
      const partType = body.partType || 'fillet';

      // Step 1: Check for existing plans for this month (scoped by partType)
      // Block if an APPROVED plan already exists
      const existingApproved = await manager.findOne(MpsPlan, { where: { targetMonth, partType, status: 'APPROVED' } });
      if (existingApproved) {
        return { success: false, message: `An approved plan already exists for ${targetMonth}. Reject it first to regenerate.` };
      }

      let plan = await manager.findOne(MpsPlan, { where: { targetMonth, partType, status: 'DRAFT' } });
      if (plan) {
        // Clear old details
        await manager.delete(MpsPlanDaily, { mpsPlan: { id: plan.id } });
        await manager.delete(MpsPlanSupply, { mpsPlan: { id: plan.id } });
        await manager.delete(MpsPlanOrder, { mpsPlan: { id: plan.id } });
        await manager.delete(MpsExceptionReport, { mpsPlan: { id: plan.id } });
      } else {
        plan = manager.create(MpsPlan, {
          planName: `MPS ${targetMonth} - Draft`,
          targetMonth,
          partType,
          status: 'DRAFT',
        });
        plan = await manager.save(plan);
      }

      const allYieldNodes = await manager.find(MasterYield, {
      relations: ['children', 'children.children', 'children.children.children']
    });

    const findNode = (nodes: any[], id: string): any => {
      if (!nodes) return null;
      for (const n of nodes) {
        if (n.id === id) return n;
        if (n.children) {
          const found = findNode(n.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    const isByproductSpec = (spec: ProductSpec): boolean => {
      if (!spec || !spec.masterYieldIds) return false;
      const ids = spec.masterYieldIds.split(',').map(id => id.trim());
      return ids.some(id => {
        const node = findNode(allYieldNodes, id);
        return node && (node.type === 'BY-PRODUCT' || node.type === 'CO-PRODUCT');
      });
    };

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

    // Step 2: Fetch Orders & Specs using the custom date range (bound to transaction manager)
    const orders = await manager.find(StgErpOrderLine, {
      where: { erpOrderShipDate: Between(startOfRange, endOfRange) }
    });

    // Fetch order headers (filtered by unique header IDs to prevent Memory Bloat)
    const headerIds = [...new Set(orders.map(o => o.erpOrderHeaderId).filter(id => id !== null && id !== undefined))];
    
    // Fetch order headers in chunks of 1000 to avoid MS SQL 2100 parameter limit
    const orderHeaders: StgErpOrderHeader[] = [];
    if (headerIds.length > 0) {
      const headerChunkSize = 1000;
      for (let j = 0; j < headerIds.length; j += headerChunkSize) {
        const chunk = headerIds.slice(j, j + headerChunkSize);
        const chunkHeaders = await manager.find(StgErpOrderHeader, {
          where: { erpOrderHeaderId: In(chunk) }
        });
        orderHeaders.push(...chunkHeaders);
      }
    }

    const headerMap = new Map();
    const gradeMap = new Map();
    orderHeaders.forEach(h => {
      headerMap.set(h.erpOrderHeaderId, h.erpOrderNumber);
      gradeMap.set(h.erpOrderHeaderId, h.erpCustomerGrade);
    });

    const specs = await manager.find(ProductSpec);
    const specMap = new Map();
    specs.forEach(s => specMap.set(s.erpItemCode, s));

    // Filter item codes by partType using Master Yield Tree CATEGORY
    const allowedItemCodes = await this.getItemCodesByPartType(partType);

    let bilProcess1Codes: string[] = [];
    let bilProcess2Codes: string[] = [];
    if (partType === 'bil') {
      bilProcess1Codes = await this.getItemCodesByProcessName('BIL L/C', 'process: 1');
      bilProcess2Codes = await this.getItemCodesByProcessName('BIL L/C', 'process: 2');
    }

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

    // Step 3: Fetch Supply (Chicken Receiving Month + Previous Month Buffer)
    // Fetch Fillet Yield Config (bound to transaction manager)
    const configRow = await manager.findOne(FilletConfig, { where: { configKey: 'fillet_yield' } });
    const filletYield = configRow ? Number(configRow.configValue) : 0.04;

    let partYield = filletYield;
    if (partType === 'bil') {
      const bilNode = await manager.findOne(MasterYield, { where: { type: 'CATEGORY', name: 'BIL L/C' } });
      partYield = bilNode?.yieldPercentage ? Number(bilNode.yieldPercentage) : 0.25; // Default fallback if not found
    }

    // We use monthly plan to represent the actual supply for continuous mapping
    const allIntakesRaw = await this.chickenReceivingService.findAll('monthly');

    // Calculate previous month for cross-month supply buffer
    // Chill orders need production 1-3 days before ship date, freeze orders up to 30 days
    // So we need supply from the previous month to handle orders shipping early in the target month
    const prevMonthDate = new Date(targetDate.getFullYear(), targetDate.getMonth() - 1, 1);
    const prevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

    // Filter to target month + previous month (for cross-month supply matching)
    const allIntakesExpanded = allIntakesRaw.filter((intake: any) => {
      const d = parseLocalDate(intake.receive_date);
      return d && (d.startsWith(targetMonth) || d.startsWith(prevMonth));
    });

    // Keep a target-month-only filter for daily summaries and supply breakdown (Steps 6 & 7)
    const allIntakes = allIntakesRaw.filter((intake: any) => {
      const d = parseLocalDate(intake.receive_date);
      return d && d.startsWith(targetMonth);
    });

    const supplyMap = new Map<string, number>();
    allIntakesExpanded.forEach((intake: any) => {
      const d = parseLocalDate(intake.receive_date);
      if (d) {
        const intakeKg = Number(intake.chicken_weight || 0);
        // Formula matching the previous system mapping logic
        // Formula for Fillet: Slaughtered Weight * Fillet Yield * 90.7% (to match Net Fillet after 9.3% Grade B)
        // Formula for BIL: Slaughtered Weight * partYield
        const rmAvailKg = partType === 'fillet' 
          ? intakeKg * 0.9575 * 0.95 * filletYield * 0.907
          : intakeKg * 0.9575 * 0.95 * partYield;
        supplyMap.set(d, (supplyMap.get(d) || 0) + rmAvailKg);
      }
    });

    const mainChillOrders: any[] = [];
    const mainFreezeOrders: any[] = [];
    const byprodChillOrders: any[] = [];
    const byprodFreezeOrders: any[] = [];

    for (const order of orders) {
      const spec = specMap.get(order.erpOrderItemCode);
      if (!spec) continue;

      // Skip orders not in this part's allowed item codes (Master Yield Tree filter)
      if (allowedItemCodes && !allowedItemCodes.includes(order.erpOrderItemCode)) continue;

      // Adjust quantity for already-allocated amounts (cross-month dedup)
      let adjustedQty = Number(order.erpOrderItemQty || 0);
      if (body._allocatedMap?.has(order.erpOrderLineId)) {
        adjustedQty -= body._allocatedMap.get(order.erpOrderLineId)!;
        if (adjustedQty <= 0) continue; // fully allocated in a previous month
      }

      const orderObj = {
        ...order,
        productType: spec.productType,
        qty: adjustedQty,
        shipDate: new Date(order.erpOrderShipDate)
      };

      const isByprod = isByproductSpec(spec);

      if (orderObj.productType === 'chilled') {
        if (isByprod) {
          byprodChillOrders.push(orderObj);
        } else {
          mainChillOrders.push(orderObj);
        }
      } else {
        if (isByprod) {
          byprodFreezeOrders.push(orderObj);
        } else {
          mainFreezeOrders.push(orderObj);
        }
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
    mainChillOrders.sort(prioritySort);
    mainFreezeOrders.sort(prioritySort);

    // Step 3b: Build per-date SIZE supply map (shared by Chill & Freeze allocation)
    // ─────────────────────────────────────────────────────────────────────────────
    const isBil = partType === 'bil';
    const weightMatrix = isBil ? await this.bilWeightDistRepo.find() : await this.weightDistRepo.find();
    const filletCalcs = await this.filletSizeRepo.find();
    const filletMap = new Map<string, string>(); // colLabel -> groupName
    if (!isBil) {
      filletCalcs.forEach(c => {
        if (c.groupName) filletMap.set(c.colLabel, c.groupName);
      });
    }

    // ── DEBUG: Diagnose size doubling ──────────────────────────────────────────
    const uniqueRowLabels = [...new Set(weightMatrix.map(r => r.rowLabel))];
    const uniqueColLabels = [...new Set(weightMatrix.map(r => r.colLabel))];
    console.log(`[MPS DEBUG] weightMatrix total rows: ${weightMatrix.length}`);
    console.log(`[MPS DEBUG] unique rowLabels: ${uniqueRowLabels.length}, unique colLabels: ${uniqueColLabels.length}`);
    console.log(`[MPS DEBUG] expected rows (rowLabels × colLabels): ${uniqueRowLabels.length * uniqueColLabels.length}`);
    // Check for duplicates: same rowLabel + colLabel appearing more than once
    const keyCount = new Map<string, number>();
    weightMatrix.forEach(r => {
      const k = `${r.rowLabel}|${r.colLabel}`;
      keyCount.set(k, (keyCount.get(k) || 0) + 1);
    });
    const duplicates = [...keyCount.entries()].filter(([, cnt]) => cnt > 1);
    if (duplicates.length > 0) {
      console.log(`[MPS DEBUG] ⚠️ DUPLICATE weight_distributions found: ${duplicates.length} keys have duplicates`);
      duplicates.slice(0, 5).forEach(([k, cnt]) => console.log(`  -> ${k} appears ${cnt} times`));
    }
    // Check sum of distValues per rowLabel (should be ~1.0 for 100%)
    const rowSums = new Map<string, number>();
    weightMatrix.forEach(r => {
      rowSums.set(r.rowLabel, (rowSums.get(r.rowLabel) || 0) + Number(r.distValue || 0));
    });
    console.log(`[MPS DEBUG] distValue sums per rowLabel:`);
    rowSums.forEach((sum, label) => console.log(`  ${label}: ${sum.toFixed(4)}`));
    console.log(`[MPS DEBUG] filletMap size: ${filletMap.size}, filletCalcs total: ${filletCalcs.length}`);
    console.log(`[MPS DEBUG] filletYield: ${filletYield}`);
    // ── END DEBUG ─────────────────────────────────────────────────────────────

    const sizeSupplyMap = new Map<string, { total: number, bins: Record<string, number> }>();

    // Use expanded intakes (includes previous month) for size supply map
    allIntakesExpanded.forEach((intake: any) => {
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
        bins: {}
      };

      matchingRows.forEach(row => {
        const pct = Number(row.distValue || 0);
        if (pct <= 0) return;

        // distValue is already stored as a decimal fraction (e.g. 0.0216 = 2.16%)
        const kg = isBil 
          ? Math.round(slaughteredWeight * partYield * pct)
          : Math.round(slaughteredWeight * filletYield * pct * 0.907);

        // Get group from manual assignment map or use colLabel directly for BIL
        const groupName = isBil ? row.colLabel : filletMap.get(row.colLabel);
        if (groupName) {
          // Map group name to bin key
          const key = isBil ? groupName : groupName.replace(/\s+/g, '').replace(/-/g, '_');
          existing.bins[key] = (existing.bins[key] || 0) + kg;
        }
      });

      existing.total += Object.values(existing.bins).reduce((a, b) => a + b, 0);

      sizeSupplyMap.set(d, existing);
    });

    // Rebuild supplyMap from actual size bin totals (instead of formula-based RM FL)
    // This eliminates rounding discrepancy between RM FL formula and sum-of-size-bins
    const originalSizeTotalMap = new Map<string, number>(); // snapshot BEFORE allocation
    sizeSupplyMap.forEach((sizeData, dateStr) => {
      const binTotal = Object.values(sizeData.bins).reduce((sum, val) => sum + val, 0);
      if (binTotal > 0) {
        supplyMap.set(dateStr, binTotal);
        originalSizeTotalMap.set(dateStr, binTotal);
      }
    });

    // Helper: Map productSize from Spec → size bin key(s)
    const getSizeBinKeys = (productSize: string): string[] => {
      if (!productSize) return [];
      const s = productSize.toLowerCase().trim();
      if (s === 'unsize' || s === '') return []; // unsize matches all — handled separately
      
      if (isBil) {
        // 1. Try exact match first
        const exactMatch = uniqueColLabels.find(label => label.toLowerCase().trim() === s);
        if (exactMatch) return [exactMatch];

        // 2. Parse productSize as range (e.g. "280-300")
        const rangeMatch = s.match(/(\d+)\s*[-–]\s*(\d+)/);
        if (rangeMatch) {
          const lo = parseInt(rangeMatch[1]);
          const hi = parseInt(rangeMatch[2]);

          const allBilBins = uniqueColLabels.map(label => {
            const lblLower = label.toLowerCase().trim();
            if (lblLower.includes('down')) {
              const val = parseInt(lblLower.replace(/[^\d]/g, ''));
              return { label, lo: 0, hi: val };
            }
            if (lblLower.includes('up')) {
              const val = parseInt(lblLower.replace(/[^\d]/g, ''));
              return { label, lo: val, hi: 9999 };
            }
            const bounds = lblLower.split('-').map(str => parseInt(str.trim()));
            if (bounds.length === 2 && !isNaN(bounds[0]) && !isNaN(bounds[1])) {
              return { label, lo: bounds[0], hi: bounds[1] };
            }
            return null;
          }).filter((b): b is { label: string; lo: number; hi: number } => b !== null);

          // Find overlapping bins
          const matched = allBilBins.filter(b => b.hi > lo && b.lo < hi).map(b => b.label);
          if (matched.length > 0) return matched;
        }

        // Fallback: return productSize as-is if no range could be parsed
        return [productSize];
      }

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

    const mpsOrdersToSave: MpsPlanOrder[] = [];
    const exceptionsToSave: any[] = [];
    let totalDemandKg = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Step 4: Map CHILL Orders First (Flexible Lead Time: Ship Date -1 to -3 Days) — WITH Size Matching
    for (const order of mainChillOrders) {
      totalDemandKg += order.qty;
      let remainingQty = order.qty;

      const spec = specMap.get(order.erpOrderItemCode);
      const productSize = spec?.productSize || '';
      const sizeBinKeys = getSizeBinKeys(productSize);
      const isUnsize = sizeBinKeys.length === 0;

      // Try to find supply starting from Ship Date - 1 backwards to Ship Date - 3
      for (let d = subtractDays(order.shipDate, 1); d >= subtractDays(order.shipDate, 3); d = subtractDays(d, 1)) {
        if (remainingQty <= 0) break;

        const dateStr = formatDate(d);
        const totalRmForDate = supplyMap.get(dateStr) || 0;
        if (totalRmForDate <= 0) continue;

        const sizeData = sizeSupplyMap.get(dateStr);

        let availableQty = 0;
        if (!isUnsize && sizeData) {
          // Sum available from matching size bins only
          availableQty = sizeBinKeys.reduce((sum, key) => sum + (sizeData.bins[key] || 0), 0);
        } else {
          // Unsize or no size data available: use whatever RM is left
          availableQty = totalRmForDate;
        }

        if (availableQty <= 0) continue;

        const allocQty = Math.round(Math.min(availableQty, remainingQty, totalRmForDate));
        if (allocQty <= 0) continue;

        mpsOrdersToSave.push(manager.create(MpsPlanOrder, {
          mpsPlan: plan,
          erpOrderLineId: order.erpOrderLineId,
          soNumber: headerMap.get(order.erpOrderHeaderId) || order.erpOrderHeaderId?.toString(),
          itemCode: order.erpOrderItemCode,
          itemDesc: specMap.get(order.erpOrderItemCode)?.erpItemDesc || order.erpOrderItemCode,
          productType: order.productType,
          quantityKg: allocQty,
          shipDate: order.shipDate,
          plannedProductionDate: d,
          finishedProductionDate: d,
          isManualOverride: false
        }));

        // Deduct from both supply maps
        supplyMap.set(dateStr, totalRmForDate - allocQty);
        if (sizeData) {
          sizeData.total -= allocQty;
          if (!isUnsize) {
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
        // Discard unmet demand from calendar, log as exception
        exceptionsToSave.push(manager.create(MpsExceptionReport, {
          mpsPlan: plan,
          erpOrderLineId: order.erpOrderLineId,
          soNumber: headerMap.get(order.erpOrderHeaderId) || order.erpOrderHeaderId?.toString() || '-',
          itemCode: order.erpOrderItemCode,
          shipDate: order.shipDate,
          requiredKg: order.qty,
          shortageKg: remainingQty,
          reason: `No ${isUnsize ? 'total' : productSize} supply available for Chill order on or before ${formatDate(order.shipDate)}`
        }));
      }
    }

    // Step 5: Map FREEZE Orders — Waterfall FIFO with Size Matching
    // ─────────────────────────────────────────────────────────────
    // (sizeSupplyMap, getSizeBinKeys already built in Step 3b above)

    // 5c. Sort freeze orders: Ship Date ASC → Grade ASC → SO Number ASC → Priority ASC
    mainFreezeOrders.sort((a: any, b: any) => {
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


    // 5e. Collect all available dates with cross-month buffer, sorted ascending
    // Include previous month dates (up to 30 days back) for freeze orders
    // and 3 days back for chill orders whose production falls before the target month
    const addDays = (date: Date, days: number) => {
      const d = new Date(date);
      d.setDate(d.getDate() + days);
      return d;
    };
    const supplyBufferStart = subtractDays(startOfMonth, 30); // 30-day buffer for freeze lead time
    const allDateStrs: string[] = [];
    for (let d = new Date(supplyBufferStart); d <= endOfMonth; d = addDays(d, 1)) {
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

          mpsOrdersToSave.push(manager.create(MpsPlanOrder, {
            mpsPlan: plan,
            erpOrderLineId: order.erpOrderLineId,
            soNumber: headerMap.get(order.erpOrderHeaderId) || order.erpOrderHeaderId?.toString(),
            itemCode: order.erpOrderItemCode,
            itemDesc: specMap.get(order.erpOrderItemCode)?.erpItemDesc || order.erpOrderItemCode,
            productType: order.productType,
            quantityKg: allocQty,
            shipDate: order.shipDate,
            plannedProductionDate: dateObj,
            finishedProductionDate: new Date(dateObj.getTime() + 4 * 24 * 60 * 60 * 1000),
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
          exceptionsToSave.push(manager.create(MpsExceptionReport, {
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
    allocateFreeze(mainFreezeOrders, true);

    // --- Allocate By-Products Orders ---
    // 1. Calculate generated byproduct supply from main product allocations
    const dailyByproductSupply = new Map<string, Record<string, { name: string; qty: number; processName: string }>>();

    const getOrInitByproductSupply = (dateStr: string) => {
      if (!dailyByproductSupply.has(dateStr)) {
        dailyByproductSupply.set(dateStr, {});
      }
      return dailyByproductSupply.get(dateStr)!;
    };

    mpsOrdersToSave.forEach(order => {
      const spec = specMap.get(order.itemCode);
      if (spec && !isByproductSpec(spec) && spec.masterYieldIds) {
        const yieldPct = spec.productYield || 1;
        const rm = order.quantityKg / yieldPct;
        const processIds = spec.masterYieldIds.split(',').map((id: any) => id.trim());
        const pId = processIds[0];
        if (pId) {
          const node = findNode(allYieldNodes, pId);
          if (node) {
            const processNode = node.parentId ? findNode(allYieldNodes, node.parentId) : node;
            if (processNode && processNode.children) {
              const daySupply = getOrInitByproductSupply(formatDate(order.plannedProductionDate));
              processNode.children.forEach((child: any) => {
                if (child.id === pId) return;
                if (child.type === 'BY-PRODUCT' || child.type === 'CO-PRODUCT') {
                  const byProdQty = rm * (child.yieldPercentage || 0);
                  if (byProdQty > 0) {
                    if (!daySupply[child.id]) {
                      daySupply[child.id] = {
                        name: child.name,
                        qty: 0,
                        processName: processNode.name || 'Other Process'
                      };
                    }
                    daySupply[child.id].qty += byProdQty;
                  }
                }
              });
            }
          }
        }
      }
    });

    // 2. Allocate Byproduct CHILL Orders
    for (const order of byprodChillOrders) {
      totalDemandKg += order.qty;
      let remainingQty = order.qty;

      const spec = specMap.get(order.erpOrderItemCode);
      const bpId = spec?.masterYieldIds?.split(',').map((id: any) => id.trim())[0];

      if (bpId) {
        for (let d = subtractDays(order.shipDate, 1); d >= subtractDays(order.shipDate, 3); d = subtractDays(d, 1)) {
          if (remainingQty <= 0) break;

          const dateStr = formatDate(d);
          const daySupply = dailyByproductSupply.get(dateStr);
          const bpSupply = daySupply && daySupply[bpId] ? daySupply[bpId].qty : 0;

          if (bpSupply <= 0) continue;

          const allocQty = Math.round(Math.min(bpSupply, remainingQty));
          if (allocQty <= 0) continue;

          mpsOrdersToSave.push(manager.create(MpsPlanOrder, {
            mpsPlan: plan,
            erpOrderLineId: order.erpOrderLineId,
            soNumber: headerMap.get(order.erpOrderHeaderId) || order.erpOrderHeaderId?.toString(),
            itemCode: order.erpOrderItemCode,
            itemDesc: specMap.get(order.erpOrderItemCode)?.erpItemDesc || order.erpOrderItemCode,
            productType: order.productType,
            quantityKg: allocQty,
            shipDate: order.shipDate,
            plannedProductionDate: d,
            finishedProductionDate: d,
            isManualOverride: false
          }));

          daySupply![bpId].qty -= allocQty;
          remainingQty -= allocQty;
        }
      }

      if (remainingQty > 0) {
        exceptionsToSave.push(manager.create(MpsExceptionReport, {
          mpsPlan: plan,
          erpOrderLineId: order.erpOrderLineId,
          soNumber: headerMap.get(order.erpOrderHeaderId) || order.erpOrderHeaderId?.toString() || '-',
          itemCode: order.erpOrderItemCode,
          shipDate: order.shipDate,
          requiredKg: order.qty,
          shortageKg: remainingQty,
          reason: `Insufficient byproduct supply for Chill byproduct order on or before ${formatDate(order.shipDate)}`
        }));
      }
    }

    // 3. Allocate Byproduct FREEZE Orders
    const allocateByprodFreeze = (orderList: any[]) => {
      for (const order of orderList) {
        totalDemandKg += order.qty;
        let remainingQty = order.qty;

        const spec = specMap.get(order.erpOrderItemCode);
        const bpId = spec?.masterYieldIds?.split(',').map((id: any) => id.trim())[0];

        if (bpId) {
          const latestProdDate = subtractDays(order.shipDate, 5);
          const earliestProdDate = subtractDays(order.shipDate, 30);

          for (const dateStr of allDateStrs) {
            if (remainingQty <= 0) break;
            const dateObj = new Date(dateStr + 'T00:00:00');
            if (dateObj < earliestProdDate || dateObj > latestProdDate) continue;

            const daySupply = dailyByproductSupply.get(dateStr);
            const bpSupply = daySupply && daySupply[bpId] ? daySupply[bpId].qty : 0;

            if (bpSupply <= 0) continue;

            const allocQty = Math.round(Math.min(bpSupply, remainingQty));
            if (allocQty <= 0) continue;

            mpsOrdersToSave.push(manager.create(MpsPlanOrder, {
              mpsPlan: plan,
              erpOrderLineId: order.erpOrderLineId,
              soNumber: headerMap.get(order.erpOrderHeaderId) || order.erpOrderHeaderId?.toString(),
              itemCode: order.erpOrderItemCode,
              itemDesc: specMap.get(order.erpOrderItemCode)?.erpItemDesc || order.erpOrderItemCode,
              productType: order.productType,
              quantityKg: allocQty,
              shipDate: order.shipDate,
              plannedProductionDate: dateObj,
              finishedProductionDate: new Date(dateObj.getTime() + 4 * 24 * 60 * 60 * 1000),
              isManualOverride: false
            }));

            daySupply![bpId].qty -= allocQty;
            remainingQty -= allocQty;
          }
        }

        if (remainingQty > 0) {
          exceptionsToSave.push(manager.create(MpsExceptionReport, {
            mpsPlan: plan,
            erpOrderLineId: order.erpOrderLineId,
            soNumber: headerMap.get(order.erpOrderHeaderId) || order.erpOrderHeaderId?.toString() || '-',
            itemCode: order.erpOrderItemCode,
            shipDate: order.shipDate,
            requiredKg: order.qty,
            shortageKg: remainingQty,
            reason: `Insufficient byproduct supply for Freeze byproduct order (Ship: ${formatDate(order.shipDate)})`
          }));
        }
      }
    };

    byprodFreezeOrders.sort(prioritySort);
    allocateByprodFreeze(byprodFreezeOrders);

    // Chunk manual save in safe batches of 50 to avoid MS SQL 2100 parameter limit
    if (mpsOrdersToSave.length > 0) {
      const saveChunkSize = 50;
      for (let k = 0; k < mpsOrdersToSave.length; k += saveChunkSize) {
        await manager.save(mpsOrdersToSave.slice(k, k + saveChunkSize));
      }
    }

    if (exceptionsToSave.length > 0) {
      const saveChunkSize = 50;
      for (let k = 0; k < exceptionsToSave.length; k += saveChunkSize) {
        await manager.save(exceptionsToSave.slice(k, k + saveChunkSize));
      }
    }

    // Step 6: Generate Daily Summaries for the Month
    const mpsDailiesToSave: MpsPlanDaily[] = [];
    let totalIntakeBirds = 0;
    let totalRmFlKg = 0;

    const dailyDemand = new Map<string, number>();
    const dailyDemandP1 = new Map<string, number>();
    const dailyDemandP2Thigh = new Map<string, number>();
    const dailyDemandP2Drum = new Map<string, number>();
    const dailyDemandP3 = new Map<string, number>();
    const dailyStaff = new Map<string, number>();

    mpsOrdersToSave.forEach(o => {
      const d = formatDate(o.plannedProductionDate);
      dailyDemand.set(d, (dailyDemand.get(d) || 0) + Number(o.quantityKg));
      
      const spec = specMap.get(o.itemCode);
      if (partType === 'bil') {
        if (bilProcess1Codes.includes(o.itemCode)) {
          dailyDemandP1.set(d, (dailyDemandP1.get(d) || 0) + Number(o.quantityKg));
        } else if (bilProcess2Codes.includes(o.itemCode)) {
          // Check if it's thigh or drumstick (usually by name, let's say "น่อง" in name means drumstick)
          const isDrum = spec && spec.erpItemDesc && spec.erpItemDesc.includes('น่อง') && !spec.erpItemDesc.includes('สะโพก');
          if (isDrum) {
            dailyDemandP2Drum.set(d, (dailyDemandP2Drum.get(d) || 0) + Number(o.quantityKg));
          } else {
            dailyDemandP2Thigh.set(d, (dailyDemandP2Thigh.get(d) || 0) + Number(o.quantityKg));
          }
        } else {
          dailyDemandP3.set(d, (dailyDemandP3.get(d) || 0) + Number(o.quantityKg));
        }
      }

      if (spec && !isByproductSpec(spec)) {
        const speed = Number(spec.productSpeed || 45);
        dailyStaff.set(d, (dailyStaff.get(d) || 0) + (Number(o.quantityKg) / speed));
      }
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
        }
      });
      // Use original (pre-allocation) size bin total for RM Available
      originalSupplyKg = originalSizeTotalMap.get(dayStr) || 0;
      let grossDemandKg = 0;
      let grossP1Kg = 0;
      let grossP2ThighKg = 0;
      let grossP2DrumKg = 0;

      mpsOrdersToSave.forEach(o => {
        if (formatDate(o.plannedProductionDate) === dayStr) {
          const spec = specMap.get(o.itemCode);
          if (spec && !isByproductSpec(spec)) {
            if (partType === 'bil') {
              if (bilProcess1Codes.includes(o.itemCode)) {
                const yieldPct = spec?.productYield ? Number(spec.productYield) : 1.0;
                grossP1Kg += Number(o.quantityKg) / yieldPct;
              } else if (bilProcess2Codes.includes(o.itemCode)) {
                const isDrum = spec && spec.erpItemDesc && spec.erpItemDesc.includes('น่อง') && !spec.erpItemDesc.includes('สะโพก');
                const yieldPct = spec?.productYield ? Number(spec.productYield) : (isDrum ? 0.4 : 0.6);
                if (isDrum) grossP2DrumKg += Number(o.quantityKg) / yieldPct;
                else grossP2ThighKg += Number(o.quantityKg) / yieldPct;
              } else {
                const yieldPct = spec?.productYield ? Number(spec.productYield) : 1.0;
                grossDemandKg += Number(o.quantityKg) / yieldPct;
              }
            } else {
               const yieldPct = spec?.productYield ? Number(spec.productYield) : 1.0;
               grossDemandKg += Number(o.quantityKg) / yieldPct;
            }
          }
        }
      });

      if (partType === 'bil') {
        const p2GrossDemand = Math.max(grossP2ThighKg, grossP2DrumKg);
        grossDemandKg += grossP1Kg + p2GrossDemand;
      }

      const demand = dailyDemand.get(dayStr) || 0;

      totalIntakeBirds += intakeBirds;
      totalRmFlKg += originalSupplyKg;

      let cuttingStaff = demand > 0 ? (dailyStaff.get(dayStr) || 0) / 10 : 0;
      let supportStaff = demand > 0 ? 28 : 0;

      if (partType === 'bil') {
        const demandP1 = dailyDemandP1.get(dayStr) || 0;
        
        const bilPiecesTotal = intakeBirds * 2;
        const avgPieceWeight = bilPiecesTotal > 0 ? originalSupplyKg / bilPiecesTotal : 0.3;
        
        let remainingPieces = bilPiecesTotal;

        // Priority 1: BIL Orders
        const piecesForP1 = avgPieceWeight > 0 ? demandP1 / avgPieceWeight : 0;
        remainingPieces = Math.max(0, remainingPieces - piecesForP1);

        // Priority 2: สะโพก + น่อง (Thigh + Drumstick)
        let requiredP1WorkersHours = 0;
        let requiredP2ThighPcs = 0;
        let requiredP2DrumPcs = 0;
        let separationWorkers = 0;

        mpsOrdersToSave.forEach(o => {
          if (formatDate(o.plannedProductionDate) === dayStr) {
            if (bilProcess1Codes.includes(o.itemCode)) {
              const spec = specMap.get(o.itemCode);
              const speed = spec?.productSpeed ? Number(spec.productSpeed) : 45;
              requiredP1WorkersHours += Number(o.quantityKg) / speed;
            } else if (bilProcess2Codes.includes(o.itemCode)) {
              const spec = specMap.get(o.itemCode);
              const isDrum = spec && spec.erpItemDesc && spec.erpItemDesc.includes('น่อง') && !spec.erpItemDesc.includes('สะโพก');
              const yieldPct = spec?.productYield ? Number(spec.productYield) : 0.5; // fallback to 50%
              const speed = spec?.productSpeed ? Number(spec.productSpeed) : 45;
              const pcs = avgPieceWeight > 0 && yieldPct > 0 ? Number(o.quantityKg) / (avgPieceWeight * yieldPct) : 0;
              
              if (isDrum) requiredP2DrumPcs += pcs;
              else requiredP2ThighPcs += pcs;
              
              separationWorkers += Number(o.quantityKg) / speed;
            }
          }
        });

        // We need to cut max(thigh pieces, drum pieces)
        const piecesToCutForP2 = Math.max(requiredP2ThighPcs, requiredP2DrumPcs);
        const actualPiecesCutP2 = Math.min(remainingPieces, piecesToCutForP2);
        remainingPieces = Math.max(0, remainingPieces - actualPiecesCutP2);

        // Calculate manpower for Process 1 and Process 2
        // Convert worker hours to workers (assume 9.58 hrs/shift)
        const p1CuttingStaff = Math.ceil(requiredP1WorkersHours / 9.58);
        const separationCuttingStaff = Math.ceil(separationWorkers / 9.58);

        // Priority 3: Debone to BL (using remaining pieces)
        const toridasConf = getMachineConfig('toridas', { speed: 1500, yield: 0.75, lines: 3, machinesPerLine: 4, workers: 5 });
        const foodmateConf = getMachineConfig('foodmate', { speed: 6000, yield: 0.70, lines: 1, machinesPerLine: 1, workers: 5 });
        const trimConf = getMachineConfig('trimming_belt', { speed: 600, yield: 1.0, lines: 3, machinesPerLine: 1, workers: 7 });
        const xrayConf = getMachineConfig('xray', { speed: 18700, yield: 1.0, lines: 3, machinesPerLine: 1, workers: 5 });

        const toridasCapPerShift = toridasConf.lines * toridasConf.machinesPerLine * toridasConf.speed * 9.58;
        const foodmateCapPerShift = foodmateConf.lines * foodmateConf.machinesPerLine * foodmateConf.speed * 9.58;
        const deboneCapPerShift = toridasCapPerShift + foodmateCapPerShift;

        let shiftsNeeded = 0;
        if (remainingPieces > 0) {
            if (remainingPieces <= toridasCapPerShift) {
                shiftsNeeded = 1;
            } else if (remainingPieces <= toridasCapPerShift * 2) {
                shiftsNeeded = 2;
            } else {
                shiftsNeeded = Math.ceil(remainingPieces / deboneCapPerShift);
                if (shiftsNeeded < 2) shiftsNeeded = 2;
            }
        }

        const piecesPerShift = shiftsNeeded > 0 ? Math.ceil(remainingPieces / shiftsNeeded) : 0;

        const toridasInputPcsPerShift = Math.min(piecesPerShift, toridasCapPerShift);
        const leftoverPcsPerShift = Math.max(0, piecesPerShift - toridasInputPcsPerShift);
        const foodmateInputPcsPerShift = Math.min(leftoverPcsPerShift, foodmateCapPerShift);

        const totalPcsProcessedPerShift = toridasInputPcsPerShift + foodmateInputPcsPerShift;

        const toridasOutputKg = (toridasInputPcsPerShift * shiftsNeeded * avgPieceWeight) * toridasConf.yield;
        const foodmateOutputKg = (foodmateInputPcsPerShift * shiftsNeeded * avgPieceWeight) * foodmateConf.yield;
        const totalBlOutputKg = toridasOutputKg + foodmateOutputKg;

        const toridasLinesNeeded = toridasInputPcsPerShift > 0 ? Math.ceil(toridasInputPcsPerShift / (toridasConf.machinesPerLine * toridasConf.speed * 9.58)) : 0;
        const foodmateLinesNeeded = foodmateInputPcsPerShift > 0 ? Math.ceil(foodmateInputPcsPerShift / (foodmateConf.machinesPerLine * foodmateConf.speed * 9.58)) : 0;

        const deboneManpower = (toridasLinesNeeded * toridasConf.workers + foodmateLinesNeeded * foodmateConf.workers) * shiftsNeeded;

        const trimmingSpeedPcsPerHr = trimConf.speed;
        const trimmingWorkHoursPerShift = totalPcsProcessedPerShift / trimmingSpeedPcsPerHr;
        const trimmingWorkers = Math.ceil(trimmingWorkHoursPerShift / 9.58) * shiftsNeeded;
        const trimLinesNeeded = Math.min(trimConf.lines, toridasLinesNeeded + foodmateLinesNeeded);
        const fixedTrimmingWorkers = totalPcsProcessedPerShift > 0 ? trimLinesNeeded * trimConf.workers * shiftsNeeded : 0;

        const xrayCapPerShift = xrayConf.speed * 9.58; // per machine
        const machinesNeededPerShift = totalPcsProcessedPerShift > 0 ? Math.ceil(totalPcsProcessedPerShift / xrayCapPerShift) : 0;
        const xrayManpower = Math.min(xrayConf.lines, machinesNeededPerShift) * xrayConf.workers * shiftsNeeded;

        // Total Cutting Staff = Process 1 Packing + Process 2 Separation + Process 3 Trimming
        cuttingStaff = p1CuttingStaff + separationCuttingStaff + trimmingWorkers;
        supportStaff = deboneManpower + fixedTrimmingWorkers + xrayManpower;

        // Save generated BL to daily byproducts
        if (totalBlOutputKg > 0) {
          const daySupply = getOrInitByproductSupply(dayStr);
          if (!daySupply['BL-DEBONE']) {
              daySupply['BL-DEBONE'] = {
                  name: 'BL (Debone)',
                  qty: 0,
                  processName: 'Debone Process'
              };
          }
          daySupply['BL-DEBONE'].qty += totalBlOutputKg;
        }
      }

      mpsDailiesToSave.push(manager.create(MpsPlanDaily, {
        mpsPlan: plan,
        productionDate: new Date(dayStr),
        intakeBirds: intakeBirds,
        rmFlAvailKg: originalSupplyKg,
        demandKg: grossDemandKg,
        cuttingStaff: Math.ceil(cuttingStaff),
        supportStaff,
        totalStaff: Math.ceil(cuttingStaff + supportStaff)
      }));
    }

    // Chunk manual save in safe batches of 50 to avoid MS SQL 2100 parameter limit
    if (mpsDailiesToSave.length > 0) {
      const saveChunkSize = 50;
      for (let k = 0; k < mpsDailiesToSave.length; k += saveChunkSize) {
        await manager.save(mpsDailiesToSave.slice(k, k + saveChunkSize));
      }
    }

    // Step 7: Generate Detailed Supply Breakdown (Size Distribution)
    // Now uses normalized mps_plan_supply_size table for size breakdown
    // IMPORTANT: Process each intake record INDIVIDUALLY (same as Step 3b)
    // to avoid boundary issues where a blended avgWeight matches two ranges.
    const mpsSuppliesToSave: MpsPlanSupply[] = [];

    // Determine part name from partType for labeling
    const partNameMap: Record<string, string> = {
      'fillet': 'สันใน',
      'bil': 'BIL L/C',
    };
    const currentPartName = partNameMap[partType] || partType;

    for (let i = 1; i <= daysInMonth; i++) {
      const dayStr = `${targetMonth}-${i.toString().padStart(2, '0')}`;

      // Gather all intake records for this day
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
        const avgWeightDaily = parseFloat((dailyTotalWeight / dailyIntakeBirds).toFixed(2));
        const slaughteredWeightDaily = dailyTotalWeight * 0.9575 * 0.95;

        // --- Retrieve Remaining By Products ---
        const daySupply = dailyByproductSupply.get(dayStr) || {};
        const byProductsStr = Object.keys(daySupply).length > 0 ? JSON.stringify(daySupply) : null;
        // -----------------------------

        const supplyEntry = manager.create(MpsPlanSupply, {
          mpsPlan: plan,
          productionDate: new Date(dayStr),
          intakeBirds: dailyIntakeBirds,
          totalWeight: dailyTotalWeight,
          avgWeight: parseFloat(avgWeightDaily.toFixed(2)),
          slaughteredWeight: slaughteredWeightDaily,
          byProducts: byProductsStr,
        });

        // Accumulate size bins — process EACH intake record individually
        // (same approach as Step 3b to avoid boundary mismatch)
        const sizeBins: Record<string, number> = {};

        dayIntakes.forEach((intake: any) => {
          const intakeKg = Number(intake.chicken_weight || 0);
          const intakeBirds = Number(intake.chicken_count || 0);
          if (intakeBirds <= 0 || intakeKg <= 0) return;

          const avgWeight = parseFloat((intakeKg / intakeBirds).toFixed(2));
          const slaughteredWeight = intakeKg * 0.9575 * 0.95;

          const matchingRows = weightMatrix.filter(row => {
            const label = row.rowLabel;
            if (label.includes('-')) {
              const parts = label.split('-').map(s => parseFloat(s.trim()));
              return avgWeight >= parts[0] && avgWeight <= parts[1];
            }
            return Math.abs(Number(label) - avgWeight) < 0.05;
          });
          matchingRows.forEach(row => {
            const pct = Number(row.distValue || 0);
            if (pct <= 0) return;

            // distValue is already stored as a decimal fraction (e.g. 0.0216 = 2.16%)
            const kg = isBil 
              ? Math.round(slaughteredWeight * partYield * pct)
              : Math.round(slaughteredWeight * filletYield * pct * 0.907);

            const groupName = isBil ? row.colLabel : filletMap.get(row.colLabel);
            if (groupName) {
              sizeBins[groupName] = (sizeBins[groupName] || 0) + kg;
            }
          });
        });

        // Create MpsPlanSupplySize entries for each size bin
        const sizeEntries: MpsPlanSupplySize[] = [];
        for (const [groupName, kg] of Object.entries(sizeBins)) {
          if (kg <= 0) continue;
          sizeEntries.push(manager.create(MpsPlanSupplySize, {
            groupSize: groupName,
            partName: currentPartName,
            quantityKg: Math.round(kg),
            productionDate: new Date(dayStr),
          }));
        }

        supplyEntry.sizes = sizeEntries;
        mpsSuppliesToSave.push(supplyEntry);
      }
    }

    // Chunk manual save in safe batches of 50 to avoid MS SQL 2100 parameter limit
    if (mpsSuppliesToSave.length > 0) {
      const saveChunkSize = 50;
      for (let k = 0; k < mpsSuppliesToSave.length; k += saveChunkSize) {
        await manager.save(mpsSuppliesToSave.slice(k, k + saveChunkSize));
      }
    }

    plan.totalIntakeBirds = totalIntakeBirds;
    plan.totalRmFlKg = totalRmFlKg;
    plan.totalDemandKg = totalDemandKg;
    await manager.save(plan);

    return { success: true, planId: plan.id, status: plan.status };
    });
  }

  // 3b. Generate MPS Plans for ALL months in a date range
  @Post('generate-range')
  async generateRange(@Body() body: { orderStartDate: string; orderEndDate: string; partType?: string }) {
    const { orderStartDate, orderEndDate } = body;
    const partType = body.partType || 'fillet';
    if (!orderStartDate || !orderEndDate) {
      return { success: false, message: 'orderStartDate and orderEndDate are required' };
    }

    // Compute all months covered by the order date range
    const start = new Date(`${orderStartDate}T00:00:00`);
    const end = new Date(`${orderEndDate}T23:59:59`);

    const months: string[] = [];
    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    while (current <= end) {
      const monthStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
      months.push(monthStr);
      current.setMonth(current.getMonth() + 1);
    }

    // Generate plans sequentially — pass FULL order range to each month.
    // Track allocated quantities so orders aren't double-counted across months.
    const allocatedMap = new Map<number, number>(); // lineId → total allocated kg
    const results: any[] = [];

    for (const month of months) {
      const result = await this.generatePlan({
        targetMonth: month,
        orderStartDate: body.orderStartDate,
        orderEndDate: body.orderEndDate,
        partType,
        _allocatedMap: new Map(allocatedMap), // pass a copy
      });

      // After generating, collect how much was allocated per order line
      if (result.success && result.planId) {
        const planOrders = await this.mpsOrderRepo.find({
          where: { mpsPlan: { id: result.planId } }
        });
        for (const po of planOrders) {
          const prev = allocatedMap.get(po.erpOrderLineId) || 0;
          allocatedMap.set(po.erpOrderLineId, prev + Number(po.quantityKg));
        }
      }

      results.push({ targetMonth: month, ...result });
    }

    return { success: true, results };
  }

  // 4. List all MPS Plans
  @Get('plans')
  async getPlans(@Query('partType') partType: string) {
    return this.mpsPlanRepo.find({
      where: { partType: partType || 'fillet' },
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

  @Get('plans/:id/weekly-sizes')
  async getWeeklySizesForPlan(@Param('id') id: number) {
    const plan = await this.mpsPlanRepo.findOne({ where: { id } });
    if (!plan) return { success: false, message: 'Plan not found' };

    const targetMonth = plan.targetMonth;
    const partType = plan.partType;
    const partNameMap: Record<string, string> = { 'fillet': 'สันใน', 'bil': 'BIL L/C' };
    const currentPartName = partNameMap[partType] || partType;

    const allSizes = await this.weeklySizeRepo.find({ where: { partName: currentPartName } });
    const parseDateStr = (val: any): string => {
      if (!val) return '';
      const dateObj = typeof val === 'string' ? new Date(val) : val;
      const offset = dateObj.getTimezoneOffset();
      const localDate = new Date(dateObj.getTime() - (offset * 60 * 1000));
      return localDate.toISOString().split('T')[0];
    };

    const monthSizes = allSizes.filter(s => {
      const dStr = parseDateStr(s.receiveDate);
      return dStr.startsWith(targetMonth);
    });

    return { success: true, data: monthSizes };
  }

  // 5b. Import Weekly RM Sizes for a Plan
  @Post('plans/:id/import-weekly')
  async importWeeklyForPlan(@Param('id') id: number) {
    const plan = await this.mpsPlanRepo.findOne({ where: { id } });
    if (!plan) return { success: false, message: 'Plan not found' };

    const targetMonth = plan.targetMonth;
    const partType = plan.partType;

    const parseDateStr = (val: any): string => {
      if (!val) return '';
      const dateObj = typeof val === 'string' ? new Date(val) : val;
      const offset = dateObj.getTimezoneOffset();
      const localDate = new Date(dateObj.getTime() - (offset * 60 * 1000));
      return localDate.toISOString().split('T')[0];
    };

    // Fetch Weekly Intakes
    const allIntakesRaw = await this.chickenReceivingService.findAll('weekly');
    const targetIntakes = allIntakesRaw.filter((intake: any) => {
      const d = parseDateStr(intake.receive_date);
      return d.startsWith(targetMonth);
    });

    const isBil = partType === 'bil';
    const weightMatrix = isBil ? await this.bilWeightDistRepo.find() : await this.weightDistRepo.find();
    const filletCalcs = await this.filletSizeRepo.find();
    const filletMap = new Map<string, string>();
    if (!isBil) {
      filletCalcs.forEach(c => {
        if (c.groupName) filletMap.set(c.colLabel, c.groupName);
      });
    }

    const configRow = await this.filletConfigRepo.findOne({ where: { configKey: 'fillet_yield' } });
    const filletYield = configRow ? Number(configRow.configValue) : 0.04;

    let partYield = filletYield;
    if (partType === 'bil') {
      const bilNode = await this.masterYieldRepo.findOne({ where: { type: 'CATEGORY', name: 'BIL L/C' } });
      partYield = bilNode?.yieldPercentage ? Number(bilNode.yieldPercentage) : 0.25;
    }

    const partNameMap: Record<string, string> = { 'fillet': 'สันใน', 'bil': 'BIL L/C' };
    const currentPartName = partNameMap[partType] || partType;

    // Remove existing weekly sizes for this month and part
    const existingSizes = await this.weeklySizeRepo.find({ where: { partName: currentPartName } });
    const toRemove = existingSizes.filter(s => {
      const dStr = parseDateStr(s.receiveDate);
      return dStr.startsWith(targetMonth);
    });
    if (toRemove.length > 0) {
      await this.weeklySizeRepo.remove(toRemove);
    }

    // Now calculate
    const sizesToSave: ChickenReceivingWeeklySize[] = [];
    const dailyGroups = new Map<string, any[]>();
    targetIntakes.forEach(intake => {
      const dStr = parseDateStr(intake.receive_date);
      if (!dailyGroups.has(dStr)) dailyGroups.set(dStr, []);
      dailyGroups.get(dStr)!.push(intake);
    });

    for (const [dayStr, dayIntakes] of dailyGroups.entries()) {
      const sizeBins: Record<string, number> = {};

      dayIntakes.forEach((intake: any) => {
        const intakeKg = Number(intake.chicken_weight || 0);
        const intakeBirds = Number(intake.chicken_count || 0);
        if (intakeBirds <= 0 || intakeKg <= 0) return;

        const avgWeight = parseFloat((intakeKg / intakeBirds).toFixed(2));
        const slaughteredWeight = intakeKg * 0.9575 * 0.95;

        const matchingRows = weightMatrix.filter(row => {
          const label = row.rowLabel;
          if (label.includes('-')) {
            const parts = label.split('-').map(s => parseFloat(s.trim()));
            return avgWeight >= parts[0] && avgWeight <= parts[1];
          }
          return Math.abs(Number(label) - avgWeight) < 0.05;
        });

        matchingRows.forEach(row => {
          const pct = Number(row.distValue || 0);
          if (pct <= 0) return;

          // distValue is already stored as a decimal fraction (e.g. 0.0216 = 2.16%)
          const kg = isBil 
            ? Math.round(slaughteredWeight * partYield * pct)
            : Math.round(slaughteredWeight * filletYield * pct * 0.907);

          const groupName = isBil ? row.colLabel : filletMap.get(row.colLabel);
          if (groupName) {
            sizeBins[groupName] = (sizeBins[groupName] || 0) + kg;
          }
        });
      });

      for (const [groupName, kg] of Object.entries(sizeBins)) {
        if (kg <= 0) continue;
        sizesToSave.push(this.weeklySizeRepo.create({
          receiveDate: new Date(dayStr),
          groupSize: groupName,
          partName: currentPartName,
          quantityKg: Math.round(kg)
        }));
      }
    }

    // Chunk manual save in safe batches of 50 to avoid MS SQL 2100 parameter limit
    if (sizesToSave.length > 0) {
      const saveChunkSize = 50;
      for (let k = 0; k < sizesToSave.length; k += saveChunkSize) {
        await this.weeklySizeRepo.save(sizesToSave.slice(k, k + saveChunkSize));
      }
    }

    return { success: true, count: sizesToSave.length };
  }

  @Get('plans/:id')
  async getPlan(@Param('id') id: number) {
    // 1. Fetch Plan with small relations first
    const plan = await this.mpsPlanRepo.findOne({
      where: { id },
      relations: ['dailySummaries', 'exceptions', 'supplyBreakdown', 'supplyBreakdown.sizes']
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
    if (plan.supplyBreakdown) plan.supplyBreakdown.forEach(s => {
      delete (s as any).mpsPlan;
      if (s.sizes) s.sizes.forEach(sz => delete (sz as any).mpsPlanSupply);
    });
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
      .leftJoin('stg_erp_order_lines', 'sol', 'sol.erp_order_line_id = order.erp_order_line_id')
      .addSelect('sol.priority', 'priority')
      .where('plan.status = :status', { status: 'APPROVED' })
      .andWhere('order.planned_production_date = :date', { date })
      .getRawAndEntities();

    // Merge priority into entities
    const merged = orders.entities.map((order, idx) => {
      return {
        ...order,
        priority: orders.raw[idx].priority
      };
    });

    return merged;
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

  // 11. Export MPS Plan to Excel (Date-Major Matrix Format)
  @Get('plans/:id/export')
  async exportPlan(@Param('id') id: number, @Res() res: express.Response) {
    const plan = await this.mpsPlanRepo.findOne({
      where: { id },
      relations: ['dailySummaries', 'exceptions', 'supplyBreakdown', 'supplyBreakdown.sizes']
    });

    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });

    const orders = await this.mpsOrderRepo.find({
      where: { mpsPlan: { id: plan.id } },
    });

    const workbook = new ExcelJS.Workbook();
    const isBilPlan = plan.partType === 'bil';
    const sheet = workbook.addWorksheet(isBilPlan ? 'BIL MPS Plan' : 'Fillet MPS Plan');

    // Fetch Order Headers for Customer Grade mapping
    const headers = await this.orderHeaderRepo.find();
    const gradeMap = new Map();
    headers.forEach(h => {
      if (h.erpOrderNumber) gradeMap.set(h.erpOrderNumber, h.erpCustomerGrade);
    });

    // Fetch machine configs for BIL
    const machineConfigs = isBilPlan ? await this.machineConfigRepo.find({ where: { isActive: true } }) : [];
    const getMachineConf = (key: string, defaults: any) => {
      const conf = machineConfigs.find(c => c.machineKey === key);
      if (!conf) return defaults;
      return {
        speed: Number(conf.capacityPcsPerHour),
        yield: Number(conf.yieldPercentage),
        lines: Number(conf.defaultLines),
        machinesPerLine: Number(conf.machinesPerLine),
        workers: Number(conf.workersPerUnit)
      };
    };

    // 1. Prepare Data Structures
    const dailyMap = new Map();
    plan.dailySummaries.sort((a, b) => new Date(a.productionDate).getTime() - new Date(b.productionDate).getTime()).forEach(d => {
      dailyMap.set(new Date(d.productionDate).toISOString().split('T')[0], { summary: d, orders: new Map(), supply: null });
    });

    // Add supply breakdown to the map
    plan.supplyBreakdown.forEach(s => {
      const dateKey = new Date(s.productionDate).toISOString().split('T')[0];
      if (dailyMap.has(dateKey)) {
        dailyMap.get(dateKey).supply = s;
      }
    });

    // Fetch Manual Operations (Actual Staff)
    const [year, month] = plan.targetMonth.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const manualOps = await this.manualOpRepo.find({
      where: {
        productionDate: Between(startDate, endDate)
      }
    });
    const manualOpMap = new Map();
    manualOps.forEach(op => {
      const dateKey = new Date(op.productionDate).toISOString().split('T')[0];
      manualOpMap.set(dateKey, op);
    });

    // Get mapping of Item Code -> Item Desc (Pull from StgErpItem to ensure correct ERP_ITEM_DESC is used)
    const erpItems = await this.itemRepo.find();
    const itemDescMap = new Map();
    erpItems.forEach(i => {
      if (i.erpItemCode) itemDescMap.set(i.erpItemCode, i.erpItemDesc);
    });

    const specs = await this.specRepo.find();
    const specMap = new Map();
    specs.forEach(s => specMap.set(s.erpItemCode, itemDescMap.get(s.erpItemCode) || s.erpItemDesc));

    const itemMap = new Map();
    orders.forEach(o => itemMap.set(o.itemCode, specMap.get(o.itemCode) || o.itemDesc));
    const itemCodes = Array.from(itemMap.keys()).sort();

    // Group orders by date and item
    orders.forEach(o => {
      const dateKey = new Date(o.plannedProductionDate).toISOString().split('T')[0];
      if (dailyMap.has(dateKey)) {
        const d = dailyMap.get(dateKey);
        d.orders.set(o.itemCode, (d.orders.get(o.itemCode) || 0) + o.quantityKg);
      }
    });

    const dates = Array.from(dailyMap.keys());

    // Fetch BIL process codes from Master Yield Tree
    let bilProcess1Codes: string[] = [];
    let bilProcess2Codes: string[] = [];
    if (isBilPlan) {
      bilProcess1Codes = await this.getItemCodesByProcessName('BIL L/C', 'process: 1');
      bilProcess2Codes = await this.getItemCodesByProcessName('BIL L/C', 'process: 2');
    }

    // Fetch product specs for BIL manpower calculation
    const allSpecs = isBilPlan ? await this.specRepo.find() : [];
    const specByCode = new Map();
    allSpecs.forEach(s => specByCode.set(s.erpItemCode, s));

    // ── Get BIL size bin labels from supply breakdown ──
    const bilSizeLabels: string[] = [];
    if (isBilPlan) {
      const sizeSet = new Set<string>();
      plan.supplyBreakdown.forEach(s => {
        if (s.sizes) s.sizes.forEach((sz: any) => { if (sz.groupSize) sizeSet.add(sz.groupSize); });
      });
      bilSizeLabels.push(...Array.from(sizeSet).sort());
    }

    // ════════════════════════════════════════════════════
    // BIL-specific Export
    // ════════════════════════════════════════════════════
    if (isBilPlan) {
      // ═══ BIL Column Layout ═══
      // Section A: Supply Control (9 cols: 1..9)
      //   Date | Day | Intake Birds | BIL Pcs (x2) | Avg.Wt | Slaughtered Wt | RM BIL Total | RM Used | RM Balance
      // Section B: Manpower P1 (1 col: 10) | P2 (1 col: 11)
      // Section C: Process 3 BL Detail — per machine: Lines | Mach/Line | TotalMach | Shift | Yield | Workers/L/S | TotalWorkers
      //   Toridas (7 cols: 12..18) | Foodmate (7 cols: 19..25) | Trimming (7 cols: 26..32) | X-Ray (7 cols: 33..39) | P3 Total (1 col: 40)
      // Section D: Total Pax (1 col: 41)
      // Section E: BL Output (1 col: 42)
      // Section F: RM BIL by Size (dynamic)
      // Section G: Production Plan (dynamic)

      const supplyEnd = 9;        // cols 1..9
      const p1Col = 10;
      const p2Col = 11;
      const p3Start = 12;
      const machColsPerMachine = 7; // Lines | Mach/Line | TotalMach | Shift | Yield | Workers/L/S | TotalWorkers
      const toridasStart = p3Start;                              // 12
      const foodmateStart = toridasStart + machColsPerMachine;   // 19
      const trimmingStart = foodmateStart + machColsPerMachine;  // 26
      const xrayStart = trimmingStart + machColsPerMachine;      // 33
      const p3TotalCol = xrayStart + machColsPerMachine;         // 40
      const p3End = p3TotalCol;                                  // 40
      const totalCol = p3End + 1;     // 41
      const blOutputCol = totalCol + 1; // 42
      const sizeStart = blOutputCol + 1; // 43
      const sizeEnd = sizeStart + bilSizeLabels.length - 1;
      const prodStart = sizeEnd + 1;
      const prodEnd = prodStart + itemCodes.length - 1;

      // Row 1: Section Headers
      const sectionRow = sheet.addRow([]);
      sectionRow.getCell(1).value = 'Supply Control';
      sheet.mergeCells(1, 1, 1, supplyEnd);
      sectionRow.getCell(p1Col).value = 'P1';
      sectionRow.getCell(p2Col).value = 'P2';
      sectionRow.getCell(p3Start).value = 'Process 3: BL — รายละเอียดเครื่องจักร';
      sheet.mergeCells(1, p3Start, 1, p3End);
      sectionRow.getCell(totalCol).value = 'Total';
      sectionRow.getCell(blOutputCol).value = 'BL Output';
      sectionRow.getCell(sizeStart).value = 'RM BIL by Size';
      if (bilSizeLabels.length > 1) sheet.mergeCells(1, sizeStart, 1, sizeEnd);
      sectionRow.getCell(prodStart).value = 'Production Plan';
      if (itemCodes.length > 1) sheet.mergeCells(1, prodStart, 1, prodEnd);

      // Style Section Headers
      const secDefs = [
        { start: 1, end: supplyEnd, color: 'FF4472C4' },
        { start: p1Col, end: p1Col, color: 'FF2E75B6' },
        { start: p2Col, end: p2Col, color: 'FF7B2D8B' },
        { start: toridasStart, end: toridasStart + machColsPerMachine - 1, color: 'FFBF3969' },
        { start: foodmateStart, end: foodmateStart + machColsPerMachine - 1, color: 'FFD84B8A' },
        { start: trimmingStart, end: trimmingStart + machColsPerMachine - 1, color: 'FFE67CA0' },
        { start: xrayStart, end: xrayStart + machColsPerMachine - 1, color: 'FFF0A0BA' },
        { start: p3TotalCol, end: p3TotalCol, color: 'FF880E4F' },
        { start: totalCol, end: totalCol, color: 'FF3F51B5' },
        { start: blOutputCol, end: blOutputCol, color: 'FF2E7D32' },
        { start: sizeStart, end: sizeEnd, color: 'FFED7D31' },
        { start: prodStart, end: prodEnd, color: 'FF7030A0' }
      ];
      secDefs.forEach(sec => {
        for (let i = sec.start; i <= sec.end; i++) {
          const cell = sectionRow.getCell(i);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sec.color } };
          cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 };
          cell.alignment = { horizontal: 'center' };
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        }
      });

      // Row 2: Machine Names (sub-section headers) + Item Descriptions
      const machineNameRow = sheet.addRow([]);
      // Machine group labels
      machineNameRow.getCell(toridasStart).value = '🔧 Toridas (Debone)';
      sheet.mergeCells(2, toridasStart, 2, toridasStart + machColsPerMachine - 1);
      machineNameRow.getCell(foodmateStart).value = '🔧 Foodmate (Debone)';
      sheet.mergeCells(2, foodmateStart, 2, foodmateStart + machColsPerMachine - 1);
      machineNameRow.getCell(trimmingStart).value = '✂️ Trimming Belt';
      sheet.mergeCells(2, trimmingStart, 2, trimmingStart + machColsPerMachine - 1);
      machineNameRow.getCell(xrayStart).value = '📡 X-Ray';
      sheet.mergeCells(2, xrayStart, 2, xrayStart + machColsPerMachine - 1);
      machineNameRow.getCell(p3TotalCol).value = 'P3 รวม';
      // Production plan item descriptions
      itemCodes.forEach((code, idx) => {
        machineNameRow.getCell(prodStart + idx).value = itemMap.get(code) || '';
      });
      // Style machine name cells
      const machNameDefs = [
        { start: toridasStart, end: toridasStart + machColsPerMachine - 1, color: 'FFFCE4EC' },
        { start: foodmateStart, end: foodmateStart + machColsPerMachine - 1, color: 'FFFCE4EC' },
        { start: trimmingStart, end: trimmingStart + machColsPerMachine - 1, color: 'FFFCE4EC' },
        { start: xrayStart, end: xrayStart + machColsPerMachine - 1, color: 'FFFCE4EC' },
        { start: p3TotalCol, end: p3TotalCol, color: 'FFFCE4EC' },
      ];
      machNameDefs.forEach(sec => {
        for (let i = sec.start; i <= sec.end; i++) {
          const cell = machineNameRow.getCell(i);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sec.color } };
          cell.font = { bold: true, size: 9, color: { argb: 'FF880E4F' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        }
      });
      // Style production plan item desc cells
      for (let i = prodStart; i <= prodEnd; i++) {
        const cell = machineNameRow.getCell(i);
        cell.font = { bold: true, size: 8 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
        cell.alignment = { horizontal: 'center', wrapText: true };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      }
      machineNameRow.height = 30;

      // Repeated column labels for each machine group
      const machSubCols = ['ไลน์', 'เครื่อง/ไลน์', 'เครื่องรวม', 'กะ', 'Yield', 'คน/ไลน์/กะ', 'รวมคน'];

      // Row 3: Sub-Headers
      const subHeaders = [
        'Date', 'Day', 'Intake Birds', 'BIL Pcs (x2)', 'Avg. Wt (kg)',
        'Slaughtered Wt', 'RM BIL Total', 'RM Used', 'RM Balance',
        'P1 Pax', 'P2 Pax',
        ...machSubCols, // Toridas
        ...machSubCols, // Foodmate
        ...machSubCols, // Trimming
        ...machSubCols, // X-Ray
        'P3 รวมคน',
        'Total Pax',
        'BL Output (kg)',
        ...bilSizeLabels,
        ...itemCodes
      ];
      const headerRow = sheet.addRow(subHeaders);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, size: 8 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
      headerRow.height = 35;

      // Machine configs
      const toridasConf = getMachineConf('toridas', { speed: 1500, yield: 0.75, lines: 3, machinesPerLine: 4, workers: 5 });
      const foodmateConf = getMachineConf('foodmate', { speed: 6000, yield: 0.70, lines: 1, machinesPerLine: 1, workers: 5 });
      const trimConf = getMachineConf('trimming_belt', { speed: 600, yield: 1.0, lines: 3, machinesPerLine: 1, workers: 7 });
      const xrayConf = getMachineConf('xray', { speed: 18700, yield: 1.0, lines: 3, machinesPerLine: 1, workers: 5 });

      // Data Rows
      dates.forEach(dateStr => {
        const d = dailyMap.get(dateStr);
        const s = d.summary;
        const supply = d.supply;
        const dateObj = new Date(dateStr);
        const isNoSupply = !s.intakeBirds || s.intakeBirds === 0;

        // ── BIL Supply Numbers ──
        const dailyOrders = orders.filter(o => new Date(o.plannedProductionDate).toISOString().split('T')[0] === dateStr);
        const intakeBirds = s.intakeBirds || 0;
        const bilPiecesTotal = intakeBirds * 2; // 2 ขาต่อตัว
        const totalWeight = supply?.totalWeight || 0;
        const avgWeight = supply?.avgWeight || 0;
        const slaughteredWeight = totalWeight * 0.9575 * 0.95;
        const rmBilTotal = Math.round(s.rmFlAvailKg); // stored as RM BIL in the plan
        const rmUsed = Math.round(s.demandKg);
        const rmBalance = rmBilTotal - rmUsed;

        // ── Pieces-based avg piece weight ──
        const avgPieceWeight = intakeBirds > 0 ? (rmBilTotal / bilPiecesTotal) : 0;
        let remainingPieces = bilPiecesTotal; // BIL uses x2

        // P1: BIL orders (matched by Master Yield Tree process: 1)
        let requiredP1WorkersHours = 0;
        dailyOrders.forEach(o => {
          if (bilProcess1Codes.includes(o.itemCode)) {
            const spec = specByCode.get(o.itemCode);
            const speed = spec?.productSpeed ? Number(spec.productSpeed) : 45;
            requiredP1WorkersHours += Number(o.quantityKg) / speed;
          }
        });
        const p1Pax = Math.ceil(requiredP1WorkersHours / 9.58);

        // Deduct P1 demand pieces from remaining
        const demandP1 = dailyOrders.filter(o => bilProcess1Codes.includes(o.itemCode)).reduce((sum, o) => sum + Number(o.quantityKg), 0);
        const piecesForP1 = avgPieceWeight > 0 ? demandP1 / avgPieceWeight : 0;
        remainingPieces = Math.max(0, remainingPieces - piecesForP1);

        // P2: สะโพก + น่อง orders (matched by Master Yield Tree process: 2)
        let separationWorkers = 0;
        let requiredP2ThighPcs = 0;
        let requiredP2DrumPcs = 0;
        dailyOrders.forEach(o => {
          if (bilProcess2Codes.includes(o.itemCode)) {
            const spec = specByCode.get(o.itemCode);
            const isDrum = spec && spec.erpItemDesc && spec.erpItemDesc.includes('น่อง') && !spec.erpItemDesc.includes('สะโพก');
            const yieldPct = spec?.productYield ? Number(spec.productYield) : 0.5;
            const speed = spec?.productSpeed ? Number(spec.productSpeed) : 45;
            const pcs = avgPieceWeight > 0 && yieldPct > 0 ? Number(o.quantityKg) / (avgPieceWeight * yieldPct) : 0;
            if (isDrum) requiredP2DrumPcs += pcs; else requiredP2ThighPcs += pcs;
            separationWorkers += Number(o.quantityKg) / speed;
          }
        });
        const piecesToCutP2 = Math.max(requiredP2ThighPcs, requiredP2DrumPcs);
        remainingPieces = Math.max(0, remainingPieces - Math.min(remainingPieces, piecesToCutP2));
        const p2Pax = Math.ceil(separationWorkers / 9.58);

        // P3: BL via Debone → Trimming → X-Ray
        const toridasCapPerLineShift = toridasConf.machinesPerLine * toridasConf.speed * 9.58;
        const toridasCapPerShift = toridasConf.lines * toridasCapPerLineShift;
        const foodmateCapPerLineShift = foodmateConf.machinesPerLine * foodmateConf.speed * 9.58;
        const foodmateCapPerShift = foodmateConf.lines * foodmateCapPerLineShift;
        const deboneCapPerShift = toridasCapPerShift + foodmateCapPerShift;

        let shiftsNeeded = 0;
        if (remainingPieces > 0) {
            if (remainingPieces <= toridasCapPerShift) {
                shiftsNeeded = 1;
            } else if (remainingPieces <= toridasCapPerShift * 2) {
                shiftsNeeded = 2;
            } else {
                shiftsNeeded = Math.ceil(remainingPieces / deboneCapPerShift);
                if (shiftsNeeded < 2) shiftsNeeded = 2;
            }
        }

        const piecesPerShift = shiftsNeeded > 0 ? Math.ceil(remainingPieces / shiftsNeeded) : 0;

        const toridasInputPcsPerShift = Math.min(piecesPerShift, toridasCapPerShift);
        const leftoverPcsPerShift = Math.max(0, piecesPerShift - toridasInputPcsPerShift);
        const foodmateInputPcsPerShift = Math.min(leftoverPcsPerShift, foodmateCapPerShift);
        const totalPcsProcessedPerShift = toridasInputPcsPerShift + foodmateInputPcsPerShift;

        const toridasLinesNeeded = toridasInputPcsPerShift > 0 ? Math.ceil(toridasInputPcsPerShift / toridasCapPerLineShift) : 0;
        const toridasPax = toridasLinesNeeded * toridasConf.workers * shiftsNeeded;
        
        const foodmateLinesNeeded = foodmateInputPcsPerShift > 0 ? Math.ceil(foodmateInputPcsPerShift / foodmateCapPerLineShift) : 0;
        const foodmatePax = foodmateLinesNeeded * foodmateConf.workers * shiftsNeeded;

        const trimmingWorkHoursPerShift = totalPcsProcessedPerShift / trimConf.speed;
        const trimVolPax = Math.ceil(trimmingWorkHoursPerShift / 9.58) * shiftsNeeded;
        const trimLinesNeeded = Math.min(trimConf.lines, toridasLinesNeeded + foodmateLinesNeeded);
        const trimFixedPax = trimLinesNeeded * trimConf.workers * shiftsNeeded;

        const xrayCapPerMachineShift = xrayConf.speed * 9.58;
        const xrayMachinesNeeded = totalPcsProcessedPerShift > 0 ? Math.min(xrayConf.lines, Math.ceil(totalPcsProcessedPerShift / xrayCapPerMachineShift)) : 0;
        const xrayPax = xrayMachinesNeeded * xrayConf.workers * shiftsNeeded;

        const p3Total = toridasPax + foodmatePax + trimVolPax + trimFixedPax + xrayPax;
        const totalPax = p1Pax + p2Pax + p3Total;

        // BL Output (kg) — pieces through debone * avg piece weight * yield
        const toridasBlKg = (toridasInputPcsPerShift * shiftsNeeded * avgPieceWeight) * toridasConf.yield;
        const foodmateBlKg = (foodmateInputPcsPerShift * shiftsNeeded * avgPieceWeight) * foodmateConf.yield;
        const blOutputKg = Math.round(toridasBlKg + foodmateBlKg);

        // Size bins
        const getSizeKg = (sizeArr: any[] | undefined, groupSize: string): number => {
          if (!sizeArr) return 0;
          return sizeArr.filter((sz: any) => sz.groupSize === groupSize).reduce((sum: number, sz: any) => sum + Number(sz.quantityKg || 0), 0);
        };

        const toridasTotalMachines = toridasLinesNeeded * toridasConf.machinesPerLine;
        const foodmateTotalMachines = foodmateLinesNeeded * foodmateConf.machinesPerLine;
        const trimTotalMachines = trimLinesNeeded * 1; // 1 machine per line
        const toridasYieldPct = `${(toridasConf.yield * 100).toFixed(0)}%`;
        const foodmateYieldPct = `${(foodmateConf.yield * 100).toFixed(0)}%`;

        const rowData = [
          dateStr,
          dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
          intakeBirds,
          bilPiecesTotal,
          avgWeight ? Number(avgWeight).toFixed(2) : '-',
          Math.round(slaughteredWeight),
          rmBilTotal,
          rmUsed,
          rmBalance,
          p1Pax, p2Pax,
          // Toridas: Lines | Mach/Line | TotalMach | Shift | Yield | Workers/L/S | TotalWorkers
          toridasLinesNeeded, toridasConf.machinesPerLine, toridasTotalMachines, shiftsNeeded, toridasYieldPct, toridasConf.workers, toridasPax,
          // Foodmate: Lines | Mach/Line | TotalMach | Shift | Yield | Workers/L/S | TotalWorkers
          foodmateLinesNeeded, foodmateConf.machinesPerLine, foodmateTotalMachines, shiftsNeeded, foodmateYieldPct, foodmateConf.workers, foodmatePax,
          // Trimming: Lines | Mach/Line | TotalMach | Shift | Yield | Workers/L/S | TotalWorkers
          trimLinesNeeded, 1, trimTotalMachines, shiftsNeeded, '-', trimConf.workers, (trimVolPax + trimFixedPax),
          // X-Ray: Lines | Mach/Line | TotalMach | Shift | Yield | Workers/L/S | TotalWorkers
          '-', '-', xrayMachinesNeeded, shiftsNeeded, '-', xrayConf.workers, xrayPax,
          p3Total,
          totalPax,
          blOutputKg || '-',
          ...bilSizeLabels.map(label => Math.round(getSizeKg(supply?.sizes, label)) || '-'),
          ...itemCodes.map(code => d.orders.has(code) ? Math.round(d.orders.get(code)) : '-')
        ];

        const r = sheet.addRow(rowData);
        r.eachCell((cell, colNumber) => {
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          cell.font = { size: 9 };
          cell.alignment = { horizontal: 'center' };

          if (isNoSupply) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' } };
            cell.font = { color: { argb: 'FF999999' }, size: 9 };
          } else if (colNumber === p1Col) { // P1
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };
            cell.font = { color: { argb: 'FF1F4E79' }, bold: true, size: 9 };
          } else if (colNumber === p2Col) { // P2
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8DAEF' } };
            cell.font = { color: { argb: 'FF6C3483' }, bold: true, size: 9 };
          } else if (colNumber >= toridasStart && colNumber < foodmateStart) { // Toridas
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4EC' } };
            if (colNumber === toridasStart + machColsPerMachine - 1) cell.font = { color: { argb: 'FF880E4F' }, bold: true, size: 9 };
          } else if (colNumber >= foodmateStart && colNumber < trimmingStart) { // Foodmate
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8BBD0' } };
            if (colNumber === foodmateStart + machColsPerMachine - 1) cell.font = { color: { argb: 'FF880E4F' }, bold: true, size: 9 };
          } else if (colNumber >= trimmingStart && colNumber < xrayStart) { // Trimming
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4EC' } };
            if (colNumber === trimmingStart + machColsPerMachine - 1) cell.font = { color: { argb: 'FF880E4F' }, bold: true, size: 9 };
          } else if (colNumber >= xrayStart && colNumber < p3TotalCol) { // X-Ray
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8BBD0' } };
            if (colNumber === xrayStart + machColsPerMachine - 1) cell.font = { color: { argb: 'FF880E4F' }, bold: true, size: 9 };
          } else if (colNumber === p3TotalCol) { // P3 Total
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF48FB1' } };
            cell.font = { color: { argb: 'FF880E4F' }, bold: true, size: 10 };
          } else if (colNumber === totalCol) { // Total
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC5CAE9' } };
            cell.font = { color: { argb: 'FF283593' }, bold: true, size: 10 };
          } else if (colNumber === blOutputCol && cell.value !== '-') { // BL Output
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC8E6C9' } };
            cell.font = { color: { argb: 'FF1B5E20' }, bold: true, size: 9 };
          } else if (colNumber >= prodStart && cell.value !== '-') { // Production
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
            cell.font = { color: { argb: 'FF375623' }, bold: true, size: 9 };
          }
        });
      });

      // Column widths
      sheet.getColumn(1).width = 12;  // Date
      sheet.getColumn(2).width = 7;   // Day
      sheet.getColumn(3).width = 13;  // Intake Birds
      sheet.getColumn(4).width = 13;  // BIL Pcs
      sheet.getColumn(5).width = 10;  // Avg Wt
      sheet.getColumn(6).width = 16;  // Slaughtered Wt
      sheet.getColumn(7).width = 14;  // RM BIL Total
      sheet.getColumn(8).width = 14;  // RM Used
      sheet.getColumn(9).width = 12;  // RM Balance
      sheet.getColumn(p1Col).width = 8;
      sheet.getColumn(p2Col).width = 8;
      // Machine detail columns (7 cols each x 4 machines)
      for (const mStart of [toridasStart, foodmateStart, trimmingStart, xrayStart]) {
        sheet.getColumn(mStart).width = 8;      // ไลน์
        sheet.getColumn(mStart + 1).width = 10;  // เครื่อง/ไลน์
        sheet.getColumn(mStart + 2).width = 10;  // เครื่องรวม
        sheet.getColumn(mStart + 3).width = 7;   // กะ
        sheet.getColumn(mStart + 4).width = 8;   // Yield
        sheet.getColumn(mStart + 5).width = 11;  // คน/ไลน์/กะ
        sheet.getColumn(mStart + 6).width = 9;   // รวมคน
      }
      sheet.getColumn(p3TotalCol).width = 10;
      sheet.getColumn(totalCol).width = 11;
      sheet.getColumn(blOutputCol).width = 14;
      for (let i = sizeStart; i <= sizeEnd; i++) sheet.getColumn(i).width = 12;
      for (let i = prodStart; i <= prodEnd; i++) sheet.getColumn(i).width = 15;
      sheet.views = [{ state: 'frozen', xSplit: supplyEnd, ySplit: 3 }];

    } else {
    // ════════════════════════════════════════════════════
    // Original Fillet Export (unchanged)
    // ════════════════════════════════════════════════════

    // 2. Setup Headers
    // Row 1: Section Headers
    const sectionRow = sheet.addRow([]);
    sectionRow.getCell(1).value = 'Supply Control';
    sheet.mergeCells(1, 1, 1, 6);
    sectionRow.getCell(7).value = 'Manpower & Execution';
    sheet.mergeCells(1, 7, 1, 11);
    sectionRow.getCell(12).value = 'RM FL by Size';
    sheet.mergeCells(1, 12, 1, 19);
    sectionRow.getCell(20).value = 'Production Plan';
    sheet.mergeCells(1, 20, 1, 20 + itemCodes.length - 1);

    // Style Section Headers
    [
      { start: 1, end: 6, color: 'FF4472C4' },
      { start: 7, end: 11, color: 'FF70AD47' },
      { start: 12, end: 19, color: 'FFED7D31' },
      { start: 20, end: 20 + itemCodes.length - 1, color: 'FF7030A0' }
    ].forEach(sec => {
      for (let i = sec.start; i <= sec.end; i++) {
        const cell = sectionRow.getCell(i);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sec.color } };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        cell.alignment = { horizontal: 'center' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      }
    });

    // Row 2: Item Descriptions Header
    const descRowData = new Array(19).fill('');
    itemCodes.forEach(code => descRowData.push(itemMap.get(code) || ''));
    const descRow = sheet.addRow(descRowData);
    descRow.eachCell((cell, colNumber) => {
      if (colNumber >= 20) {
        cell.font = { bold: true, size: 8 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
        cell.alignment = { horizontal: 'center', wrapText: true };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      }
    });
    descRow.height = 30;

    // Row 3: Sub-Headers
    const subHeaders = [
      'Date', 'Day', 'Avg. Wt', 'RM FL Total', 'RM Used (Demand)', 'RM Balance',
      'Cut (P)', 'Sup (P)', 'Cut (A)', 'Sup (A)', 'Variance',
      '40 down', '40 45', '45 50', '50 55', '55 60', '60 65', '65 70', '70 up',
      ...itemCodes
    ];
    const headerRow = sheet.addRow(subHeaders);
    headerRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, size: 9 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    // 3. Add Data Rows
    dates.forEach(dateStr => {
      const d = dailyMap.get(dateStr);
      const s = d.summary;
      const supply = d.supply;
      const dateObj = new Date(dateStr);
      const isNoSupply = !s.intakeBirds || s.intakeBirds === 0;

      const manualOp = manualOpMap.get(dateStr);
      const actualCut = manualOp?.actualCuttingWorkers || 0;
      const actualSup = manualOp?.actualStationWorkers || 0;
      const plannedCut = s.cuttingStaff;
      const plannedSup = manualOp?.plannedStationWorkers || s.supportStaff;
      const variance = (actualCut + actualSup) - (plannedCut + plannedSup);

      // Helper: get size kg from normalized sizes array
      const getSizeKg = (sizeArr: any[] | undefined, groupSize: string): number => {
        if (!sizeArr) return 0;
        return sizeArr
          .filter((sz: any) => sz.groupSize === groupSize)
          .reduce((sum: number, sz: any) => sum + Number(sz.quantityKg || 0), 0);
      };

      const rowData = [
        dateStr,
        dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
        supply?.avgWeight || '-',
        Math.round(s.rmFlAvailKg),
        Math.round(s.demandKg),
        Math.round(s.rmFlAvailKg - s.demandKg),
        plannedCut,
        plannedSup,
        actualCut,
        actualSup,
        variance,
        Math.round(getSizeKg(supply?.sizes, '40 Down')),
        Math.round(getSizeKg(supply?.sizes, '40-45')),
        Math.round(getSizeKg(supply?.sizes, '45-50')),
        Math.round(getSizeKg(supply?.sizes, '50-55')),
        Math.round(getSizeKg(supply?.sizes, '55-60')),
        Math.round(getSizeKg(supply?.sizes, '60-65')),
        Math.round(getSizeKg(supply?.sizes, '65-70')),
        Math.round(getSizeKg(supply?.sizes, '70 Up')),
        ...itemCodes.map(code => d.orders.has(code) ? Math.round(d.orders.get(code)) : '-')
      ];

      const r = sheet.addRow(rowData);
      r.eachCell((cell, colNumber) => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.font = { size: 9 };

        if (isNoSupply) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' } };
          cell.font = { color: { argb: 'FF999999' }, size: 9 };
        } else if (colNumber === 11) { // Variance column
          if (variance > 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
            cell.font = { color: { argb: 'FF006100' }, bold: true, size: 9 };
          } else if (variance < 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
            cell.font = { color: { argb: 'FF9C0006' }, bold: true, size: 9 };
          }
        } else if (colNumber >= 20 && cell.value !== '-') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
          cell.font = { color: { argb: 'FF375623' }, bold: true, size: 9 };
        }
      });
    });

    // 4. Formatting
    sheet.getColumn(1).width = 12;
    sheet.getColumn(2).width = 8;
    sheet.getColumn(4).width = 15;
    sheet.getColumn(5).width = 15;
    sheet.getColumn(6).width = 15;
    for (let i = 20; i <= 20 + itemCodes.length; i++) {
      sheet.getColumn(i).width = 15;
    }
    sheet.views = [{ state: 'frozen', xSplit: 6, ySplit: 3 }];

    } // end if-else isBilPlan

    // 5. Sheet 2: Demand Plan (Detailed View)
    const demandSheet = workbook.addWorksheet('Demand Plan');

    // Setup Columns
    demandSheet.columns = [
      { header: 'SO Number', key: 'so', width: 15 },
      { header: 'Grade', key: 'grade', width: 10 },
      { header: 'Item Code', key: 'code', width: 15 },
      { header: 'Item Description', key: 'desc', width: 40 },
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Qty (KG)', key: 'qty', width: 15 },
      { header: 'Ship Date', key: 'ship', width: 15 },
      { header: 'Planned Prod', key: 'planned', width: 15 },
      { header: 'Finished Prod', key: 'finished', width: 15 },
      { header: 'Method', key: 'method', width: 12 }
    ];

    // Style Header Row
    const dHeaderRow = demandSheet.getRow(1);
    dHeaderRow.height = 30;
    dHeaderRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    // Add Data
    const sortedOrders = [...orders].sort((a, b) => {
      const dateA = new Date(a.plannedProductionDate).getTime();
      const dateB = new Date(b.plannedProductionDate).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return (a.soNumber || '').localeCompare(b.soNumber || '');
    });

    sortedOrders.forEach((o, idx) => {
      const row = demandSheet.addRow({
        so: o.soNumber,
        grade: gradeMap.get(o.soNumber) || '-',
        code: o.itemCode,
        desc: specMap.get(o.itemCode) || o.itemDesc || '-',
        type: o.productType?.toUpperCase(),
        qty: Math.round(Number(o.quantityKg)),
        ship: new Date(o.shipDate).toLocaleDateString('en-GB'),
        planned: new Date(o.plannedProductionDate).toLocaleDateString('en-GB'),
        finished: o.finishedProductionDate ? new Date(o.finishedProductionDate).toLocaleDateString('en-GB') : '-',
        method: o.isManualOverride ? 'Manual' : 'Auto'
      });

      // Styling for data rows
      row.eachCell((cell, colNum) => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.font = { size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (colNum === 4) cell.alignment.horizontal = 'left'; // Item Desc
        if (idx % 2 === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };
        }
      });

      // Special color for types
      const typeCell = row.getCell(5);
      if (o.productType?.toLowerCase() === 'chilled') {
        typeCell.font = { color: { argb: 'FFC0504D' }, bold: true, size: 10 };
      } else {
        typeCell.font = { color: { argb: 'FF4F81BD' }, bold: true, size: 10 };
      }
    });

    // Freeze Header
    demandSheet.views = [{ state: 'frozen', ySplit: 1 }];

    // 6. Sheet 3: Unfulfilled Orders
    const exceptionSheet = workbook.addWorksheet('Unfulfilled Orders');
    exceptionSheet.columns = [
      { header: 'SO Number', key: 'so', width: 15 },
      { header: 'Item Code', key: 'code', width: 15 },
      { header: 'Item Description', key: 'desc', width: 40 },
      { header: 'Ship Date', key: 'ship', width: 15 },
      { header: 'Required Qty', key: 'req', width: 15 },
      { header: 'Shortage Qty', key: 'short', width: 15 },
      { header: 'Reason', key: 'reason', width: 50 }
    ];

    // Style Header Row
    const exHeaderRow = exceptionSheet.getRow(1);
    exHeaderRow.height = 30;
    exHeaderRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC0504D' } }; // Red header for exceptions
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    // Add Data
    plan.exceptions.sort((a, b) => new Date(a.shipDate).getTime() - new Date(b.shipDate).getTime()).forEach((ex, idx) => {
      const row = exceptionSheet.addRow({
        so: ex.soNumber,
        code: ex.itemCode,
        desc: itemDescMap.get(ex.itemCode) || '-',
        ship: new Date(ex.shipDate).toLocaleDateString('en-GB'),
        req: Math.round(Number(ex.requiredKg)),
        short: Math.round(Number(ex.shortageKg)),
        reason: ex.reason
      });

      // Styling for data rows
      row.eachCell((cell, colNum) => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.font = { size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (colNum === 3 || colNum === 7) cell.alignment.horizontal = 'left'; // Item Desc & Reason
        if (idx % 2 === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };
        }
      });

      // Highlight shortage qty
      row.getCell(6).font = { color: { argb: 'FFC0504D' }, bold: true, size: 10 };
    });

    // Freeze Header
    exceptionSheet.views = [{ state: 'frozen', ySplit: 1 }];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=MPS_Plan_${plan.targetMonth}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  }
}
