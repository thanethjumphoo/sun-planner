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
exports.ManualOperation = void 0;
const typeorm_1 = require("typeorm");
let ManualOperation = class ManualOperation {
    id;
    productionDate;
    partType;
    plannedStationWorkers;
    actualStationWorkers;
    actualCuttingWorkers;
    createdAt;
    updatedAt;
};
exports.ManualOperation = ManualOperation;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], ManualOperation.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'production_date', type: 'date' }),
    __metadata("design:type", Date)
], ManualOperation.prototype, "productionDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'part_type', type: 'varchar', length: 50, default: 'fillet' }),
    __metadata("design:type", String)
], ManualOperation.prototype, "partType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'planned_station_workers', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], ManualOperation.prototype, "plannedStationWorkers", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'actual_station_workers', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], ManualOperation.prototype, "actualStationWorkers", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'actual_cutting_workers', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], ManualOperation.prototype, "actualCuttingWorkers", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ManualOperation.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], ManualOperation.prototype, "updatedAt", void 0);
exports.ManualOperation = ManualOperation = __decorate([
    (0, typeorm_1.Entity)('manual_operations'),
    (0, typeorm_1.Unique)(['productionDate', 'partType'])
], ManualOperation);
//# sourceMappingURL=manual-operation.entity.js.map