import { Controller, Post, Body, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { StgErpOrderLine } from './stg-erp-order-line.entity';
import { ProductSpec } from './product-spec.entity';
import { MpsPlan, MpsPlanDaily, MpsPlanOrder } from './mps-plan.entity';
import { ChickenReceivingService } from './chicken-receiving/chicken-receiving.service';

@Controller('api/mps')
export class MpsController {
  constructor(
    @InjectRepository(StgErpOrderLine)
    private orderLineRepo: Repository<StgErpOrderLine>,
    @InjectRepository(ProductSpec)
    private specRepo: Repository<ProductSpec>,
    @InjectRepository(MpsPlan)
    private mpsPlanRepo: Repository<MpsPlan>,
    @InjectRepository(MpsPlanDaily)
    private mpsDailyRepo: Repository<MpsPlanDaily>,
    @InjectRepository(MpsPlanOrder)
    private mpsOrderRepo: Repository<MpsPlanOrder>,
    private chickenReceivingService: ChickenReceivingService,
  ) {}

  // 1. Manually update planned production date (Drag & Drop)
  @Post('update-date')
  async updateDate(@Body() body: { lineId: number; date: string }) {
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
  async generatePlan(@Body() body: { targetMonth: string }) { // targetMonth format: '2026-05'
    const targetMonth = body.targetMonth;
    
    // Step 1: Check for existing DRAFT plan for this month
    let plan = await this.mpsPlanRepo.findOne({ where: { targetMonth, status: 'DRAFT' } });
    if (plan) {
      // Clear old details
      await this.mpsDailyRepo.delete({ mpsPlan: { id: plan.id } });
      await this.mpsOrderRepo.delete({ mpsPlan: { id: plan.id } });
    } else {
      plan = this.mpsPlanRepo.create({
        planName: `MPS ${targetMonth} - Draft`,
        targetMonth,
        status: 'DRAFT',
      });
      plan = await this.mpsPlanRepo.save(plan);
    }

    // Step 2: Fetch Orders & Specs for the month
    const startOfMonth = new Date(`${targetMonth}-01T00:00:00Z`);
    const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0, 23, 59, 59);

    const orders = await this.orderLineRepo.find({
      where: { erpOrderShipDate: Between(startOfMonth, endOfMonth) }
    });
    
    const specs = await this.specRepo.find();
    const specMap = new Map();
    specs.forEach(s => specMap.set(s.erpItemCode, s));

    // Calculate Backwards Scheduling for orders
    const mpsOrdersToSave: MpsPlanOrder[] = [];
    let totalDemandKg = 0;

    for (const order of orders) {
      const spec = specMap.get(order.erpOrderItemCode);
      
      // *** IMPORTANT: Only include orders that exist in Product Spec ***
      if (!spec) {
        continue; // ข้ามไอเทมนี้ไปเลย ถ้าไม่ได้ตั้ง Spec ไว้ (แสดงว่าไม่ได้เอามาวางแผน)
      }

      const productType = spec.productType;
      const qty = Number(order.erpOrderItemQty || 0);

      const shipDate = new Date(order.erpOrderShipDate);
      const plannedDate = new Date(shipDate);
      if (productType === 'chilled') {
        plannedDate.setDate(plannedDate.getDate() - 1);
      } else {
        plannedDate.setDate(plannedDate.getDate() - 5);
      }

      totalDemandKg += qty;

      mpsOrdersToSave.push(this.mpsOrderRepo.create({
        mpsPlan: plan,
        erpOrderLineId: order.erpOrderLineId,
        itemCode: order.erpOrderItemCode,
        itemDesc: order.erpOrderItemCode, // Ideally get from header or item table
        productType,
        quantityKg: qty,
        shipDate: shipDate,
        plannedProductionDate: plannedDate,
        isManualOverride: false
      }));
    }

    await this.mpsOrderRepo.save(mpsOrdersToSave);

    // Step 3: Fetch Intakes and calculate daily metrics
    // Group intakes by date
    const allIntakes = await this.chickenReceivingService.findAll('daily'); // Or appropriate method
    const dailyData = new Map();

    allIntakes.forEach((intake: any) => {
      const d = intake.receivingDate ? intake.receivingDate.toISOString().split('T')[0] : null;
      if (d && d.startsWith(targetMonth)) {
        if (!dailyData.has(d)) {
          dailyData.set(d, { birds: 0, kg: 0 });
        }
        const current = dailyData.get(d);
        current.birds += Number(intake.totalBirds || 0);
        current.kg += Number(intake.totalWeightKg || 0);
      }
    });

    const mpsDailiesToSave: MpsPlanDaily[] = [];
    let totalIntakeBirds = 0;
    let totalRmFlKg = 0;

    // Group orders by planned date
    const dailyDemand = new Map();
    const dailyStaff = new Map();

    mpsOrdersToSave.forEach(o => {
      const d = o.plannedProductionDate.toISOString().split('T')[0];
      if (!dailyDemand.has(d)) dailyDemand.set(d, 0);
      dailyDemand.set(d, dailyDemand.get(d) + o.quantityKg);

      const spec = specMap.get(o.itemCode);
      const speed = Number(spec?.productSpeed || 45);
      if (!dailyStaff.has(d)) dailyStaff.set(d, 0);
      dailyStaff.set(d, dailyStaff.get(d) + (o.quantityKg / speed));
    });

    // Determine all days in month
    const daysInMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      const dayStr = `${targetMonth}-${i.toString().padStart(2, '0')}`;
      const intake = dailyData.get(dayStr) || { birds: 0, kg: 0 };
      const demand = dailyDemand.get(dayStr) || 0;
      
      const rmFlAvailKg = intake.kg * 0.957 * 0.95 * 0.04 * (1 - 0.093);
      totalIntakeBirds += intake.birds;
      totalRmFlKg += rmFlAvailKg;

      const cuttingStaff = demand > 0 ? (dailyStaff.get(dayStr) || 0) / 10 : 0;
      const supportStaff = demand > 0 ? 28 : 0;

      mpsDailiesToSave.push(this.mpsDailyRepo.create({
        mpsPlan: plan,
        productionDate: new Date(dayStr),
        intakeBirds: intake.birds,
        rmFlAvailKg: rmFlAvailKg,
        demandKg: demand,
        cuttingStaff: Math.ceil(cuttingStaff),
        supportStaff,
        totalStaff: Math.ceil(cuttingStaff + supportStaff)
      }));
    }

    await this.mpsDailyRepo.save(mpsDailiesToSave);

    // Update Plan Header
    plan.totalIntakeBirds = totalIntakeBirds;
    plan.totalRmFlKg = totalRmFlKg;
    plan.totalDemandKg = totalDemandKg;
    await this.mpsPlanRepo.save(plan);

    return { success: true, planId: plan.id, status: plan.status };
  }
}
