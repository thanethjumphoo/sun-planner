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
const mps_exception_entity_1 = require("./mps-exception.entity");
const chicken_receiving_service_1 = require("./chicken-receiving/chicken-receiving.service");
let MpsController = class MpsController {
    orderLineRepo;
    specRepo;
    mpsPlanRepo;
    mpsDailyRepo;
    mpsOrderRepo;
    exceptionRepo;
    chickenReceivingService;
    constructor(orderLineRepo, specRepo, mpsPlanRepo, mpsDailyRepo, mpsOrderRepo, exceptionRepo, chickenReceivingService) {
        this.orderLineRepo = orderLineRepo;
        this.specRepo = specRepo;
        this.mpsPlanRepo = mpsPlanRepo;
        this.mpsDailyRepo = mpsDailyRepo;
        this.mpsOrderRepo = mpsOrderRepo;
        this.exceptionRepo = exceptionRepo;
        this.chickenReceivingService = chickenReceivingService;
    }
    async updateDate(body) {
        if (body.mpsOrderId) {
            const planOrder = await this.mpsOrderRepo.findOne({ where: { id: body.mpsOrderId } });
            if (planOrder) {
                planOrder.plannedProductionDate = new Date(body.date);
                planOrder.isManualOverride = true;
                await this.mpsOrderRepo.save(planOrder);
                return { success: true };
            }
        }
        else if (body.planId && body.lineId) {
            const planOrder = await this.mpsOrderRepo.findOne({
                where: { mpsPlan: { id: body.planId }, erpOrderLineId: body.lineId }
            });
            if (planOrder) {
                planOrder.plannedProductionDate = new Date(body.date);
                planOrder.isManualOverride = true;
                await this.mpsOrderRepo.save(planOrder);
                const line = await this.orderLineRepo.findOne({ where: { erpOrderLineId: body.lineId } });
                if (line) {
                    line.plannedProductionDate = new Date(body.date);
                    await this.orderLineRepo.save(line);
                }
                return { success: true };
            }
        }
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
            await this.exceptionRepo.delete({ mpsPlan: { id: plan.id } });
        }
        else {
            plan = this.mpsPlanRepo.create({
                planName: `MPS ${targetMonth} - Draft`,
                targetMonth,
                status: 'DRAFT',
            });
            plan = await this.mpsPlanRepo.save(plan);
        }
        const targetDate = new Date(`${targetMonth}-01T00:00:00Z`);
        const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1, 0, 0, 0);
        const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59);
        const orders = await this.orderLineRepo.find({
            where: { erpOrderShipDate: (0, typeorm_2.Between)(startOfMonth, endOfMonth) }
        });
        const specs = await this.specRepo.find();
        const specMap = new Map();
        specs.forEach(s => specMap.set(s.erpItemCode, s));
        const allIntakes = await this.chickenReceivingService.findAll('monthly');
        const supplyMap = new Map();
        allIntakes.forEach((intake) => {
            const d = intake.receive_date ? new Date(intake.receive_date).toISOString().split('T')[0] : null;
            if (d) {
                const intakeKg = Number(intake.chicken_weight || 0);
                const rmFlAvailKg = intakeKg * 0.957 * 0.95 * 0.04 * (1 - 0.093);
                supplyMap.set(d, (supplyMap.get(d) || 0) + rmFlAvailKg);
            }
        });
        const formatDate = (date) => date.toISOString().split('T')[0];
        const subtractDays = (date, days) => {
            const d = new Date(date);
            d.setDate(d.getDate() - days);
            return d;
        };
        const chillOrders = [];
        const freezeOrders = [];
        for (const order of orders) {
            const spec = specMap.get(order.erpOrderItemCode);
            if (!spec)
                continue;
            const orderObj = {
                ...order,
                productType: spec.productType,
                qty: Number(order.erpOrderItemQty || 0),
                shipDate: new Date(order.erpOrderShipDate)
            };
            if (orderObj.productType === 'chilled') {
                chillOrders.push(orderObj);
            }
            else {
                freezeOrders.push(orderObj);
            }
        }
        chillOrders.sort((a, b) => a.shipDate.getTime() - b.shipDate.getTime());
        freezeOrders.sort((a, b) => a.shipDate.getTime() - b.shipDate.getTime());
        const mpsOrdersToSave = [];
        const exceptionsToSave = [];
        let totalDemandKg = 0;
        for (const order of chillOrders) {
            totalDemandKg += order.qty;
            const targetProdDate = subtractDays(order.shipDate, 1);
            const dateStr = formatDate(targetProdDate);
            const supply = supplyMap.get(dateStr) || 0;
            if (supply >= order.qty) {
                supplyMap.set(dateStr, supply - order.qty);
                mpsOrdersToSave.push(this.mpsOrderRepo.create({
                    mpsPlan: plan,
                    erpOrderLineId: order.erpOrderLineId,
                    itemCode: order.erpOrderItemCode,
                    itemDesc: order.erpOrderItemCode,
                    productType: order.productType,
                    quantityKg: order.qty,
                    shipDate: order.shipDate,
                    plannedProductionDate: targetProdDate,
                    isManualOverride: false
                }));
            }
            else {
                if (supply > 0) {
                    mpsOrdersToSave.push(this.mpsOrderRepo.create({
                        mpsPlan: plan,
                        erpOrderLineId: order.erpOrderLineId,
                        itemCode: order.erpOrderItemCode,
                        itemDesc: order.erpOrderItemCode,
                        productType: order.productType,
                        quantityKg: supply,
                        shipDate: order.shipDate,
                        plannedProductionDate: targetProdDate,
                        isManualOverride: false
                    }));
                    supplyMap.set(dateStr, 0);
                }
                const shortage = order.qty - supply;
                exceptionsToSave.push(this.exceptionRepo.create({
                    mpsPlan: plan,
                    erpOrderLineId: order.erpOrderLineId,
                    soNumber: order.erpOrderHeaderId?.toString() || '-',
                    itemCode: order.erpOrderItemCode,
                    shipDate: order.shipDate,
                    requiredKg: order.qty,
                    shortageKg: shortage,
                    reason: `No supply available for Chill on ${dateStr}`
                }));
            }
        }
        for (const order of freezeOrders) {
            totalDemandKg += order.qty;
            let remainingQty = order.qty;
            const startDate = subtractDays(order.shipDate, 5);
            const endDate = subtractDays(order.shipDate, 30);
            for (let d = new Date(startDate); d >= endDate; d = subtractDays(d, 1)) {
                if (remainingQty <= 0)
                    break;
                const dateStr = formatDate(d);
                const supply = supplyMap.get(dateStr) || 0;
                if (supply > 0) {
                    const allocQty = Math.min(supply, remainingQty);
                    mpsOrdersToSave.push(this.mpsOrderRepo.create({
                        mpsPlan: plan,
                        erpOrderLineId: order.erpOrderLineId,
                        itemCode: order.erpOrderItemCode,
                        itemDesc: order.erpOrderItemCode,
                        productType: order.productType,
                        quantityKg: allocQty,
                        shipDate: order.shipDate,
                        plannedProductionDate: d,
                        isManualOverride: false
                    }));
                    supplyMap.set(dateStr, supply - allocQty);
                    remainingQty -= allocQty;
                }
            }
            if (remainingQty > 0) {
                exceptionsToSave.push(this.exceptionRepo.create({
                    mpsPlan: plan,
                    erpOrderLineId: order.erpOrderLineId,
                    soNumber: order.erpOrderHeaderId?.toString() || '-',
                    itemCode: order.erpOrderItemCode,
                    shipDate: order.shipDate,
                    requiredKg: order.qty,
                    shortageKg: remainingQty,
                    reason: `Insufficient supply for Freeze between ${formatDate(endDate)} and ${formatDate(startDate)}`
                }));
            }
        }
        await this.mpsOrderRepo.save(mpsOrdersToSave, { chunk: 500 });
        if (exceptionsToSave.length > 0) {
            await this.exceptionRepo.save(exceptionsToSave, { chunk: 500 });
        }
        const mpsDailiesToSave = [];
        let totalIntakeBirds = 0;
        let totalRmFlKg = 0;
        const dailyDemand = new Map();
        const dailyStaff = new Map();
        mpsOrdersToSave.forEach(o => {
            const d = formatDate(o.plannedProductionDate);
            dailyDemand.set(d, (dailyDemand.get(d) || 0) + Number(o.quantityKg));
            const spec = specMap.get(o.itemCode);
            const speed = Number(spec?.productSpeed || 45);
            dailyStaff.set(d, (dailyStaff.get(d) || 0) + (Number(o.quantityKg) / speed));
        });
        const daysInMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
            const dayStr = `${targetMonth}-${i.toString().padStart(2, '0')}`;
            let intakeBirds = 0;
            let originalSupplyKg = 0;
            allIntakes.forEach((intake) => {
                const d = intake.receive_date ? new Date(intake.receive_date).toISOString().split('T')[0] : null;
                if (d === dayStr) {
                    intakeBirds += Number(intake.chicken_count || 0);
                    const intakeKg = Number(intake.chicken_weight || 0);
                    originalSupplyKg += intakeKg * 0.957 * 0.95 * 0.04 * (1 - 0.093);
                }
            });
            const demand = dailyDemand.get(dayStr) || 0;
            totalIntakeBirds += intakeBirds;
            totalRmFlKg += originalSupplyKg;
            const cuttingStaff = demand > 0 ? (dailyStaff.get(dayStr) || 0) / 10 : 0;
            const supportStaff = demand > 0 ? 28 : 0;
            mpsDailiesToSave.push(this.mpsDailyRepo.create({
                mpsPlan: plan,
                productionDate: new Date(dayStr),
                intakeBirds: intakeBirds,
                rmFlAvailKg: originalSupplyKg,
                demandKg: demand,
                cuttingStaff: Math.ceil(cuttingStaff),
                supportStaff,
                totalStaff: Math.ceil(cuttingStaff + supportStaff)
            }));
        }
        await this.mpsDailyRepo.save(mpsDailiesToSave, { chunk: 500 });
        plan.totalIntakeBirds = totalIntakeBirds;
        plan.totalRmFlKg = totalRmFlKg;
        plan.totalDemandKg = totalDemandKg;
        await this.mpsPlanRepo.save(plan);
        return { success: true, planId: plan.id, status: plan.status };
    }
    async getPlans() {
        return this.mpsPlanRepo.find({
            order: {
                createdAt: 'DESC'
            }
        });
    }
    async deletePlan(body, id) {
        const plan = await this.mpsPlanRepo.findOne({ where: { id } });
        if (plan) {
            await this.mpsPlanRepo.remove(plan);
            return { success: true };
        }
        return { success: false, message: 'Plan not found' };
    }
    async getPlan(id) {
        const plan = await this.mpsPlanRepo.findOne({
            where: { id },
            relations: ['dailySummaries', 'orders', 'exceptions']
        });
        if (!plan) {
            return { success: false, message: 'Plan not found' };
        }
        return { success: true, data: plan };
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
__decorate([
    (0, common_1.Get)('plans'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MpsController.prototype, "getPlans", null);
__decorate([
    (0, common_1.Post)('plans/:id/delete'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], MpsController.prototype, "deletePlan", null);
__decorate([
    (0, common_1.Get)('plans/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], MpsController.prototype, "getPlan", null);
exports.MpsController = MpsController = __decorate([
    (0, common_1.Controller)('api/mps'),
    __param(0, (0, typeorm_1.InjectRepository)(stg_erp_order_line_entity_1.StgErpOrderLine)),
    __param(1, (0, typeorm_1.InjectRepository)(product_spec_entity_1.ProductSpec)),
    __param(2, (0, typeorm_1.InjectRepository)(mps_plan_entity_1.MpsPlan)),
    __param(3, (0, typeorm_1.InjectRepository)(mps_plan_entity_1.MpsPlanDaily)),
    __param(4, (0, typeorm_1.InjectRepository)(mps_plan_entity_1.MpsPlanOrder)),
    __param(5, (0, typeorm_1.InjectRepository)(mps_exception_entity_1.MpsExceptionReport)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        chicken_receiving_service_1.ChickenReceivingService])
], MpsController);
//# sourceMappingURL=mps.controller.js.map