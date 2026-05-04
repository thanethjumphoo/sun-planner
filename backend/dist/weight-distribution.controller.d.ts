import { Repository } from 'typeorm';
import { WeightDistribution } from './weight-distribution.entity';
export declare class WeightDistributionController {
    private wdRepo;
    constructor(wdRepo: Repository<WeightDistribution>);
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
