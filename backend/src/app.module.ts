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
import { DpsPlan, DpsSublot, DpsSublotBin, DpsOrder, DpsAllocation } from './dps-plan.entity';

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
        synchronize: true, // TODO: Set to false in production after tables are created
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
      WeightDistribution, MpsPlan, MpsPlanDaily, MpsPlanOrder,
      DpsPlan, DpsSublot, DpsSublotBin, DpsOrder, DpsAllocation
    ]),
  ],
  controllers: [AppController, ErpIntegrationController, ProductSpecController, WeightDistributionController, MpsController],
  providers: [AppService, OracleIntegrationService],
})
export class AppModule { }
