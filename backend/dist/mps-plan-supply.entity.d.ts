import { MpsPlan } from './mps-plan.entity';
import { MpsPlanSupplySize } from './mps-plan-supply-size.entity';
export declare class MpsPlanSupply {
    id: number;
    mpsPlan: MpsPlan;
    mpsPlanId: number;
    productionDate: Date;
    intakeBirds: number;
    totalWeight: number;
    avgWeight: number;
    slaughteredWeight: number;
    sizes: MpsPlanSupplySize[];
}
