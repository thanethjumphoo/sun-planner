import { Repository } from 'typeorm';
import { StgErpOrderLine } from './stg-erp-order-line.entity';
import { StgErpOrderHeader } from './stg-erp-order-header.entity';
import { ProductSpec } from './product-spec.entity';
import { MpsPlan, MpsPlanDaily, MpsPlanOrder } from './mps-plan.entity';
import { MpsPlanSupply } from './mps-plan-supply.entity';
import { WeightDistribution } from './weight-distribution.entity';
import { MpsExceptionReport } from './mps-exception.entity';
import { ChickenReceivingService } from './chicken-receiving/chicken-receiving.service';
export declare class MpsController {
    private orderLineRepo;
    private orderHeaderRepo;
    private specRepo;
    private mpsPlanRepo;
    private mpsDailyRepo;
    private mpsOrderRepo;
    private mpsSupplyRepo;
    private weightDistRepo;
    private exceptionRepo;
    private chickenReceivingService;
    constructor(orderLineRepo: Repository<StgErpOrderLine>, orderHeaderRepo: Repository<StgErpOrderHeader>, specRepo: Repository<ProductSpec>, mpsPlanRepo: Repository<MpsPlan>, mpsDailyRepo: Repository<MpsPlanDaily>, mpsOrderRepo: Repository<MpsPlanOrder>, mpsSupplyRepo: Repository<MpsPlanSupply>, weightDistRepo: Repository<WeightDistribution>, exceptionRepo: Repository<MpsExceptionReport>, chickenReceivingService: ChickenReceivingService);
    updateDate(body: {
        planId?: number;
        mpsOrderId?: number;
        lineId: number;
        date: string;
        splitQty?: number;
    }): Promise<{
        success: boolean;
        message: string;
    } | {
        success: boolean;
        message?: undefined;
    }>;
    autoAllocate(): Promise<{
        success: boolean;
        allocatedCount: number;
    }>;
    generatePlan(body: {
        targetMonth: string;
    }): Promise<{
        success: boolean;
        message: string;
        planId?: undefined;
        status?: undefined;
    } | {
        success: boolean;
        planId: number;
        status: string;
        message?: undefined;
    }>;
    getPlans(): Promise<MpsPlan[]>;
    deletePlan(body: any, id: number): Promise<{
        success: boolean;
        message: string;
    } | {
        success: boolean;
        message?: undefined;
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
    approvePlan(id: number): Promise<{
        success: boolean;
        message: string;
    }>;
    rejectPlan(id: number): Promise<{
        success: boolean;
        message: string;
    }>;
    getApprovedOrdersForDate(date: string): Promise<MpsPlanOrder[]>;
}
