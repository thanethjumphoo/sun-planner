import { OnModuleDestroy } from '@nestjs/common';
import * as oracledb from 'oracledb';
import { Repository } from 'typeorm';
import { StgErpItem } from './stg-erp-item.entity';
import { StgErpOrderHeader } from './stg-erp-order-header.entity';
import { StgErpOrderLine } from './stg-erp-order-line.entity';
export declare class OracleIntegrationService implements OnModuleDestroy {
    private stgErpItemRepository;
    private stgErpOrderHeaderRepository;
    private stgErpOrderLineRepository;
    private connection;
    constructor(stgErpItemRepository: Repository<StgErpItem>, stgErpOrderHeaderRepository: Repository<StgErpOrderHeader>, stgErpOrderLineRepository: Repository<StgErpOrderLine>);
    connect(): Promise<oracledb.Connection>;
    getSalesOrders(): Promise<any>;
    syncItems(itemCodes: string[]): Promise<any>;
    getLocalItems(): Promise<StgErpItem[]>;
    syncOrderHeaders(): Promise<any>;
    getLocalOrderHeaders(): Promise<StgErpOrderHeader[]>;
    syncOrderLines(): Promise<any>;
    getLocalOrderLines(): Promise<StgErpOrderLine[]>;
    saveManualOrder(data: {
        erpOrderNumber: string;
        erpOrderType: string;
        erpCustomerName: string;
        erpOrderDate: string;
        lines: {
            erpOrderItemCode: string;
            erpOrderItemQty: number;
            erpOrderShipDate: string;
        }[];
    }): Promise<any>;
    updateManualOrder(id: number, data: any): Promise<any>;
    deleteManualOrder(headerId: number): Promise<any>;
    getDemandOrders(): Promise<any[]>;
    onModuleDestroy(): Promise<void>;
}
