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
exports.DpsAllocation = exports.DpsOrder = exports.DpsSublotBin = exports.DpsSublot = exports.DpsPlan = void 0;
const typeorm_1 = require("typeorm");
const mps_plan_entity_1 = require("./mps-plan.entity");
let DpsPlan = class DpsPlan {
    id;
    productionDate;
    mpsPlan;
    status;
    totalSupplyKg;
    totalDemandKg;
    fulfillmentRate;
    createdAt;
    updatedAt;
    sublots;
    orders;
    allocations;
};
exports.DpsPlan = DpsPlan;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], DpsPlan.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'production_date', type: 'date' }),
    __metadata("design:type", Date)
], DpsPlan.prototype, "productionDate", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => mps_plan_entity_1.MpsPlan, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'mps_plan_id' }),
    __metadata("design:type", mps_plan_entity_1.MpsPlan)
], DpsPlan.prototype, "mpsPlan", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'status', type: 'varchar', length: 20, default: 'DRAFT' }),
    __metadata("design:type", String)
], DpsPlan.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_supply_kg', type: 'decimal', precision: 18, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], DpsPlan.prototype, "totalSupplyKg", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_demand_kg', type: 'decimal', precision: 18, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], DpsPlan.prototype, "totalDemandKg", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'fulfillment_rate', type: 'decimal', precision: 5, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], DpsPlan.prototype, "fulfillmentRate", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], DpsPlan.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], DpsPlan.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => DpsSublot, sublot => sublot.dpsPlan, { cascade: true }),
    __metadata("design:type", Array)
], DpsPlan.prototype, "sublots", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => DpsOrder, order => order.dpsPlan, { cascade: true }),
    __metadata("design:type", Array)
], DpsPlan.prototype, "orders", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => DpsAllocation, alloc => alloc.dpsPlan, { cascade: true }),
    __metadata("design:type", Array)
], DpsPlan.prototype, "allocations", void 0);
exports.DpsPlan = DpsPlan = __decorate([
    (0, typeorm_1.Entity)('dps_plans')
], DpsPlan);
let DpsSublot = class DpsSublot {
    id;
    dpsPlan;
    sublotNumber;
    farmName;
    totalBirds;
    totalWeightKg;
    avgLiveWeight;
    coProductKg;
    bins;
};
exports.DpsSublot = DpsSublot;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], DpsSublot.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => DpsPlan, plan => plan.sublots, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'dps_plan_id' }),
    __metadata("design:type", DpsPlan)
], DpsSublot.prototype, "dpsPlan", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'sublot_number', type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], DpsSublot.prototype, "sublotNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'farm_name', type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], DpsSublot.prototype, "farmName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_birds', type: 'int' }),
    __metadata("design:type", Number)
], DpsSublot.prototype, "totalBirds", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_weight_kg', type: 'decimal', precision: 18, scale: 2 }),
    __metadata("design:type", Number)
], DpsSublot.prototype, "totalWeightKg", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'avg_live_weight', type: 'decimal', precision: 10, scale: 4 }),
    __metadata("design:type", Number)
], DpsSublot.prototype, "avgLiveWeight", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'co_product_kg', type: 'decimal', precision: 18, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], DpsSublot.prototype, "coProductKg", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => DpsSublotBin, bin => bin.sublot, { cascade: true }),
    __metadata("design:type", Array)
], DpsSublot.prototype, "bins", void 0);
exports.DpsSublot = DpsSublot = __decorate([
    (0, typeorm_1.Entity)('dps_sublots')
], DpsSublot);
let DpsSublotBin = class DpsSublotBin {
    id;
    sublot;
    sizeLabel;
    availableKg;
};
exports.DpsSublotBin = DpsSublotBin;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], DpsSublotBin.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => DpsSublot, sublot => sublot.bins, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'dps_sublot_id' }),
    __metadata("design:type", DpsSublot)
], DpsSublotBin.prototype, "sublot", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'size_label', type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], DpsSublotBin.prototype, "sizeLabel", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'available_kg', type: 'decimal', precision: 18, scale: 2 }),
    __metadata("design:type", Number)
], DpsSublotBin.prototype, "availableKg", void 0);
exports.DpsSublotBin = DpsSublotBin = __decorate([
    (0, typeorm_1.Entity)('dps_sublot_bins')
], DpsSublotBin);
let DpsOrder = class DpsOrder {
    id;
    dpsPlan;
    erpOrderLineId;
    itemCode;
    itemDesc;
    productType;
    productSize;
    requiredKg;
    fulfilledKg;
    unfulfilledKg;
};
exports.DpsOrder = DpsOrder;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], DpsOrder.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => DpsPlan, plan => plan.orders, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'dps_plan_id' }),
    __metadata("design:type", DpsPlan)
], DpsOrder.prototype, "dpsPlan", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'erp_order_line_id', type: 'int' }),
    __metadata("design:type", Number)
], DpsOrder.prototype, "erpOrderLineId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'item_code', type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], DpsOrder.prototype, "itemCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'item_desc', type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], DpsOrder.prototype, "itemDesc", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'product_type', type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], DpsOrder.prototype, "productType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'product_size', type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], DpsOrder.prototype, "productSize", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'required_kg', type: 'decimal', precision: 18, scale: 2 }),
    __metadata("design:type", Number)
], DpsOrder.prototype, "requiredKg", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'fulfilled_kg', type: 'decimal', precision: 18, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], DpsOrder.prototype, "fulfilledKg", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'unfulfilled_kg', type: 'decimal', precision: 18, scale: 2 }),
    __metadata("design:type", Number)
], DpsOrder.prototype, "unfulfilledKg", void 0);
exports.DpsOrder = DpsOrder = __decorate([
    (0, typeorm_1.Entity)('dps_orders')
], DpsOrder);
let DpsAllocation = class DpsAllocation {
    id;
    dpsPlan;
    sourceBin;
    targetOrder;
    allocatedKg;
    allocationPass;
};
exports.DpsAllocation = DpsAllocation;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], DpsAllocation.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => DpsPlan, plan => plan.allocations, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'dps_plan_id' }),
    __metadata("design:type", DpsPlan)
], DpsAllocation.prototype, "dpsPlan", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => DpsSublotBin),
    (0, typeorm_1.JoinColumn)({ name: 'source_bin_id' }),
    __metadata("design:type", DpsSublotBin)
], DpsAllocation.prototype, "sourceBin", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => DpsOrder),
    (0, typeorm_1.JoinColumn)({ name: 'target_order_id' }),
    __metadata("design:type", DpsOrder)
], DpsAllocation.prototype, "targetOrder", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'allocated_kg', type: 'decimal', precision: 18, scale: 2 }),
    __metadata("design:type", Number)
], DpsAllocation.prototype, "allocatedKg", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'allocation_pass', type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], DpsAllocation.prototype, "allocationPass", void 0);
exports.DpsAllocation = DpsAllocation = __decorate([
    (0, typeorm_1.Entity)('dps_allocations')
], DpsAllocation);
//# sourceMappingURL=dps-plan.entity.js.map