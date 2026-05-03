import { ChickenReceivingService } from './chicken-receiving.service';
export declare class ChickenReceivingController {
    private readonly chickenReceivingService;
    constructor(chickenReceivingService: ChickenReceivingService);
    createBatch(type: string, data: {
        rows: any[];
    }): Promise<any[]>;
    create(type: string, data: any): Promise<any>;
    findAll(type: string): Promise<any[]>;
    update(type: string, id: string, data: any): Promise<any>;
    remove(type: string, id: string): Promise<{
        deleted: boolean;
        id: string;
    }>;
}
