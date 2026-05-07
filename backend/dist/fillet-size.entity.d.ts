export declare class FilletConfig {
    id: number;
    configKey: string;
    configValue: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare class FilletGroup {
    id: number;
    groupName: string;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare class FilletSizeCalc {
    id: number;
    colLabel: string;
    lbWeight: number;
    filletSize: number;
    groupName: string | null;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
}
