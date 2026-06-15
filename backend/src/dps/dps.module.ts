import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DpsController } from './dps.controller';
import { DpsFilletService } from './dps-fillet.service';
import { DpsBilService } from './dps-bil.service';
import { DpsPlan, DpsSublot, DpsSublotBin, DpsOrder, DpsAllocation } from '../dps-plan.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DpsPlan, DpsSublot, DpsSublotBin, DpsOrder, DpsAllocation
    ])
  ],
  controllers: [DpsController],
  providers: [DpsFilletService, DpsBilService],
  exports: [DpsFilletService, DpsBilService]
})
export class DpsModule {}
