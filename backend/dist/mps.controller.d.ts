import { Repository } from 'typeorm';
import { StgErpOrderLine } from './stg-erp-order-line.entity';
import { ProductSpec } from './product-spec.entity';
import { MpsPlan, MpsPlanDaily, MpsPlanOrder } from './mps-plan.entity';
import { ChickenReceivingService } from './chicken-receiving/chicken-receiving.service';
export declare class MpsController {
    private orderLineRepo;
    private specRepo;
    private mpsPlanRepo;
    private mpsDailyRepo;
    private mpsOrderRepo;
    private chickenReceivingService;
    constructor(orderLineRepo: Repository<StgErpOrderLine>, specRepo: Repository<ProductSpec>, mpsPlanRepo: Repository<MpsPlan>, mpsDailyRepo: Repository<MpsPlanDaily>, mpsOrderRepo: Repository<MpsPlanOrder>, chickenReceivingService: ChickenReceivingService);
    updateDate(body: {
        lineId: number;
        date: string;
    }): Promise<{
        success: boolean;
        message?: undefined;
    } | {
        success: boolean;
        message: string;
    }>;
    autoAllocate(): Promise<{
        success: boolean;
        allocatedCount: number;
    }>;
    generatePlan(body: {
        targetMonth: string;
    }): Promise<{
        success: boolean;
        planId: number;
        status: string;
    }>;
}
