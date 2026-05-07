import { Repository } from 'typeorm';
import { FilletConfig, FilletGroup, FilletSizeCalc } from './fillet-size.entity';
export declare class FilletSizeController {
    private configRepo;
    private groupRepo;
    private calcRepo;
    constructor(configRepo: Repository<FilletConfig>, groupRepo: Repository<FilletGroup>, calcRepo: Repository<FilletSizeCalc>);
    getAll(): Promise<{
        filletYield: number;
        groups: {
            id: number;
            name: string;
            sortOrder: number;
        }[];
        calcs: {
            id: number;
            colLabel: string;
            lbWeight: number;
            filletSize: number;
            groupName: string | null;
            sortOrder: number;
        }[];
    }>;
    saveYield(body: {
        filletYield: number;
    }): Promise<{
        success: boolean;
        filletYield: number;
    }>;
    saveCalc(body: {
        items: {
            colLabel: string;
            lbWeight: number;
            filletSize: number;
            groupName: string | null;
        }[];
    }): Promise<{
        success: boolean;
        count: number;
    }>;
    addGroup(body: {
        name: string;
    }): Promise<{
        success: boolean;
        group: {
            id: number;
            name: string;
            sortOrder: number;
        };
    }>;
    updateGroup(id: number, body: {
        name: string;
    }): Promise<{
        success: boolean;
    }>;
    deleteGroup(id: number): Promise<{
        success: boolean;
    }>;
    bulkSaveGroups(body: {
        groups: {
            name: string;
        }[];
    }): Promise<{
        success: boolean;
        count: number;
    }>;
}
