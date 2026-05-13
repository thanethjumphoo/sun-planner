"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const chicken_receiving_module_1 = require("./chicken-receiving/chicken-receiving.module");
const stg_erp_item_entity_1 = require("./stg-erp-item.entity");
const stg_erp_order_header_entity_1 = require("./stg-erp-order-header.entity");
const stg_erp_order_line_entity_1 = require("./stg-erp-order-line.entity");
const target_sync_item_entity_1 = require("./target-sync-item.entity");
const oracle_integration_service_1 = require("./oracle-integration.service");
const erp_integration_controller_1 = require("./erp-integration.controller");
const product_spec_entity_1 = require("./product-spec.entity");
const product_spec_controller_1 = require("./product-spec.controller");
const weight_distribution_entity_1 = require("./weight-distribution.entity");
const weight_distribution_controller_1 = require("./weight-distribution.controller");
const mps_controller_1 = require("./mps.controller");
const mps_plan_entity_1 = require("./mps-plan.entity");
const mps_plan_supply_entity_1 = require("./mps-plan-supply.entity");
const mps_exception_entity_1 = require("./mps-exception.entity");
const dps_plan_entity_1 = require("./dps-plan.entity");
const manual_operation_entity_1 = require("./manual-operation.entity");
const manual_operation_controller_1 = require("./manual-operation.controller");
const dps_controller_1 = require("./dps.controller");
const fillet_size_entity_1 = require("./fillet-size.entity");
const fillet_size_controller_1 = require("./fillet-size.controller");
const master_yield_entity_1 = require("./master-yield.entity");
const master_yield_controller_1 = require("./master-yield.controller");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: process.env.NODE_ENV === 'production' ? '.env.production' : ['.env.development', '.env'],
            }),
            typeorm_1.TypeOrmModule.forRootAsync({
                imports: [config_1.ConfigModule],
                useFactory: (configService) => ({
                    type: 'mssql',
                    host: configService.get('DB_HOST'),
                    port: parseInt(configService.get('DB_PORT') || '1433'),
                    username: configService.get('DB_USER') || configService.get('DB_USERNAME'),
                    password: configService.get('DB_PASS') || configService.get('DB_PASSWORD'),
                    database: configService.get('DB_NAME') || configService.get('DB_DATABASE'),
                    autoLoadEntities: true,
                    synchronize: true,
                    options: {
                        encrypt: true,
                        trustServerCertificate: true,
                    },
                }),
                inject: [config_1.ConfigService],
            }),
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            chicken_receiving_module_1.ChickenReceivingModule,
            typeorm_1.TypeOrmModule.forFeature([
                stg_erp_item_entity_1.StgErpItem, stg_erp_order_header_entity_1.StgErpOrderHeader, stg_erp_order_line_entity_1.StgErpOrderLine, target_sync_item_entity_1.TargetSyncItem, product_spec_entity_1.ProductSpec,
                weight_distribution_entity_1.WeightDistribution, mps_plan_entity_1.MpsPlan, mps_plan_entity_1.MpsPlanDaily, mps_plan_entity_1.MpsPlanOrder, mps_plan_supply_entity_1.MpsPlanSupply, mps_exception_entity_1.MpsExceptionReport,
                dps_plan_entity_1.DpsPlan, dps_plan_entity_1.DpsSublot, dps_plan_entity_1.DpsSublotBin, dps_plan_entity_1.DpsOrder, dps_plan_entity_1.DpsAllocation, manual_operation_entity_1.ManualOperation,
                fillet_size_entity_1.FilletConfig, fillet_size_entity_1.FilletGroup, fillet_size_entity_1.FilletSizeCalc, master_yield_entity_1.MasterYield
            ]),
        ],
        controllers: [app_controller_1.AppController, erp_integration_controller_1.ErpIntegrationController, product_spec_controller_1.ProductSpecController, weight_distribution_controller_1.WeightDistributionController, mps_controller_1.MpsController, manual_operation_controller_1.ManualOperationController, dps_controller_1.DpsController, fillet_size_controller_1.FilletSizeController, master_yield_controller_1.MasterYieldController],
        providers: [app_service_1.AppService, oracle_integration_service_1.OracleIntegrationService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map