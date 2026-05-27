const fs = require('fs');
const path = require('path');

const controllerCode = `import { Controller, Post, Body, Get, Param, Res, Query, ParseIntPipe } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, In } from 'typeorm';
import { BlMpsPlan } from './bl-mps-plan.entity';
import { BlMpsPlanDaily } from './bl-mps-plan-daily.entity';
import { ICutMaster } from './icut-master.entity';
import { MpsPlan } from './mps-plan.entity';
import { MpsPlanSupply } from './mps-plan-supply.entity';
import { ProductSpec } from './product-spec.entity';
import { MasterYield } from './master-yield.entity';
import { StgErpOrderLine } from './stg-erp-order-line.entity';
import { StgErpOrderHeader } from './stg-erp-order-header.entity';
import { ExternalRmSupply } from './external-rm-supply.entity';
import { MachineConfig } from './machine-config.entity';

@Controller('api/bl-mps-plans')
export class BlMpsController {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(BlMpsPlan)
    private readonly blMpsPlanRepo: Repository<BlMpsPlan>,
    @InjectRepository(BlMpsPlanDaily)
    private readonly blMpsPlanDailyRepo: Repository<BlMpsPlanDaily>,
    @InjectRepository(ICutMaster)
    private readonly icutMasterRepo: Repository<ICutMaster>,
    @InjectRepository(MpsPlan)
    private readonly mpsPlanRepo: Repository<MpsPlan>,
    @InjectRepository(ProductSpec)
    private readonly specRepo: Repository<ProductSpec>,
    @InjectRepository(MasterYield)
    private readonly masterYieldRepo: Repository<MasterYield>,
    @InjectRepository(StgErpOrderLine)
    private readonly orderLineRepo: Repository<StgErpOrderLine>,
    @InjectRepository(StgErpOrderHeader)
    private readonly orderHeaderRepo: Repository<StgErpOrderHeader>,
    @InjectRepository(ExternalRmSupply)
    private readonly externalRmRepo: Repository<ExternalRmSupply>,
    @InjectRepository(MachineConfig)
    private readonly machineConfigRepo: Repository<MachineConfig>,
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

  @Get('master/icuts')
  async getICutMaster() {
    return this.icutMasterRepo.find();
  }

  private async getBlItemCodes(): Promise<string[] | null> {
    const allNodes = await this.masterYieldRepo.find();
    const rootNodes = allNodes.filter(n => n.type === 'ROOT' && n.name === 'BL Processing');
    if (rootNodes.length === 0) return null;

    const nodeIds: string[] = [];
    const collectTree = (parentId: string) => {
      const children = allNodes.filter(n => n.parentId === parentId);
      for (const child of children) {
        nodeIds.push(child.id);
        collectTree(child.id);
      }
    };

    for (const r of rootNodes) {
      nodeIds.push(r.id);
      collectTree(r.id);
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

  @Post('generate/:mainPlanId')
  async generatePlan(@Param('mainPlanId', ParseIntPipe) mainPlanId: number) {
    const mainPlan = await this.mpsPlanRepo.findOne({
      where: { id: mainPlanId },
      relations: ['dailySummaries', 'supplyBreakdown', 'supplyBreakdown.sizes'],
      relationLoadStrategy: 'query'
    });

    if (!mainPlan) throw new Error('Main MPS Plan not found');
    if (mainPlan.partType !== 'bil') throw new Error('Can only sync from BIL plans');

    const allowedItemCodes = await this.getBlItemCodes();
    if (!allowedItemCodes) throw new Error('No BL item codes found in Master Yield');

    const specMap = new Map<string, ProductSpec>();
    const specs = await this.specRepo.find();
    specs.forEach(s => specMap.set(s.erpItemCode, s));

    const allYieldNodes = await this.masterYieldRepo.find();

    const findNode = (nodes: MasterYield[], idOrName: string) => {
      return nodes.find(n => n.id === idOrName || n.name === idOrName);
    };

    const isByproductSpec = (spec: ProductSpec): boolean => {
      if (!spec || !spec.masterYieldIds) return false;
      const ids = spec.masterYieldIds.split(',').map(id => id.trim());
      return ids.some(id => {
        const node = findNode(allYieldNodes, id);
        return node && (node.type === 'BY-PRODUCT' || node.type === 'CO-PRODUCT');
      });
    };

    // Calculate daily RM from parent plan
    let totalRmBlKg = 0;
    let totalRmBlThKg = 0;
    let totalRmBlDrKg = 0;
    let totalInternalRmBlKg = 0;
    let totalExternalRmBlKg = 0;

    const dailySupplyMap = new Map<string, any>(); // date -> { rmBlKg, rmBlThKg, rmBlDrKg, rmBreakdownJson }

    if (mainPlan.supplyBreakdown) {
      for (const supply of mainPlan.supplyBreakdown) {
        let dailyBlKg = 0;
        let dailyBlThKg = 0;
        let dailyBlDrKg = 0;

        if (supply.byProducts) {
          try {
            const bps = JSON.parse(supply.byProducts);
            const blBp = bps['BL-DEBONE'] || Object.values(bps).find((bp: any) => bp.name === 'BL (Debone)');
            if (blBp) dailyBlKg = Number((blBp as any).qty || 0);

            const thBp = Object.values(bps).find((bp: any) => bp.name === 'สะโพก');
            if (thBp) dailyBlThKg = Number((thBp as any).qty || 0) * 0.75; // Toridas yield 75%

            const drBp = Object.values(bps).find((bp: any) => bp.name === 'น่อง');
            if (drBp) dailyBlDrKg = Number((drBp as any).qty || 0) * 0.75; // Toridas yield 75%
          } catch (e) {
            console.error('Error parsing byProducts', e);
          }
        }

        const dateStr = typeof supply.productionDate === 'string' ? supply.productionDate : supply.productionDate.toISOString().split('T')[0];
        
        const bilSizes: Record<string, number> = {};
        if (supply.sizes) {
          for (const s of supply.sizes) {
             bilSizes[s.groupSize] = Number(s.quantityKg || 0);
          }
        }

        const breakdown = {
          "BL": { kg: dailyBlKg, sizes: bilSizes },
          "BL-TH": { kg: dailyBlThKg },
          "BL-DR": { kg: dailyBlDrKg }
        };

        dailySupplyMap.set(dateStr, {
          rmBlKg: dailyBlKg + dailyBlThKg + dailyBlDrKg,
          rmBlThKg: dailyBlThKg,
          rmBlDrKg: dailyBlDrKg,
          rmBreakdownJson: JSON.stringify(breakdown),
          originalBlKg: dailyBlKg
        });

        const dailySummary = mainPlan.dailySummaries?.find(d => {
            const dStr = typeof d.productionDate === 'string' ? d.productionDate : d.productionDate.toISOString().split('T')[0];
            return dStr === dateStr;
        });

        const internalKg = Number(dailySummary?.internalRmKg || 0);
        const externalKg = Number(dailySummary?.externalRmKg || 0);
        const totalRm = internalKg + externalKg;
        
        if (totalRm > 0) {
           totalInternalRmBlKg += dailyBlKg * (internalKg / totalRm);
           totalExternalRmBlKg += dailyBlKg * (externalKg / totalRm);
        } else {
           totalInternalRmBlKg += dailyBlKg;
        }

        totalRmBlKg += dailyBlKg + dailyBlThKg + dailyBlDrKg;
        totalRmBlThKg += dailyBlThKg;
        totalRmBlDrKg += dailyBlDrKg;
      }
    }

    // Fetch orders
    const year = parseInt(mainPlan.targetMonth.split('-')[0]);
    const month = parseInt(mainPlan.targetMonth.split('-')[1]);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const orderLines = await this.orderLineRepo.find({
      where: {
        itemCode: In(allowedItemCodes),
        shipDate: Between(startDate, endDate)
      },
      relations: ['header']
    });

    const mpsOrdersToSave: any[] = [];
    let totalDemandKg = 0;

    const dayDemand = new Map<string, number>();

    for (const order of orderLines) {
      const spec = specMap.get(order.itemCode);
      if (!spec || isByproductSpec(spec)) continue;

      const leadTime = spec.minProductLead || 1;
      const shipDate = new Date(order.shipDate);
      const prodDate = new Date(shipDate);
      prodDate.setDate(prodDate.getDate() - leadTime);
      const prodDateStr = prodDate.toISOString().split('T')[0];

      if (dailySupplyMap.has(prodDateStr)) {
        mpsOrdersToSave.push({
          itemCode: order.itemCode,
          quantityKg: order.quantityKg,
          plannedProductionDate: prodDate,
          spec
        });
        dayDemand.set(prodDateStr, (dayDemand.get(prodDateStr) || 0) + order.quantityKg);
        totalDemandKg += order.quantityKg;
      }
    }

    // Generate by-products
    const dailyByproductSupply = new Map<string, Record<string, any>>();
    
    mpsOrdersToSave.forEach(order => {
      const spec = order.spec;
      const processIds = spec.masterYieldIds ? spec.masterYieldIds.split(',').map((id: any) => id.trim()) : [];
      const pId = processIds[0];
      if (pId) {
        const node = findNode(allYieldNodes, pId);
        if (node) {
          const processNode = node.parentId ? findNode(allYieldNodes, node.parentId) : node;
          if (processNode) {
            const siblings = allYieldNodes.filter(n => n.parentId === processNode.id && (n.type === 'BY-PRODUCT' || n.type === 'CO-PRODUCT'));
            const yieldPct = spec.productYield ? Number(spec.productYield) : 1;
            const rm = order.quantityKg / yieldPct;
            
            const prodDateStr = typeof order.plannedProductionDate === 'string' ? order.plannedProductionDate : order.plannedProductionDate.toISOString().split('T')[0];
            
            if (!dailyByproductSupply.has(prodDateStr)) {
              dailyByproductSupply.set(prodDateStr, {});
            }
            const daySupply = dailyByproductSupply.get(prodDateStr)!;
            
            siblings.forEach(child => {
              if (!daySupply[child.id]) {
                daySupply[child.id] = { name: child.name, qty: 0, processName: processNode.name };
              }
              const childYield = child.yieldPercentage ? Number(child.yieldPercentage) : 0;
              daySupply[child.id].qty += rm * childYield;
            });
          }
        }
      }
    });

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let blPlan = await queryRunner.manager.findOne(BlMpsPlan, { where: { parentMpsPlanId: mainPlanId } });
      if (!blPlan) {
        blPlan = queryRunner.manager.create(BlMpsPlan, {
          parentMpsPlanId: mainPlanId,
          planMonth: mainPlan.targetMonth,
          status: 'DRAFT'
        });
      }

      blPlan.totalRmBlKg = totalRmBlKg;
      blPlan.totalRmBlThKg = totalRmBlThKg;
      blPlan.totalRmBlDrKg = totalRmBlDrKg;
      blPlan.totalInternalRmBlKg = totalInternalRmBlKg;
      blPlan.totalExternalRmBlKg = totalExternalRmBlKg;
      blPlan.totalDemandBlKg = totalDemandKg; 
      blPlan.totalDemandKg = totalDemandKg;
      
      blPlan = await queryRunner.manager.save(BlMpsPlan, blPlan);

      await queryRunner.manager.delete(BlMpsPlanDaily, { blMpsPlanId: blPlan.id });

      const dailies = Array.from(dailySupplyMap.entries()).map(([dateStr, supply]) => {
        return queryRunner.manager.create(BlMpsPlanDaily, {
          blMpsPlanId: blPlan.id,
          planDate: dateStr,
          rmBlKg: supply.originalBlKg + supply.rmBlThKg + supply.rmBlDrKg, // total RM BL
          internalRmBlKg: supply.originalBlKg > 0 ? (totalInternalRmBlKg / (totalInternalRmBlKg + totalExternalRmBlKg)) * supply.originalBlKg : 0,
          externalRmBlKg: supply.originalBlKg > 0 ? (totalExternalRmBlKg / (totalInternalRmBlKg + totalExternalRmBlKg)) * supply.originalBlKg : 0,
          rmBlThKg: supply.rmBlThKg,
          rmBlDrKg: supply.rmBlDrKg,
          rmBreakdownJson: supply.rmBreakdownJson,
          demandKg: dayDemand.get(dateStr) || 0,
          byProducts: dailyByproductSupply.has(dateStr) ? JSON.stringify(dailyByproductSupply.get(dateStr)) : null
        });
      });

      if (dailies.length > 0) {
        await queryRunner.manager.save(BlMpsPlanDaily, dailies);
      }

      await queryRunner.commitTransaction();
      
      return this.blMpsPlanRepo.findOne({ where: { id: blPlan.id }, relations: ['dailyPlans'] });
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
\`;

fs.writeFileSync(path.join(__dirname, 'src', 'bl-mps.controller.ts'), controllerCode);
console.log('bl-mps.controller.ts generated');
