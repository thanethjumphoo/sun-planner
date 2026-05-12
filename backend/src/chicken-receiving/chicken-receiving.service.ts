import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChickenReceivingPlanMonthly } from './entities/monthly-plan.entity';
import { ChickenReceivingPlanWeekly } from './entities/weekly-plan.entity';
import { ChickenReceivingPlanDaily } from './entities/daily-plan.entity';
import { ChickenReceivingActualDaily } from './entities/actual-daily.entity';

@Injectable()
export class ChickenReceivingService {
  constructor(
    @InjectRepository(ChickenReceivingPlanMonthly)
    private monthlyRepo: Repository<ChickenReceivingPlanMonthly>,

    @InjectRepository(ChickenReceivingPlanWeekly)
    private weeklyRepo: Repository<ChickenReceivingPlanWeekly>,

    @InjectRepository(ChickenReceivingPlanDaily)
    private dailyRepo: Repository<ChickenReceivingPlanDaily>,

    @InjectRepository(ChickenReceivingActualDaily)
    private actualRepo: Repository<ChickenReceivingActualDaily>,
  ) { }

  private getRepo(type: string): Repository<any> {
    switch (type) {
      case 'monthly':
        return this.monthlyRepo;
      case 'weekly':
        return this.weeklyRepo;
      case 'daily':
        return this.dailyRepo;
      case 'actual':
        return this.actualRepo;
      default:
        throw new BadRequestException(`Invalid plan type: ${type}`);
    }
  }

  async create(type: string, data: any) {
    const repo = this.getRepo(type);
    // Remove empty strings to avoid type issues with numbers/dates
    const cleanData = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, v === '' ? null : v])
    );
    const newEntry = repo.create(cleanData);
    return await repo.save(newEntry);
  }

  async findAll(type: string) {
    const repo = this.getRepo(type);
    return await repo.find({
      order: {
        receive_date: 'ASC',
      },
    });
  }

  async update(type: string, id: string, data: any) {
    const repo = this.getRepo(type);
    const cleanData = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, v === '' ? null : v])
    );
    await repo.update(id, cleanData);
    return await repo.findOne({ where: { id } });
  }

  async remove(type: string, id: string) {
    const repo = this.getRepo(type);
    await repo.delete(id);
    return { deleted: true, id };
  }

  async createBatch(type: string, rows: any[]) {
    const repo = this.getRepo(type);
    const cleaned = rows.map(row =>
      Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k, v === '' ? null : v])
      )
    );
    const entities = repo.create(cleaned);
    return await repo.save(entities, { chunk: 100 });
  }
}
