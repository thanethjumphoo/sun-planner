import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChickenReceivingService } from './chicken-receiving.service';
import { ChickenReceivingController } from './chicken-receiving.controller';
import { ChickenReceivingPlanMonthly } from './entities/monthly-plan.entity';
import { ChickenReceivingPlanWeekly } from './entities/weekly-plan.entity';
import { ChickenReceivingPlanDaily } from './entities/daily-plan.entity';
import { ChickenReceivingActualDaily } from './entities/actual-daily.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChickenReceivingPlanMonthly,
      ChickenReceivingPlanWeekly,
      ChickenReceivingPlanDaily,
      ChickenReceivingActualDaily,
    ]),
  ],
  controllers: [ChickenReceivingController],
  providers: [ChickenReceivingService],
})
export class ChickenReceivingModule {}
