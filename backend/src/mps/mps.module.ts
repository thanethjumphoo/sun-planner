import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemConfigModule } from '../system-config/system-config.module';
import { MpsController } from './mps.controller';
import { MpsFilletService } from './mps-fillet.service';
import { MpsBilService } from './mps-bil.service';
import { MpsPlan, MpsPlanDaily, MpsPlanOrder } from '../mps-plan.entity';
import { MpsPlanSupply } from '../mps-plan-supply.entity';
import { MpsPlanSupplySize } from '../mps-plan-supply-size.entity';
import { MpsExceptionReport } from '../mps-exception.entity';
import { StgErpOrderLine } from '../stg-erp-order-line.entity';
import { StgErpOrderHeader } from '../stg-erp-order-header.entity';
import { ProductSpec } from '../product-spec.entity';
import { WeightDistribution } from '../weight-distribution.entity';
import { BilWeightDistribution } from '../bil-weight-distribution.entity';
import { FilletSizeCalc, FilletConfig } from '../fillet-size.entity';
import { ManualOperation } from '../manual-operation.entity';
import { StgErpItem } from '../stg-erp-item.entity';
import { MasterYield } from '../master-yield.entity';
import { MachineConfig } from '../machine-config.entity';
import { ExternalRmSupply } from '../external-rm-supply.entity';
import { BlBeltGateMatrix } from '../bl-belt-gate-matrix.entity';
import { ChickenReceivingWeeklySize } from '../chicken-receiving/entities/weekly-size.entity';
import { ChickenReceivingModule } from '../chicken-receiving/chicken-receiving.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StgErpOrderLine, StgErpOrderHeader, ProductSpec, MpsPlan, MpsPlanDaily,
      MpsPlanOrder, MpsPlanSupply, WeightDistribution, BilWeightDistribution,
      MpsExceptionReport, ExternalRmSupply, FilletSizeCalc, FilletConfig,
      ManualOperation, StgErpItem, MasterYield, MpsPlanSupplySize,
      ChickenReceivingWeeklySize, MachineConfig, BlBeltGateMatrix
    ]),
    ChickenReceivingModule,
    SystemConfigModule
  ],
  controllers: [MpsController],
  providers: [MpsFilletService, MpsBilService],
  exports: [MpsFilletService, MpsBilService]
})
export class MpsModule {}
