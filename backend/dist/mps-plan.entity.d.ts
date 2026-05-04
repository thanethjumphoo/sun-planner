export declare class MpsPlan {
    id: number;
    planName: string;
    targetMonth: string;
    status: string;
    totalIntakeBirds: number;
    totalRmFlKg: number;
    totalDemandKg: number;
    createdAt: Date;
    updatedAt: Date;
    dailySummaries: MpsPlanDaily[];
    orders: MpsPlanOrder[];
    exceptions: any[];
}
export declare class MpsPlanDaily {
    id: number;
    mpsPlan: MpsPlan;
    productionDate: Date;
    intakeBirds: number;
    rmFlAvailKg: number;
    demandKg: number;
    cuttingStaff: number;
    supportStaff: number;
    totalStaff: number;
}
export declare class MpsPlanOrder {
    id: number;
    mpsPlan: MpsPlan;
    erpOrderLineId: number;
    itemCode: string;
    itemDesc: string;
    productType: string;
    quantityKg: number;
    shipDate: Date;
    plannedProductionDate: Date;
    isManualOverride: boolean;
}
