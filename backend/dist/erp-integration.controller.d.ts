import { Repository } from 'typeorm';
import { TargetSyncItem } from './target-sync-item.entity';
import { OracleIntegrationService } from './oracle-integration.service';
export declare class ErpIntegrationController {
    private targetItemRepo;
    private oracleService;
    constructor(targetItemRepo: Repository<TargetSyncItem>, oracleService: OracleIntegrationService);
    getItems(): Promise<import("./stg-erp-item.entity").StgErpItem[]>;
    getTargetItems(): Promise<string[]>;
    addTargetItems(body: {
        itemCodes: string[];
    }): Promise<{
        success: boolean;
    }>;
    removeTargetItem(code: string): Promise<{
        success: boolean;
    }>;
    syncTargetItems(): Promise<{
        message: string;
        success?: undefined;
        count?: undefined;
        data?: undefined;
    } | {
        success: boolean;
        count: any;
        data: any;
        message?: undefined;
    }>;
    syncOrderHeaders(): Promise<{
        success: boolean;
        count: any;
        data: any;
    }>;
    getOrderHeaders(): Promise<import("./stg-erp-order-header.entity").StgErpOrderHeader[]>;
    syncOrderLines(): Promise<{
        success: boolean;
        count: any;
        data: any;
    }>;
    getOrderLines(): Promise<import("./stg-erp-order-line.entity").StgErpOrderLine[]>;
    getDemandOrders(): Promise<any[]>;
    createManualOrder(body: any): Promise<any>;
    updateManualOrder(id: number, body: any): Promise<any>;
    deleteManualOrder(id: number): Promise<any>;
}
