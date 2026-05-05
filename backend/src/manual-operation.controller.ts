import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { ManualOperation } from './manual-operation.entity';

@Controller('api/manual-operation')
export class ManualOperationController {
  constructor(
    @InjectRepository(ManualOperation)
    private readonly manualOpRepo: Repository<ManualOperation>
  ) {}

  @Get()
  async getManualOperations(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    if (!startDate || !endDate) {
      return this.manualOpRepo.find();
    }
    return this.manualOpRepo.find({
      where: {
        productionDate: Between(new Date(startDate), new Date(endDate))
      }
    });
  }

  @Post('save')
  async saveManualOperations(@Body() data: any[]) {
    // data is an array of operations to save
    for (const op of data) {
      const existing = await this.manualOpRepo.findOne({
        where: { productionDate: new Date(op.date) }
      });

      if (existing) {
        if (op.plannedStationWorkers !== undefined) existing.plannedStationWorkers = op.plannedStationWorkers;
        if (op.actualStationWorkers !== undefined) existing.actualStationWorkers = op.actualStationWorkers;
        if (op.actualCuttingWorkers !== undefined) existing.actualCuttingWorkers = op.actualCuttingWorkers;
        await this.manualOpRepo.save(existing);
      } else {
        const newOp = this.manualOpRepo.create({
          productionDate: new Date(op.date),
          plannedStationWorkers: op.plannedStationWorkers || 0,
          actualStationWorkers: op.actualStationWorkers || 0,
          actualCuttingWorkers: op.actualCuttingWorkers || 0
        });
        await this.manualOpRepo.save(newOp);
      }
    }
    return { success: true };
  }
}
