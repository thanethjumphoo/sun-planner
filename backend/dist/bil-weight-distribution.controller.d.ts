import { Repository } from 'typeorm';
import { BilWeightDistribution } from './bil-weight-distribution.entity';
export declare class BilWeightDistributionController {
    private wdRepo;
    constructor(wdRepo: Repository<BilWeightDistribution>);
    getAll(): Promise<{
        rowLabels: string[];
        colLabels: string[];
        matrix: Record<string, Record<string, number>>;
        totalRecords: number;
    }>;
    bulkSave(body: {
        rowLabels: string[];
        colLabels: string[];
        matrix: Record<string, Record<string, number>>;
    }): Promise<{
        success: boolean;
        count: number;
    }>;
}
