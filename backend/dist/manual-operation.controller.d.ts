import { Repository } from 'typeorm';
import { ManualOperation } from './manual-operation.entity';
export declare class ManualOperationController {
    private readonly manualOpRepo;
    constructor(manualOpRepo: Repository<ManualOperation>);
    getManualOperations(startDate: string, endDate: string, partType: string): Promise<ManualOperation[]>;
    saveManualOperations(body: {
        data: any[];
        partType?: string;
    } | any[]): Promise<{
        success: boolean;
    }>;
}
