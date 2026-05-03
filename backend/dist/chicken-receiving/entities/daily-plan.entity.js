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
exports.ChickenReceivingPlanDaily = void 0;
const typeorm_1 = require("typeorm");
let ChickenReceivingPlanDaily = class ChickenReceivingPlanDaily {
    id;
    receive_date;
    receive_time;
    chicken_type;
    chicken_count;
    chicken_weight;
    chicken_avg;
    farm_name;
    farm_name_standard;
    house;
    shift;
    sex;
    sublot;
    createAt;
    updateAt;
};
exports.ChickenReceivingPlanDaily = ChickenReceivingPlanDaily;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ChickenReceivingPlanDaily.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date' }),
    __metadata("design:type", Date)
], ChickenReceivingPlanDaily.prototype, "receive_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'time', nullable: true }),
    __metadata("design:type", String)
], ChickenReceivingPlanDaily.prototype, "receive_time", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ChickenReceivingPlanDaily.prototype, "chicken_type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], ChickenReceivingPlanDaily.prototype, "chicken_count", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], ChickenReceivingPlanDaily.prototype, "chicken_weight", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], ChickenReceivingPlanDaily.prototype, "chicken_avg", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ChickenReceivingPlanDaily.prototype, "farm_name", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ChickenReceivingPlanDaily.prototype, "farm_name_standard", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ChickenReceivingPlanDaily.prototype, "house", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ChickenReceivingPlanDaily.prototype, "shift", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ChickenReceivingPlanDaily.prototype, "sex", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ChickenReceivingPlanDaily.prototype, "sublot", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ChickenReceivingPlanDaily.prototype, "createAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], ChickenReceivingPlanDaily.prototype, "updateAt", void 0);
exports.ChickenReceivingPlanDaily = ChickenReceivingPlanDaily = __decorate([
    (0, typeorm_1.Entity)('chicken_receiving_plan_daily')
], ChickenReceivingPlanDaily);
//# sourceMappingURL=daily-plan.entity.js.map