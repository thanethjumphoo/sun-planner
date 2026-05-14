import * as express from 'express';
import { Repository } from 'typeorm';
import { StgErpOrderLine } from './stg-erp-order-line.entity';
import { StgErpOrderHeader } from './stg-erp-order-header.entity';
import { ProductSpec } from './product-spec.entity';
import { MpsPlan, MpsPlanDaily, MpsPlanOrder } from './mps-plan.entity';
import { MpsPlanSupply } from './mps-plan-supply.entity';
import { WeightDistribution } from './weight-distribution.entity';
import { FilletSizeCalc, FilletConfig } from './fillet-size.entity';
import { MpsExceptionReport } from './mps-exception.entity';
import { ChickenReceivingService } from './chicken-receiving/chicken-receiving.service';
import { ManualOperation } from './manual-operation.entity';
import { StgErpItem } from './stg-erp-item.entity';
import { MasterYield } from './master-yield.entity';
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
    private filletSizeRepo;
    private filletConfigRepo;
    private manualOpRepo;
    private itemRepo;
    private masterYieldRepo;
    private chickenReceivingService;
    constructor(orderLineRepo: Repository<StgErpOrderLine>, orderHeaderRepo: Repository<StgErpOrderHeader>, specRepo: Repository<ProductSpec>, mpsPlanRepo: Repository<MpsPlan>, mpsDailyRepo: Repository<MpsPlanDaily>, mpsOrderRepo: Repository<MpsPlanOrder>, mpsSupplyRepo: Repository<MpsPlanSupply>, weightDistRepo: Repository<WeightDistribution>, exceptionRepo: Repository<MpsExceptionReport>, filletSizeRepo: Repository<FilletSizeCalc>, filletConfigRepo: Repository<FilletConfig>, manualOpRepo: Repository<ManualOperation>, itemRepo: Repository<StgErpItem>, masterYieldRepo: Repository<MasterYield>, chickenReceivingService: ChickenReceivingService);
    private getItemCodesByPartType;
    getAllowedItems(partType: string): Promise<{
        partType: string;
        itemCodes: string[];
    }>;
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
        orderStartDate?: string;
        orderEndDate?: string;
        partType?: string;
        _allocatedMap?: Map<number, number>;
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
    generateRange(body: {
        orderStartDate: string;
        orderEndDate: string;
        partType?: string;
    }): Promise<{
        success: boolean;
        message: string;
        results?: undefined;
    } | {
        success: boolean;
        results: any[];
        message?: undefined;
    }>;
    getPlans(partType: string): Promise<MpsPlan[]>;
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
    getApprovedOrdersForDate(date: string): Promise<{
        priority: any;
        id: number;
        mpsPlan: MpsPlan;
        erpOrderLineId: number;
        soNumber: string;
        itemCode: string;
        itemDesc: string;
        productType: string;
        quantityKg: number;
        shipDate: Date;
        plannedProductionDate: Date;
        finishedProductionDate: Date;
        isManualOverride: boolean;
    }[]>;
    updatePriorities(body: {
        priorities: {
            lineId: number;
            priority: number | null;
        }[];
    }): Promise<{
        success: boolean;
        message: string;
        updated?: undefined;
    } | {
        success: boolean;
        updated: number;
        message?: undefined;
    }>;
    exportPlan(id: number, res: express.Response): Promise<express.Response<any, Record<string, any>> | undefined>;
}
