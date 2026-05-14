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
exports.DpsController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const dps_plan_entity_1 = require("./dps-plan.entity");
let DpsController = class DpsController {
    planRepo;
    sublotRepo;
    orderRepo;
    allocationRepo;
    constructor(planRepo, sublotRepo, orderRepo, allocationRepo) {
        this.planRepo = planRepo;
        this.sublotRepo = sublotRepo;
        this.orderRepo = orderRepo;
        this.allocationRepo = allocationRepo;
    }
    async getPlanByDate(date, partType) {
        const pt = partType || 'fillet';
        const plan = await this.planRepo.findOne({
            where: { productionDate: new Date(date), partType: pt },
            relations: [
                'sublots',
                'sublots.bins',
                'orders',
                'allocations',
                'allocations.sourceBin',
                'allocations.sourceBin.sublot',
                'allocations.targetOrder'
            ],
        });
        if (!plan)
            return { exists: false };
        return { exists: true, data: plan };
    }
    async deletePlan(date, partType) {
        const pt = partType || 'fillet';
        const existing = await this.planRepo.findOne({ where: { productionDate: new Date(date), partType: pt } });
        if (existing) {
            await this.planRepo.remove(existing);
        }
        return { success: true };
    }
    async saveGeneratedPlan(date, payload) {
        const pt = payload.partType || 'fillet';
        const existing = await this.planRepo.findOne({ where: { productionDate: new Date(date), partType: pt } });
        if (existing) {
            await this.planRepo.remove(existing);
        }
        const plan = this.planRepo.create({
            productionDate: new Date(date),
            partType: pt,
            status: 'CONFIRMED',
            totalSupplyKg: payload.totalSupplyKg,
            totalDemandKg: payload.totalDemandKg,
            fulfillmentRate: payload.fulfillmentRate,
        });
        plan.sublots = payload.sublots.map((sl) => {
            const sublot = new dps_plan_entity_1.DpsSublot();
            sublot.sublotNumber = sl.id;
            sublot.farmName = sl.farmName;
            sublot.shift = sl.shift || 'A';
            sublot.totalBirds = Math.round(sl.totalBirds);
            sublot.totalWeightKg = Math.round(sl.totalWeightKg);
            sublot.avgLiveWeight = sl.avgLiveWeight;
            sublot.coProductKg = Number((sl.coProductKg || 0).toFixed(1));
            sublot.bins = Object.keys(sl.bins).map(binKey => {
                const bin = new dps_plan_entity_1.DpsSublotBin();
                bin.sizeLabel = binKey;
                bin.availableKg = Number((sl.bins[binKey] || 0).toFixed(1));
                return bin;
            });
            return sublot;
        });
        plan.orders = payload.orders.map((o) => {
            const order = new dps_plan_entity_1.DpsOrder();
            order.erpOrderLineId = parseInt(o.id.replace('L-', '')) || 0;
            order.itemCode = o.itemCode;
            order.itemDesc = o.itemDesc;
            order.productType = o.type;
            order.productSize = o.size;
            order.requiredKg = Number(o.qty.toFixed(1));
            order.fulfilledKg = Number(o.fulfilledKg.toFixed(1));
            order.unfulfilledKg = Number(o.unfulfilledKg.toFixed(1));
            return order;
        });
        const savedPlan = await this.planRepo.save(plan);
        const reloadedPlan = await this.planRepo.findOne({
            where: { id: savedPlan.id },
            relations: ['sublots', 'sublots.bins', 'orders'],
        });
        if (!reloadedPlan)
            return { success: false, message: 'Plan not found after saving' };
        const allocationsToSave = [];
        for (const alloc of payload.allocations) {
            const dbSublot = reloadedPlan.sublots.find(s => s.sublotNumber === alloc.sublotId);
            if (!dbSublot)
                continue;
            const dbBin = dbSublot.bins.find(b => b.sizeLabel === alloc.size);
            const dbOrder = reloadedPlan.orders.find(o => `L-${o.erpOrderLineId}` === alloc.orderId);
            if (!dbOrder)
                continue;
            const newAlloc = this.allocationRepo.create({
                dpsPlan: reloadedPlan,
                sourceBin: dbBin,
                targetOrder: dbOrder,
                allocatedKg: Number(alloc.qty.toFixed(1)),
                allocationPass: 'Auto',
            });
            allocationsToSave.push(newAlloc);
        }
        if (allocationsToSave.length > 0) {
            await this.allocationRepo.save(allocationsToSave);
        }
        return { success: true, planId: savedPlan.id };
    }
};
exports.DpsController = DpsController;
__decorate([
    (0, common_1.Get)(':date'),
    __param(0, (0, common_1.Param)('date')),
    __param(1, (0, common_1.Query)('partType')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DpsController.prototype, "getPlanByDate", null);
__decorate([
    (0, common_1.Delete)(':date'),
    __param(0, (0, common_1.Param)('date')),
    __param(1, (0, common_1.Query)('partType')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DpsController.prototype, "deletePlan", null);
__decorate([
    (0, common_1.Post)(':date/generate'),
    __param(0, (0, common_1.Param)('date')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DpsController.prototype, "saveGeneratedPlan", null);
exports.DpsController = DpsController = __decorate([
    (0, common_1.Controller)('api/dps'),
    __param(0, (0, typeorm_1.InjectRepository)(dps_plan_entity_1.DpsPlan)),
    __param(1, (0, typeorm_1.InjectRepository)(dps_plan_entity_1.DpsSublot)),
    __param(2, (0, typeorm_1.InjectRepository)(dps_plan_entity_1.DpsOrder)),
    __param(3, (0, typeorm_1.InjectRepository)(dps_plan_entity_1.DpsAllocation)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], DpsController);
//# sourceMappingURL=dps.controller.js.map