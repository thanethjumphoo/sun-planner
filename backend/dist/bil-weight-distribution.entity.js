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
exports.BilWeightDistribution = void 0;
const typeorm_1 = require("typeorm");
let BilWeightDistribution = class BilWeightDistribution {
    id;
    rowLabel;
    colLabel;
    distValue;
    createdAt;
    updatedAt;
};
exports.BilWeightDistribution = BilWeightDistribution;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], BilWeightDistribution.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ROW_LABEL', type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], BilWeightDistribution.prototype, "rowLabel", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'COL_LABEL', type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], BilWeightDistribution.prototype, "colLabel", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'DIST_VALUE', type: 'decimal', precision: 10, scale: 6, default: 0 }),
    __metadata("design:type", Number)
], BilWeightDistribution.prototype, "distValue", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'CREATED_AT' }),
    __metadata("design:type", Date)
], BilWeightDistribution.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'UPDATED_AT' }),
    __metadata("design:type", Date)
], BilWeightDistribution.prototype, "updatedAt", void 0);
exports.BilWeightDistribution = BilWeightDistribution = __decorate([
    (0, typeorm_1.Entity)('bil_weight_distributions')
], BilWeightDistribution);
//# sourceMappingURL=bil-weight-distribution.entity.js.map