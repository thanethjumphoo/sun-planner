import { MpsPlanSupply } from './mps-plan-supply.entity';
export declare class MpsPlanSupplySize {
    id: number;
    mpsPlanSupply: MpsPlanSupply;
    mpsPlanSupplyId: number;
    groupSize: string;
    partName: string;
    quantityKg: number;
    productionDate: Date;
}
