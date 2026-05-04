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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MpsController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const stg_erp_order_line_entity_1 = require("./stg-erp-order-line.entity");
const product_spec_entity_1 = require("./product-spec.entity");
const mps_plan_entity_1 = require("./mps-plan.entity");
const chicken_receiving_service_1 = require("./chicken-receiving/chicken-receiving.service");
let MpsController = class MpsController {
    orderLineRepo;
    specRepo;
    mpsPlanRepo;
    mpsDailyRepo;
    mpsOrderRepo;
    chickenReceivingService;
    constructor(orderLineRepo, specRepo, mpsPlanRepo, mpsDailyRepo, mpsOrderRepo, chickenReceivingService) {
        this.orderLineRepo = orderLineRepo;
        this.specRepo = specRepo;
        this.mpsPlanRepo = mpsPlanRepo;
        this.mpsDailyRepo = mpsDailyRepo;
        this.mpsOrderRepo = mpsOrderRepo;
        this.chickenReceivingService = chickenReceivingService;
    }
    async updateDate(body) {
        const line = await this.orderLineRepo.findOne({ where: { erpOrderLineId: body.lineId } });
        if (line) {
            line.plannedProductionDate = new Date(body.date);
            await this.orderLineRepo.save(line);
            return { success: true };
        }
        return { success: false, message: 'Line not found' };
    }
    async autoAllocate() {
        const unallocated = await this.orderLineRepo.createQueryBuilder('line')
            .where('line.planned_production_date IS NULL')
            .andWhere('line.erp_order_ship_date IS NOT NULL')
            .getMany();
        const specs = await this.specRepo.find();
        const specMap = new Map();
        specs.forEach(s => specMap.set(s.erpItemCode, s.productType));
        let allocatedCount = 0;
        for (const line of unallocated) {
            const type = specMap.get(line.erpOrderItemCode) || 'chilled';
            const shipDate = new Date(line.erpOrderShipDate);
            const plannedDate = new Date(shipDate);
            if (type === 'chilled') {
                plannedDate.setDate(plannedDate.getDate() - 1);
            }
            else {
                plannedDate.setDate(plannedDate.getDate() - 5);
            }
            line.plannedProductionDate = plannedDate;
            await this.orderLineRepo.save(line);
            allocatedCount++;
        }
        return { success: true, allocatedCount };
    }
    async generatePlan(body) {
        const targetMonth = body.targetMonth;
        let plan = await this.mpsPlanRepo.findOne({ where: { targetMonth, status: 'DRAFT' } });
        if (plan) {
            await this.mpsDailyRepo.delete({ mpsPlan: { id: plan.id } });
            await this.mpsOrderRepo.delete({ mpsPlan: { id: plan.id } });
        }
        else {
            plan = this.mpsPlanRepo.create({
                planName: `MPS ${targetMonth} - Draft`,
                targetMonth,
                status: 'DRAFT',
            });
            plan = await this.mpsPlanRepo.save(plan);
        }
        const startOfMonth = new Date(`${targetMonth}-01T00:00:00Z`);
        const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0, 23, 59, 59);
        const orders = await this.orderLineRepo.find({
            where: { erpOrderShipDate: (0, typeorm_2.Between)(startOfMonth, endOfMonth) }
        });
        const specs = await this.specRepo.find();
        const specMap = new Map();
        specs.forEach(s => specMap.set(s.erpItemCode, s));
        const mpsOrdersToSave = [];
        let totalDemandKg = 0;
        for (const order of orders) {
            const spec = specMap.get(order.erpOrderItemCode);
            if (!spec) {
                continue;
            }
            const productType = spec.productType;
            const qty = Number(order.erpOrderItemQty || 0);
            const shipDate = new Date(order.erpOrderShipDate);
            const plannedDate = new Date(shipDate);
            if (productType === 'chilled') {
                plannedDate.setDate(plannedDate.getDate() - 1);
            }
            else {
                plannedDate.setDate(plannedDate.getDate() - 5);
            }
            totalDemandKg += qty;
            mpsOrdersToSave.push(this.mpsOrderRepo.create({
                mpsPlan: plan,
                erpOrderLineId: order.erpOrderLineId,
                itemCode: order.erpOrderItemCode,
                itemDesc: order.erpOrderItemCode,
                productType,
                quantityKg: qty,
                shipDate: shipDate,
                plannedProductionDate: plannedDate,
                isManualOverride: false
            }));
        }
        await this.mpsOrderRepo.save(mpsOrdersToSave);
        const allIntakes = await this.chickenReceivingService.findAll('daily');
        const dailyData = new Map();
        allIntakes.forEach((intake) => {
            const d = intake.receivingDate ? intake.receivingDate.toISOString().split('T')[0] : null;
            if (d && d.startsWith(targetMonth)) {
                if (!dailyData.has(d)) {
                    dailyData.set(d, { birds: 0, kg: 0 });
                }
                const current = dailyData.get(d);
                current.birds += Number(intake.totalBirds || 0);
                current.kg += Number(intake.totalWeightKg || 0);
            }
        });
        const mpsDailiesToSave = [];
        let totalIntakeBirds = 0;
        let totalRmFlKg = 0;
        const dailyDemand = new Map();
        const dailyStaff = new Map();
        mpsOrdersToSave.forEach(o => {
            const d = o.plannedProductionDate.toISOString().split('T')[0];
            if (!dailyDemand.has(d))
                dailyDemand.set(d, 0);
            dailyDemand.set(d, dailyDemand.get(d) + o.quantityKg);
            const spec = specMap.get(o.itemCode);
            const speed = Number(spec?.productSpeed || 45);
            if (!dailyStaff.has(d))
                dailyStaff.set(d, 0);
            dailyStaff.set(d, dailyStaff.get(d) + (o.quantityKg / speed));
        });
        const daysInMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
            const dayStr = `${targetMonth}-${i.toString().padStart(2, '0')}`;
            const intake = dailyData.get(dayStr) || { birds: 0, kg: 0 };
            const demand = dailyDemand.get(dayStr) || 0;
            const rmFlAvailKg = intake.kg * 0.957 * 0.95 * 0.04 * (1 - 0.093);
            totalIntakeBirds += intake.birds;
            totalRmFlKg += rmFlAvailKg;
            const cuttingStaff = demand > 0 ? (dailyStaff.get(dayStr) || 0) / 10 : 0;
            const supportStaff = demand > 0 ? 28 : 0;
            mpsDailiesToSave.push(this.mpsDailyRepo.create({
                mpsPlan: plan,
                productionDate: new Date(dayStr),
                intakeBirds: intake.birds,
                rmFlAvailKg: rmFlAvailKg,
                demandKg: demand,
                cuttingStaff: Math.ceil(cuttingStaff),
                supportStaff,
                totalStaff: Math.ceil(cuttingStaff + supportStaff)
            }));
        }
        await this.mpsDailyRepo.save(mpsDailiesToSave);
        plan.totalIntakeBirds = totalIntakeBirds;
        plan.totalRmFlKg = totalRmFlKg;
        plan.totalDemandKg = totalDemandKg;
        await this.mpsPlanRepo.save(plan);
        return { success: true, planId: plan.id, status: plan.status };
    }
};
exports.MpsController = MpsController;
__decorate([
    (0, common_1.Post)('update-date'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MpsController.prototype, "updateDate", null);
__decorate([
    (0, common_1.Post)('auto-allocate'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MpsController.prototype, "autoAllocate", null);
__decorate([
    (0, common_1.Post)('generate'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MpsController.prototype, "generatePlan", null);
exports.MpsController = MpsController = __decorate([
    (0, common_1.Controller)('api/mps'),
    __param(0, (0, typeorm_1.InjectRepository)(stg_erp_order_line_entity_1.StgErpOrderLine)),
    __param(1, (0, typeorm_1.InjectRepository)(product_spec_entity_1.ProductSpec)),
    __param(2, (0, typeorm_1.InjectRepository)(mps_plan_entity_1.MpsPlan)),
    __param(3, (0, typeorm_1.InjectRepository)(mps_plan_entity_1.MpsPlanDaily)),
    __param(4, (0, typeorm_1.InjectRepository)(mps_plan_entity_1.MpsPlanOrder)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        chicken_receiving_service_1.ChickenReceivingService])
], MpsController);
//# sourceMappingURL=mps.controller.js.map