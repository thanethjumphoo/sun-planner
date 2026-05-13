export declare class MasterYield {
    id: string;
    name: string;
    yieldPercentage: number;
    type: string;
    parentId: string;
    parent: MasterYield;
    children: MasterYield[];
    createdAt: Date;
    updatedAt: Date;
}
