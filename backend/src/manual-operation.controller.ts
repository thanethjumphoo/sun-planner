import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { ManualOperation } from './manual-operation.entity';

@Controller('api/manual-operation')
export class ManualOperationController {
  constructor(
    @InjectRepository(ManualOperation)
    private readonly manualOpRepo: Repository<ManualOperation>,
  ) {}

  @Get()
  async getManualOperations(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('partType') partType: string,
  ) {
    const pt = partType || 'fillet';
    if (!startDate || !endDate) {
      return this.manualOpRepo.find({ where: { partType: pt } });
    }
    return this.manualOpRepo.find({
      where: {
        productionDate: Between(new Date(startDate), new Date(endDate)),
        partType: pt,
      },
    });
  }

  @Post('save')
  async saveManualOperations(
    @Body() body: { data: any[]; partType?: string } | any[],
  ) {
    // Support both old format (array) and new format ({ data, partType })
    let data: any[];
    let partType: string;
    if (Array.isArray(body)) {
      data = body;
      partType = 'fillet';
    } else {
      data = body.data || [];
      partType = body.partType || 'fillet';
    }

    for (const op of data) {
      const existing = await this.manualOpRepo.findOne({
        where: { productionDate: new Date(op.date), partType },
      });

      if (existing) {
        if (op.plannedStationWorkers !== undefined)
          existing.plannedStationWorkers = op.plannedStationWorkers;
        if (op.actualStationWorkers !== undefined)
          existing.actualStationWorkers = op.actualStationWorkers;
        if (op.actualCuttingWorkers !== undefined)
          existing.actualCuttingWorkers = op.actualCuttingWorkers;
        await this.manualOpRepo.save(existing);
      } else {
        const newOp = this.manualOpRepo.create({
          productionDate: new Date(op.date),
          partType,
          plannedStationWorkers: op.plannedStationWorkers || 0,
          actualStationWorkers: op.actualStationWorkers || 0,
          actualCuttingWorkers: op.actualCuttingWorkers || 0,
        });
        await this.manualOpRepo.save(newOp);
      }
    }
    return { success: true };
  }
}
