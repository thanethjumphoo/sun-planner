import { MpsPlan } from './mps-plan.entity';
export declare class MpsExceptionReport {
    id: string;
    mpsPlan: MpsPlan;
    erpOrderLineId: number;
    soNumber: string;
    itemCode: string;
    shipDate: Date;
    requiredKg: number;
    shortageKg: number;
    reason: string;
    createdAt: Date;
}
