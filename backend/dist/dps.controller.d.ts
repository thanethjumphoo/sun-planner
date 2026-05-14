import { Repository } from 'typeorm';
import { DpsPlan, DpsSublot, DpsOrder, DpsAllocation } from './dps-plan.entity';
export declare class DpsController {
    private planRepo;
    private sublotRepo;
    private orderRepo;
    private allocationRepo;
    constructor(planRepo: Repository<DpsPlan>, sublotRepo: Repository<DpsSublot>, orderRepo: Repository<DpsOrder>, allocationRepo: Repository<DpsAllocation>);
    getPlanByDate(date: string, partType: string): Promise<{
        exists: boolean;
        data?: undefined;
    } | {
        exists: boolean;
        data: DpsPlan;
    }>;
    deletePlan(date: string, partType: string): Promise<{
        success: boolean;
    }>;
    saveGeneratedPlan(date: string, payload: any): Promise<{
        success: boolean;
        message: string;
        planId?: undefined;
    } | {
        success: boolean;
        planId: number;
        message?: undefined;
    }>;
}
