import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { StgErpOrderLine } from './stg-erp-order-line.entity';
import { ProductSpec } from './product-spec.entity';
import { MpsPlan, MpsPlanDaily, MpsPlanOrder } from './mps-plan.entity';
import { MpsExceptionReport } from './mps-exception.entity';
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
    @InjectRepository(MpsExceptionReport)
    private exceptionRepo: Repository<MpsExceptionReport>,
    private chickenReceivingService: ChickenReceivingService,
  ) {}

  // 1. Manually update planned production date in MpsPlanOrder (Drag & Drop)
  @Post('update-date')
  async updateDate(@Body() body: { planId?: number, mpsOrderId?: number, lineId: number; date: string }) {
    if (body.mpsOrderId) {
      const planOrder = await this.mpsOrderRepo.findOne({ where: { id: body.mpsOrderId } });
      if (planOrder) {
        planOrder.plannedProductionDate = new Date(body.date);
        planOrder.isManualOverride = true; // Mark as manually overridden
        await this.mpsOrderRepo.save(planOrder);
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
  async generatePlan(@Body() body: { targetMonth: string }) { // targetMonth format: '2026-05'
    const targetMonth = body.targetMonth;
    
    // Step 1: Check for existing DRAFT plan for this month
    let plan = await this.mpsPlanRepo.findOne({ where: { targetMonth, status: 'DRAFT' } });
    if (plan) {
      // Clear old details
      await this.mpsDailyRepo.delete({ mpsPlan: { id: plan.id } });
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

    const targetDate = new Date(`${targetMonth}-01T00:00:00Z`);
    const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1, 0, 0, 0);
    const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59);

    // Step 2: Fetch Orders & Specs for the month
    const orders = await this.orderLineRepo.find({
      where: { erpOrderShipDate: Between(startOfMonth, endOfMonth) }
    });
    
    const specs = await this.specRepo.find();
    const specMap = new Map();
    specs.forEach(s => specMap.set(s.erpItemCode, s));

    // Step 3: Fetch Supply (Chicken Receiving Month)
    // We use monthly plan to represent the actual supply for continuous mapping
    const allIntakes = await this.chickenReceivingService.findAll('monthly');
    
    const supplyMap = new Map<string, number>();
    allIntakes.forEach((intake: any) => {
      const d = intake.receive_date ? new Date(intake.receive_date).toISOString().split('T')[0] : null;
      if (d) {
        const intakeKg = Number(intake.chicken_weight || 0);
        // Formula matching the previous system mapping logic
        const rmFlAvailKg = intakeKg * 0.957 * 0.95 * 0.04 * (1 - 0.093);
        supplyMap.set(d, (supplyMap.get(d) || 0) + rmFlAvailKg);
      }
    });

    // Helper functions
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    const subtractDays = (date: Date, days: number) => {
        const d = new Date(date);
        d.setDate(d.getDate() - days);
        return d;
    };

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

    // Sort by ship date ascending
    chillOrders.sort((a, b) => a.shipDate.getTime() - b.shipDate.getTime());
    freezeOrders.sort((a, b) => a.shipDate.getTime() - b.shipDate.getTime());

    const mpsOrdersToSave: MpsPlanOrder[] = [];
    const exceptionsToSave: any[] = [];
    let totalDemandKg = 0;

    // Step 4: Map CHILL Orders First (Strict Lead Time: -1 Day)
    for (const order of chillOrders) {
       totalDemandKg += order.qty;
       const targetProdDate = subtractDays(order.shipDate, 1);
       const dateStr = formatDate(targetProdDate);
       const supply = supplyMap.get(dateStr) || 0;
       
       if (supply >= order.qty) {
           supplyMap.set(dateStr, supply - order.qty);
           mpsOrdersToSave.push(this.mpsOrderRepo.create({
               mpsPlan: plan,
               erpOrderLineId: order.erpOrderLineId,
               itemCode: order.erpOrderItemCode,
               itemDesc: order.erpOrderItemCode,
               productType: order.productType,
               quantityKg: order.qty,
               shipDate: order.shipDate,
               plannedProductionDate: targetProdDate,
               isManualOverride: false
           }));
       } else {
           if (supply > 0) {
               mpsOrdersToSave.push(this.mpsOrderRepo.create({
                   mpsPlan: plan,
                   erpOrderLineId: order.erpOrderLineId,
                   itemCode: order.erpOrderItemCode,
                   itemDesc: order.erpOrderItemCode,
                   productType: order.productType,
                   quantityKg: supply,
                   shipDate: order.shipDate,
                   plannedProductionDate: targetProdDate,
                   isManualOverride: false
               }));
               supplyMap.set(dateStr, 0);
           }
           const shortage = order.qty - supply;
           exceptionsToSave.push(this.exceptionRepo.create({
               mpsPlan: plan,
               erpOrderLineId: order.erpOrderLineId,
               soNumber: order.erpOrderHeaderId?.toString() || '-',
               itemCode: order.erpOrderItemCode,
               shipDate: order.shipDate,
               requiredKg: order.qty,
               shortageKg: shortage,
               reason: `No supply available for Chill on ${dateStr}`
           }));
       }
    }

    // Step 5: Map FREEZE Orders (Flexible Lead Time: -5 to -30 Days)
    for (const order of freezeOrders) {
       totalDemandKg += order.qty;
       let remainingQty = order.qty;
       const startDate = subtractDays(order.shipDate, 5);
       const endDate = subtractDays(order.shipDate, 30);
       
       for (let d = new Date(startDate); d >= endDate; d = subtractDays(d, 1)) {
           if (remainingQty <= 0) break;
           
           const dateStr = formatDate(d);
           const supply = supplyMap.get(dateStr) || 0;
           
           if (supply > 0) {
               const allocQty = Math.min(supply, remainingQty);
               mpsOrdersToSave.push(this.mpsOrderRepo.create({
                   mpsPlan: plan,
                   erpOrderLineId: order.erpOrderLineId,
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
       
       if (remainingQty > 0) {
           exceptionsToSave.push(this.exceptionRepo.create({
               mpsPlan: plan,
               erpOrderLineId: order.erpOrderLineId,
               soNumber: order.erpOrderHeaderId?.toString() || '-',
               itemCode: order.erpOrderItemCode,
               shipDate: order.shipDate,
               requiredKg: order.qty,
               shortageKg: remainingQty,
               reason: `Insufficient supply for Freeze between ${formatDate(endDate)} and ${formatDate(startDate)}`
           }));
       }
    }

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
        const d = intake.receive_date ? new Date(intake.receive_date).toISOString().split('T')[0] : null;
        if (d === dayStr) {
           intakeBirds += Number(intake.chicken_count || 0);
           const intakeKg = Number(intake.chicken_weight || 0);
           originalSupplyKg += intakeKg * 0.957 * 0.95 * 0.04 * (1 - 0.093);
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
    if (plan) {
      await this.mpsPlanRepo.remove(plan);
      return { success: true };
    }
    return { success: false, message: 'Plan not found' };
  }

  // 6. Get Single MPS Plan Details
  @Get('plans/:id')
  async getPlan(@Param('id') id: number) {
    const plan = await this.mpsPlanRepo.findOne({
      where: { id },
      relations: ['dailySummaries', 'orders', 'exceptions']
    });
    if (!plan) {
      return { success: false, message: 'Plan not found' };
    }
    return { success: true, data: plan };
  }
}
