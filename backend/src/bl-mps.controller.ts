import { Controller, Get, Post, Body, Param, Put, Delete, ParseIntPipe, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlMpsPlan } from './bl-mps-plan.entity';
import { BlMpsPlanDaily } from './bl-mps-plan-daily.entity';
import { ICutMaster } from './icut-master.entity';
import { MpsPlan, MpsPlanDaily } from './mps-plan.entity';
import { MpsPlanSupply } from './mps-plan-supply.entity';

@Controller('api/bl-mps-plans')
export class BlMpsController {
  constructor(
    @InjectRepository(BlMpsPlan)
    private readonly blMpsPlanRepo: Repository<BlMpsPlan>,
    @InjectRepository(BlMpsPlanDaily)
    private readonly blMpsPlanDailyRepo: Repository<BlMpsPlanDaily>,
    @InjectRepository(ICutMaster)
    private readonly icutMasterRepo: Repository<ICutMaster>,
    @InjectRepository(MpsPlan)
    private readonly mpsPlanRepo: Repository<MpsPlan>,
  ) {}

  @Get()
  async getAllPlans() {
    return this.blMpsPlanRepo.find({ order: { createdAt: 'DESC' } });
  }

  @Get(':id')
  async getPlan(@Param('id', ParseIntPipe) id: number) {
    return this.blMpsPlanRepo.findOne({
      where: { id },
      relations: ['dailyPlans'],
    });
  }

  // Create or update by syncing from Main MPS Plan
  @Post('sync/:mainPlanId')
  async syncFromMainPlan(@Param('mainPlanId', ParseIntPipe) mainPlanId: number) {
    const mainPlan = await this.mpsPlanRepo.findOne({
      where: { id: mainPlanId },
      relations: ['dailySummaries', 'supplyBreakdown', 'supplyBreakdown.sizes'],
      relationLoadStrategy: 'query'
    });

    if (!mainPlan) throw new Error('Main MPS Plan not found');
    if (mainPlan.partType !== 'bil') throw new Error('Can only sync from BIL plans');

    // Calculate total BL Debone quantity from Main MPS Plan by parsing daily supply byProducts
    let totalBlKg = 0;
    if (mainPlan.supplyBreakdown) {
      for (const supply of mainPlan.supplyBreakdown) {
        if (supply.byProducts) {
          try {
            const bps = JSON.parse(supply.byProducts);
            // bps is an object like {"BL-DEBONE": {"name": "BL (Debone)", "qty": 70513}}
            const blBp = bps['BL-DEBONE'] || Object.values(bps).find((bp: any) => bp.name === 'BL (Debone)');
            if (blBp) {
              totalBlKg += Number((blBp as any).qty || 0);
            }
          } catch (e) {
            console.error('Error parsing byProducts', e);
          }
        }
      }
    }
    
    let totalInternalBlKg = 0;
    let totalExternalBlKg = 0;

    // Check if BL plan already exists
    let blPlan = await this.blMpsPlanRepo.findOne({ where: { parentMpsPlanId: mainPlanId } });
    
    if (!blPlan) {
      blPlan = this.blMpsPlanRepo.create({
        parentMpsPlanId: mainPlanId,
        planMonth: mainPlan.targetMonth,
        status: 'DRAFT',
      });
    }

    blPlan.totalRmBlKg = totalBlKg;
    blPlan = await this.blMpsPlanRepo.save(blPlan);

    // Create or update Daily Plans based on Main MPS supply breakdown
    if (mainPlan.supplyBreakdown) {
      // Clear existing dailies for this plan
      await this.blMpsPlanDailyRepo.delete({ blMpsPlanId: blPlan.id });
      
      const newDailies = [];
      for (const supply of mainPlan.supplyBreakdown) {
        let dailyBlKg = 0;
        if (supply.byProducts) {
          try {
            const bps = JSON.parse(supply.byProducts);
            const blBp = bps['BL-DEBONE'] || Object.values(bps).find((bp: any) => bp.name === 'BL (Debone)');
            if (blBp) {
              dailyBlKg = Number((blBp as any).qty || 0);
            }
          } catch (e) {}
        }
        
        // Save the daily sizes of BIL used as raw material for Debone (for frontend mapping)
        const bilSizes: Record<string, number> = {};
        if (supply.sizes) {
          for (const s of supply.sizes) {
             bilSizes[s.groupSize] = Number(s.quantityKg || 0);
          }
        }

        if (dailyBlKg > 0) {
          const dateStr = supply.productionDate.toString().split('T')[0];
          const dailySummary = mainPlan.dailySummaries?.find(d => {
              const dStr = typeof d.productionDate === 'string' ? d.productionDate : d.productionDate.toISOString().split('T')[0];
              return dStr === dateStr;
          });
          const internalKg = Number(dailySummary?.internalRmKg || 0);
          const externalKg = Number(dailySummary?.externalRmKg || 0);
          const totalRm = internalKg + externalKg;
          
          let internalBlKg = 0;
          let externalBlKg = 0;
          if (totalRm > 0) {
             internalBlKg = dailyBlKg * (internalKg / totalRm);
             externalBlKg = dailyBlKg * (externalKg / totalRm);
          } else {
             internalBlKg = dailyBlKg; // fallback
          }

          totalInternalBlKg += internalBlKg;
          totalExternalBlKg += externalBlKg;

          const daily = this.blMpsPlanDailyRepo.create({
            blMpsPlanId: blPlan.id,
            planDate: dateStr,
            rmBlKg: dailyBlKg,
            internalRmBlKg: internalBlKg,
            externalRmBlKg: externalBlKg,
            rmBlSizingJson: JSON.stringify(bilSizes) // Storing original BIL sizes for the frontend to map
          });
          newDailies.push(daily);
        }
      }
      
      if (newDailies.length > 0) {
        await this.blMpsPlanDailyRepo.save(newDailies);
      }
    }

    blPlan.totalInternalRmBlKg = totalInternalBlKg;
    blPlan.totalExternalRmBlKg = totalExternalBlKg;
    await this.blMpsPlanRepo.save(blPlan);

    return this.blMpsPlanRepo.findOne({ where: { id: blPlan.id }, relations: ['dailyPlans'] });
  }

  @Get('master/icuts')
  async getICutMaster() {
    return this.icutMasterRepo.find();
  }
}
