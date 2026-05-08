import { Repository } from 'typeorm';
import { ProductSpec } from './product-spec.entity';
import { StgErpItem } from './stg-erp-item.entity';
export declare class ProductSpecController {
    private productSpecRepo;
    private stgItemRepo;
    constructor(productSpecRepo: Repository<ProductSpec>, stgItemRepo: Repository<StgErpItem>);
    getErpItems(search?: string): Promise<StgErpItem[]>;
    getAll(): Promise<{
        erpItemDesc: string;
        id: number;
        erpItemId: number;
        erpItemCode: string;
        erpItemType: string;
        productType: string;
        productSize: string;
        productYield: number;
        productWeight: number;
        productSpeed: number;
        productLead: number;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    getOne(id: number): Promise<ProductSpec | null>;
    create(body: {
        erpItemId: number;
        erpItemCode: string;
        erpItemDesc: string;
        erpItemType: string;
        productType: string;
        productSize: string;
        productYield: number;
        productWeight: number;
        productSpeed: number;
        productLead: number;
    }): Promise<{
        success: boolean;
        message: string;
        data?: undefined;
    } | {
        success: boolean;
        data: ProductSpec;
        message?: undefined;
    }>;
    update(id: number, body: {
        productType?: string;
        productSize?: string;
        productYield?: number;
        productWeight?: number;
        productSpeed?: number;
        productLead?: number;
    }): Promise<{
        success: boolean;
        message: string;
        data?: undefined;
    } | {
        success: boolean;
        data: ProductSpec;
        message?: undefined;
    }>;
    bulkCreate(body: {
        items: Array<{
            erpItemId: number;
            erpItemCode: string;
            erpItemDesc: string;
            erpItemType: string;
        }>;
        productType: string;
        productSize: string;
        productYield: number;
        productWeight: number;
        productSpeed: number;
        productLead: number;
    }): Promise<{
        success: boolean;
        results: ({
            itemCode: string;
            status: string;
            message: string;
            data?: undefined;
        } | {
            itemCode: string;
            status: string;
            data: ProductSpec;
            message?: undefined;
        })[];
    }>;
}
