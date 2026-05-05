import { Repository } from 'typeorm';
import { ManualOperation } from './manual-operation.entity';
export declare class ManualOperationController {
    private readonly manualOpRepo;
    constructor(manualOpRepo: Repository<ManualOperation>);
    getManualOperations(startDate: string, endDate: string): Promise<ManualOperation[]>;
    saveManualOperations(data: any[]): Promise<{
        success: boolean;
    }>;
}
