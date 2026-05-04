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
exports.MpsExceptionReport = void 0;
const typeorm_1 = require("typeorm");
const mps_plan_entity_1 = require("./mps-plan.entity");
let MpsExceptionReport = class MpsExceptionReport {
    id;
    mpsPlan;
    erpOrderLineId;
    soNumber;
    itemCode;
    shipDate;
    requiredKg;
    shortageKg;
    reason;
    createdAt;
};
exports.MpsExceptionReport = MpsExceptionReport;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], MpsExceptionReport.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => mps_plan_entity_1.MpsPlan, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'mps_plan_id' }),
    __metadata("design:type", mps_plan_entity_1.MpsPlan)
], MpsExceptionReport.prototype, "mpsPlan", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'erp_order_line_id', type: 'int', nullable: true }),
    __metadata("design:type", Number)
], MpsExceptionReport.prototype, "erpOrderLineId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'so_number', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], MpsExceptionReport.prototype, "soNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'item_code', type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], MpsExceptionReport.prototype, "itemCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ship_date', type: 'date' }),
    __metadata("design:type", Date)
], MpsExceptionReport.prototype, "shipDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'required_kg', type: 'decimal', precision: 18, scale: 2 }),
    __metadata("design:type", Number)
], MpsExceptionReport.prototype, "requiredKg", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'shortage_kg', type: 'decimal', precision: 18, scale: 2 }),
    __metadata("design:type", Number)
], MpsExceptionReport.prototype, "shortageKg", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reason', type: 'text' }),
    __metadata("design:type", String)
], MpsExceptionReport.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], MpsExceptionReport.prototype, "createdAt", void 0);
exports.MpsExceptionReport = MpsExceptionReport = __decorate([
    (0, typeorm_1.Entity)('mps_exception_reports')
], MpsExceptionReport);
//# sourceMappingURL=mps-exception.entity.js.map