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
exports.MpsPlanSupply = void 0;
const typeorm_1 = require("typeorm");
const mps_plan_entity_1 = require("./mps-plan.entity");
let MpsPlanSupply = class MpsPlanSupply {
    id;
    mpsPlan;
    mpsPlanId;
    productionDate;
    intakeBirds;
    totalWeight;
    avgWeight;
    slaughteredWeight;
    size40Down;
    size40_45;
    size45_50;
    size50_55;
    size55_60;
    size60_65;
    size65_70;
    size70_up;
};
exports.MpsPlanSupply = MpsPlanSupply;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], MpsPlanSupply.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => mps_plan_entity_1.MpsPlan, plan => plan.supplyBreakdown, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'mps_plan_id' }),
    __metadata("design:type", mps_plan_entity_1.MpsPlan)
], MpsPlanSupply.prototype, "mpsPlan", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'mps_plan_id' }),
    __metadata("design:type", Number)
], MpsPlanSupply.prototype, "mpsPlanId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'production_date', type: 'date' }),
    __metadata("design:type", Date)
], MpsPlanSupply.prototype, "productionDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'intake_birds', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], MpsPlanSupply.prototype, "intakeBirds", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_weight', type: 'decimal', precision: 18, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], MpsPlanSupply.prototype, "totalWeight", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'avg_weight', type: 'decimal', precision: 18, scale: 3, default: 0 }),
    __metadata("design:type", Number)
], MpsPlanSupply.prototype, "avgWeight", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'slaughtered_weight', type: 'decimal', precision: 18, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], MpsPlanSupply.prototype, "slaughteredWeight", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'size_40_down', type: 'decimal', precision: 18, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], MpsPlanSupply.prototype, "size40Down", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'size_40_45', type: 'decimal', precision: 18, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], MpsPlanSupply.prototype, "size40_45", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'size_45_50', type: 'decimal', precision: 18, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], MpsPlanSupply.prototype, "size45_50", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'size_50_55', type: 'decimal', precision: 18, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], MpsPlanSupply.prototype, "size50_55", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'size_55_60', type: 'decimal', precision: 18, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], MpsPlanSupply.prototype, "size55_60", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'size_60_65', type: 'decimal', precision: 18, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], MpsPlanSupply.prototype, "size60_65", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'size_65_70', type: 'decimal', precision: 18, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], MpsPlanSupply.prototype, "size65_70", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'size_70_up', type: 'decimal', precision: 18, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], MpsPlanSupply.prototype, "size70_up", void 0);
exports.MpsPlanSupply = MpsPlanSupply = __decorate([
    (0, typeorm_1.Entity)('mps_plan_supply')
], MpsPlanSupply);
//# sourceMappingURL=mps-plan-supply.entity.js.map