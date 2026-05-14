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
exports.ManualOperationController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const manual_operation_entity_1 = require("./manual-operation.entity");
let ManualOperationController = class ManualOperationController {
    manualOpRepo;
    constructor(manualOpRepo) {
        this.manualOpRepo = manualOpRepo;
    }
    async getManualOperations(startDate, endDate, partType) {
        const pt = partType || 'fillet';
        if (!startDate || !endDate) {
            return this.manualOpRepo.find({ where: { partType: pt } });
        }
        return this.manualOpRepo.find({
            where: {
                productionDate: (0, typeorm_2.Between)(new Date(startDate), new Date(endDate)),
                partType: pt
            }
        });
    }
    async saveManualOperations(body) {
        let data;
        let partType;
        if (Array.isArray(body)) {
            data = body;
            partType = 'fillet';
        }
        else {
            data = body.data || [];
            partType = body.partType || 'fillet';
        }
        for (const op of data) {
            const existing = await this.manualOpRepo.findOne({
                where: { productionDate: new Date(op.date), partType }
            });
            if (existing) {
                if (op.plannedStationWorkers !== undefined)
                    existing.plannedStationWorkers = op.plannedStationWorkers;
                if (op.actualStationWorkers !== undefined)
                    existing.actualStationWorkers = op.actualStationWorkers;
                if (op.actualCuttingWorkers !== undefined)
                    existing.actualCuttingWorkers = op.actualCuttingWorkers;
                await this.manualOpRepo.save(existing);
            }
            else {
                const newOp = this.manualOpRepo.create({
                    productionDate: new Date(op.date),
                    partType,
                    plannedStationWorkers: op.plannedStationWorkers || 0,
                    actualStationWorkers: op.actualStationWorkers || 0,
                    actualCuttingWorkers: op.actualCuttingWorkers || 0
                });
                await this.manualOpRepo.save(newOp);
            }
        }
        return { success: true };
    }
};
exports.ManualOperationController = ManualOperationController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('startDate')),
    __param(1, (0, common_1.Query)('endDate')),
    __param(2, (0, common_1.Query)('partType')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], ManualOperationController.prototype, "getManualOperations", null);
__decorate([
    (0, common_1.Post)('save'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ManualOperationController.prototype, "saveManualOperations", null);
exports.ManualOperationController = ManualOperationController = __decorate([
    (0, common_1.Controller)('api/manual-operation'),
    __param(0, (0, typeorm_1.InjectRepository)(manual_operation_entity_1.ManualOperation)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ManualOperationController);
//# sourceMappingURL=manual-operation.controller.js.map