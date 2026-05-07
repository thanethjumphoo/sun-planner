import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { User } from './users/entities/user.entity';
import { ChickenReceivingModule } from './chicken-receiving/chicken-receiving.module';
import { StgErpItem } from './stg-erp-item.entity';
import { StgErpOrderHeader } from './stg-erp-order-header.entity';
import { StgErpOrderLine } from './stg-erp-order-line.entity';
import { TargetSyncItem } from './target-sync-item.entity';
import { OracleIntegrationService } from './oracle-integration.service';
import { ErpIntegrationController } from './erp-integration.controller';
import { ProductSpec } from './product-spec.entity';
import { ProductSpecController } from './product-spec.controller';
import { WeightDistribution } from './weight-distribution.entity';
import { WeightDistributionController } from './weight-distribution.controller';
import { MpsController } from './mps.controller';
import { MpsPlan, MpsPlanDaily, MpsPlanOrder } from './mps-plan.entity';
import { MpsPlanSupply } from './mps-plan-supply.entity';
import { MpsExceptionReport } from './mps-exception.entity';
import { DpsPlan, DpsSublot, DpsSublotBin, DpsOrder, DpsAllocation } from './dps-plan.entity';
import { ManualOperation } from './manual-operation.entity';
import { ManualOperationController } from './manual-operation.controller';
import { DpsController } from './dps.controller';
import { FilletConfig, FilletGroup, FilletSizeCalc } from './fillet-size.entity';
import { FilletSizeController } from './fillet-size.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'production' ? '.env.production' : ['.env.development', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mssql',
        host: configService.get<string>('DB_HOST'),
        port: parseInt(configService.get<string>('DB_PORT') || '1433'),
        username: configService.get<string>('DB_USER') || configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASS') || configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME') || configService.get<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: true,
        options: {
          encrypt: true,
          trustServerCertificate: true,
        },
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    ChickenReceivingModule,
    TypeOrmModule.forFeature([
      StgErpItem, StgErpOrderHeader, StgErpOrderLine, TargetSyncItem, ProductSpec, 
      WeightDistribution, MpsPlan, MpsPlanDaily, MpsPlanOrder, MpsPlanSupply, MpsExceptionReport,
      DpsPlan, DpsSublot, DpsSublotBin, DpsOrder, DpsAllocation, ManualOperation,
      FilletConfig, FilletGroup, FilletSizeCalc
    ]),
  ],
  controllers: [AppController, ErpIntegrationController, ProductSpecController, WeightDistributionController, MpsController, ManualOperationController, DpsController, FilletSizeController],
  providers: [AppService, OracleIntegrationService],
})
export class AppModule { }
