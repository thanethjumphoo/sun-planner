import { MpsPlan } from './mps-plan.entity';
export declare class DpsPlan {
    id: number;
    productionDate: Date;
    mpsPlan: MpsPlan;
    status: string;
    totalSupplyKg: number;
    totalDemandKg: number;
    fulfillmentRate: number;
    createdAt: Date;
    updatedAt: Date;
    sublots: DpsSublot[];
    orders: DpsOrder[];
    allocations: DpsAllocation[];
}
export declare class DpsSublot {
    id: number;
    dpsPlan: DpsPlan;
    sublotNumber: string;
    farmName: string;
    totalBirds: number;
    shift: string;
    totalWeightKg: number;
    avgLiveWeight: number;
    coProductKg: number;
    bins: DpsSublotBin[];
}
export declare class DpsSublotBin {
    id: number;
    sublot: DpsSublot;
    sizeLabel: string;
    availableKg: number;
}
export declare class DpsOrder {
    id: number;
    dpsPlan: DpsPlan;
    erpOrderLineId: number;
    itemCode: string;
    itemDesc: string;
    productType: string;
    productSize: string;
    requiredKg: number;
    fulfilledKg: number;
    unfulfilledKg: number;
}
export declare class DpsAllocation {
    id: number;
    dpsPlan: DpsPlan;
    sourceBin: DpsSublotBin;
    targetOrder: DpsOrder;
    allocatedKg: number;
    allocationPass: string;
}
