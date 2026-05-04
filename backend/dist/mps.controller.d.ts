import { Repository } from 'typeorm';
import { StgErpOrderLine } from './stg-erp-order-line.entity';
import { ProductSpec } from './product-spec.entity';
import { MpsPlan, MpsPlanDaily, MpsPlanOrder } from './mps-plan.entity';
import { MpsExceptionReport } from './mps-exception.entity';
import { ChickenReceivingService } from './chicken-receiving/chicken-receiving.service';
export declare class MpsController {
    private orderLineRepo;
    private specRepo;
    private mpsPlanRepo;
    private mpsDailyRepo;
    private mpsOrderRepo;
    private exceptionRepo;
    private chickenReceivingService;
    constructor(orderLineRepo: Repository<StgErpOrderLine>, specRepo: Repository<ProductSpec>, mpsPlanRepo: Repository<MpsPlan>, mpsDailyRepo: Repository<MpsPlanDaily>, mpsOrderRepo: Repository<MpsPlanOrder>, exceptionRepo: Repository<MpsExceptionReport>, chickenReceivingService: ChickenReceivingService);
    updateDate(body: {
        planId?: number;
        mpsOrderId?: number;
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
    getPlans(): Promise<MpsPlan[]>;
    deletePlan(body: any, id: number): Promise<{
        success: boolean;
        message?: undefined;
    } | {
        success: boolean;
        message: string;
    }>;
    getPlan(id: number): Promise<{
        success: boolean;
        message: string;
        data?: undefined;
    } | {
        success: boolean;
        data: MpsPlan;
        message?: undefined;
    }>;
}
