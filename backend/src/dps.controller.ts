import { Controller, Get, Post, Put, Delete, Body, Param, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DpsPlan, DpsSublot, DpsSublotBin, DpsOrder, DpsAllocation } from './dps-plan.entity';

@Controller('api/dps')
export class DpsController {
  constructor(
    @InjectRepository(DpsPlan) private planRepo: Repository<DpsPlan>,
    @InjectRepository(DpsSublot) private sublotRepo: Repository<DpsSublot>,
    @InjectRepository(DpsOrder) private orderRepo: Repository<DpsOrder>,
    @InjectRepository(DpsAllocation) private allocationRepo: Repository<DpsAllocation>,
  ) {}

  @Get(':date')
  async getPlanByDate(@Param('date') date: string) {
    const plan = await this.planRepo.findOne({
      where: { productionDate: new Date(date) },
      relations: [
        'sublots', 
        'sublots.bins', 
        'orders', 
        'allocations', 
        'allocations.sourceBin', 
        'allocations.sourceBin.sublot',
        'allocations.targetOrder'
      ],
    });
    if (!plan) return { exists: false };
    return { exists: true, data: plan };
  }

  @Delete(':date')
  async deletePlan(@Param('date') date: string) {
    const existing = await this.planRepo.findOne({ where: { productionDate: new Date(date) } });
    if (existing) {
      await this.planRepo.remove(existing);
    }
    return { success: true };
  }

  @Post(':date/generate')
  async saveGeneratedPlan(@Param('date') date: string, @Body() payload: any) {
    // 1. Delete existing if any (to replace)
    const existing = await this.planRepo.findOne({ where: { productionDate: new Date(date) } });
    if (existing) {
      await this.planRepo.remove(existing);
    }

    // 2. Map frontend payload to entities
    const plan = this.planRepo.create({
      productionDate: new Date(date),
      status: 'CONFIRMED',
      totalSupplyKg: payload.totalSupplyKg,
      totalDemandKg: payload.totalDemandKg,
      fulfillmentRate: payload.fulfillmentRate,
    });

    // Map sublots
    plan.sublots = payload.sublots.map((sl: any) => {
      const sublot = new DpsSublot();
      sublot.sublotNumber = sl.id;
      sublot.farmName = sl.farmName;
      sublot.totalBirds = Math.round(sl.totalBirds);
      sublot.totalWeightKg = Math.round(sl.totalWeightKg);
      sublot.avgLiveWeight = sl.avgLiveWeight;
      sublot.coProductKg = Number((sl.coProductKg || 0).toFixed(1));

      sublot.bins = Object.keys(sl.bins).map(binKey => {
        const bin = new DpsSublotBin();
        bin.sizeLabel = binKey;
        bin.availableKg = Number((sl.bins[binKey] || 0).toFixed(1));
        return bin;
      });

      return sublot;
    });

    // Map orders
    plan.orders = payload.orders.map((o: any) => {
      const order = new DpsOrder();
      order.erpOrderLineId = parseInt(o.id.replace('L-', '')) || 0;
      order.itemCode = o.itemCode;
      order.itemDesc = o.itemDesc;
      order.productType = o.type;
      order.productSize = o.size;
      order.requiredKg = Number(o.qty.toFixed(1));
      order.fulfilledKg = Number(o.fulfilledKg.toFixed(1));
      order.unfulfilledKg = Number(o.unfulfilledKg.toFixed(1));
      return order;
    });

    // Map allocations (need to link to sublot bins and orders)
    // Since we are creating them all at once, TypeORM might not easily link them if we just set relations by instances that are not yet saved.
    // Let's save the plan first with sublots and orders, then add allocations.
    const savedPlan = await this.planRepo.save(plan);

    // Reload to get IDs
    const reloadedPlan = await this.planRepo.findOne({
      where: { id: savedPlan.id },
      relations: ['sublots', 'sublots.bins', 'orders'],
    });

    if (!reloadedPlan) return { success: false, message: 'Plan not found after saving' };

    // Build allocations
    const allocationsToSave = [];
    for (const alloc of payload.allocations) {
      const dbSublot = reloadedPlan.sublots.find(s => s.sublotNumber === alloc.sublotId);
      if (!dbSublot) continue;
      
      const dbBin = dbSublot.bins.find(b => b.sizeLabel === alloc.size);
      const dbOrder = reloadedPlan.orders.find(o => `L-${o.erpOrderLineId}` === alloc.orderId);
      
      if (!dbOrder) continue;

      const newAlloc = this.allocationRepo.create({
        dpsPlan: reloadedPlan,
        sourceBin: dbBin,
        targetOrder: dbOrder,
        allocatedKg: Number(alloc.qty.toFixed(1)),
        allocationPass: 'Auto',
      });
      allocationsToSave.push(newAlloc);
    }

    if (allocationsToSave.length > 0) {
      await this.allocationRepo.save(allocationsToSave);
    }

    return { success: true, planId: savedPlan.id };
  }
}
