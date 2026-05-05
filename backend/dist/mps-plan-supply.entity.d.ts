import { MpsPlan } from './mps-plan.entity';
export declare class MpsPlanSupply {
    id: number;
    mpsPlan: MpsPlan;
    mpsPlanId: number;
    productionDate: Date;
    intakeBirds: number;
    totalWeight: number;
    avgWeight: number;
    slaughteredWeight: number;
    size40Down: number;
    size40_45: number;
    size45_50: number;
    size50_55: number;
    size55_60: number;
    size60_65: number;
    size65_70: number;
    size70_up: number;
}
