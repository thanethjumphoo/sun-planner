"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MpsPlanOrder = exports.MpsPlanDaily = exports.MpsPlan = void 0;
const typeorm_1 = require("typeorm");
let MpsPlan = class MpsPlan {
    id;
    planName;
    targetMonth;
    status;
    totalIntakeBirds;
    totalRmFlKg;
    totalDemandKg;
    createdAt;
    updatedAt;
    dailySummaries;
    orders;
};
exports.MpsPlan = MpsPlan;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], MpsPlan.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'plan_name', type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], MpsPlan.prototype, "planName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'target_month', type: 'varchar', length: 7 }),
    __metadata("design:type", String)
], MpsPlan.prototype, "targetMonth", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'status', type: 'varchar', length: 20, default: 'DRAFT' }),
    __metadata("design:type", String)
], MpsPlan.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_intake_birds', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], MpsPlan.prototype, "totalIntakeBirds", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_rm_fl_kg', type: 'decimal', precision: 18, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], MpsPlan.prototype, "totalRmFlKg", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_demand_kg', type: 'decimal', precision: 18, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], MpsPlan.prototype, "totalDemandKg", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], MpsPlan.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], MpsPlan.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => MpsPlanDaily, daily => daily.mpsPlan, { cascade: true }),
    __metadata("design:type", Array)
], MpsPlan.prototype, "dailySummaries", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => MpsPlanOrder, order => order.mpsPlan, { cascade: true }),
    __metadata("design:type", Array)
], MpsPlan.prototype, "orders", void 0);
exports.MpsPlan = MpsPlan = __decorate([
    (0, typeorm_1.Entity)('mps_plans')
], MpsPlan);
let MpsPlanDaily = class MpsPlanDaily {
    id;
    mpsPlan;
    productionDate;
    intakeBirds;
    rmFlAvailKg;
    demandKg;
    cuttingStaff;
    supportStaff;
    totalStaff;
};
exports.MpsPlanDaily = MpsPlanDaily;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], MpsPlanDaily.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => MpsPlan, plan => plan.dailySummaries, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'mps_plan_id' }),
    __metadata("design:type", MpsPlan)
], MpsPlanDaily.prototype, "mpsPlan", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'production_date', type: 'date' }),
    __metadata("design:type", Date)
], MpsPlanDaily.prototype, "productionDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'intake_birds', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], MpsPlanDaily.prototype, "intakeBirds", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'rm_fl_avail_kg', type: 'decimal', precision: 18, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], MpsPlanDaily.prototype, "rmFlAvailKg", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'demand_kg', type: 'decimal', precision: 18, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], MpsPlanDaily.prototype, "demandKg", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'cutting_staff', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], MpsPlanDaily.prototype, "cuttingStaff", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'support_staff', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], MpsPlanDaily.prototype, "supportStaff", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_staff', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], MpsPlanDaily.prototype, "totalStaff", void 0);
exports.MpsPlanDaily = MpsPlanDaily = __decorate([
    (0, typeorm_1.Entity)('mps_plan_daily')
], MpsPlanDaily);
let MpsPlanOrder = class MpsPlanOrder {
    id;
    mpsPlan;
    erpOrderLineId;
    itemCode;
    itemDesc;
    productType;
    quantityKg;
    shipDate;
    plannedProductionDate;
    isManualOverride;
};
exports.MpsPlanOrder = MpsPlanOrder;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], MpsPlanOrder.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => MpsPlan, plan => plan.orders, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'mps_plan_id' }),
    __metadata("design:type", MpsPlan)
], MpsPlanOrder.prototype, "mpsPlan", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'erp_order_line_id', type: 'int' }),
    __metadata("design:type", Number)
], MpsPlanOrder.prototype, "erpOrderLineId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'item_code', type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], MpsPlanOrder.prototype, "itemCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'item_desc', type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], MpsPlanOrder.prototype, "itemDesc", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'product_type', type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], MpsPlanOrder.prototype, "productType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'quantity_kg', type: 'decimal', precision: 18, scale: 2 }),
    __metadata("design:type", Number)
], MpsPlanOrder.prototype, "quantityKg", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ship_date', type: 'date' }),
    __metadata("design:type", Date)
], MpsPlanOrder.prototype, "shipDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'planned_production_date', type: 'date' }),
    __metadata("design:type", Date)
], MpsPlanOrder.prototype, "plannedProductionDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_manual_override', type: 'bit', default: 0 }),
    __metadata("design:type", Boolean)
], MpsPlanOrder.prototype, "isManualOverride", void 0);
exports.MpsPlanOrder = MpsPlanOrder = __decorate([
    (0, typeorm_1.Entity)('mps_plan_orders')
], MpsPlanOrder);
//# sourceMappingURL=mps-plan.entity.js.map