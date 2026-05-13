import { Repository } from 'typeorm';
import { MasterYield } from './master-yield.entity';
export declare class MasterYieldController {
    private readonly masterYieldRepository;
    constructor(masterYieldRepository: Repository<MasterYield>);
    getTree(): Promise<MasterYield[]>;
    createNode(data: Partial<MasterYield>): Promise<MasterYield>;
    updateNode(id: string, data: Partial<MasterYield>): Promise<MasterYield | null>;
    deleteNode(id: string): Promise<{
        success: boolean;
    }>;
}
