import { Repository } from 'typeorm';
import { ChickenReceivingPlanMonthly } from './entities/monthly-plan.entity';
import { ChickenReceivingPlanWeekly } from './entities/weekly-plan.entity';
import { ChickenReceivingPlanDaily } from './entities/daily-plan.entity';
import { ChickenReceivingActualDaily } from './entities/actual-daily.entity';
export declare class ChickenReceivingService {
    private monthlyRepo;
    private weeklyRepo;
    private dailyRepo;
    private actualRepo;
    constructor(monthlyRepo: Repository<ChickenReceivingPlanMonthly>, weeklyRepo: Repository<ChickenReceivingPlanWeekly>, dailyRepo: Repository<ChickenReceivingPlanDaily>, actualRepo: Repository<ChickenReceivingActualDaily>);
    private getRepo;
    create(type: string, data: any): Promise<any>;
    findAll(type: string): Promise<any[]>;
    update(type: string, id: string, data: any): Promise<any>;
    remove(type: string, id: string): Promise<{
        deleted: boolean;
        id: string;
    }>;
    createBatch(type: string, rows: any[]): Promise<any[]>;
}
