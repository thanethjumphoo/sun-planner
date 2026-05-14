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
exports.MpsPlanSupplySize = void 0;
const typeorm_1 = require("typeorm");
const mps_plan_supply_entity_1 = require("./mps-plan-supply.entity");
let MpsPlanSupplySize = class MpsPlanSupplySize {
    id;
    mpsPlanSupply;
    mpsPlanSupplyId;
    groupSize;
    partName;
    quantityKg;
    productionDate;
};
exports.MpsPlanSupplySize = MpsPlanSupplySize;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], MpsPlanSupplySize.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => mps_plan_supply_entity_1.MpsPlanSupply, supply => supply.sizes, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'mps_plan_supply_id' }),
    __metadata("design:type", mps_plan_supply_entity_1.MpsPlanSupply)
], MpsPlanSupplySize.prototype, "mpsPlanSupply", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'mps_plan_supply_id' }),
    __metadata("design:type", Number)
], MpsPlanSupplySize.prototype, "mpsPlanSupplyId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'group_size', type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], MpsPlanSupplySize.prototype, "groupSize", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'part_name', type: 'nvarchar', length: 100 }),
    __metadata("design:type", String)
], MpsPlanSupplySize.prototype, "partName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'quantity_kg', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], MpsPlanSupplySize.prototype, "quantityKg", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'production_date', type: 'date' }),
    __metadata("design:type", Date)
], MpsPlanSupplySize.prototype, "productionDate", void 0);
exports.MpsPlanSupplySize = MpsPlanSupplySize = __decorate([
    (0, typeorm_1.Entity)('mps_plan_supply_size')
], MpsPlanSupplySize);
//# sourceMappingURL=mps-plan-supply-size.entity.js.map