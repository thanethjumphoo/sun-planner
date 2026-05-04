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
exports.WeightDistributionController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const weight_distribution_entity_1 = require("./weight-distribution.entity");
let WeightDistributionController = class WeightDistributionController {
    wdRepo;
    constructor(wdRepo) {
        this.wdRepo = wdRepo;
    }
    async getAll() {
        const rows = await this.wdRepo.find({ order: { rowLabel: 'ASC', colLabel: 'ASC' } });
        const rowLabels = [...new Set(rows.map(r => r.rowLabel))];
        const colLabels = [...new Set(rows.map(r => r.colLabel))];
        const matrix = {};
        for (const r of rows) {
            if (!matrix[r.rowLabel])
                matrix[r.rowLabel] = {};
            matrix[r.rowLabel][r.colLabel] = Number(r.distValue);
        }
        return { rowLabels, colLabels, matrix, totalRecords: rows.length };
    }
    async bulkSave(body) {
        await this.wdRepo.clear();
        const entities = [];
        for (const rowLabel of body.rowLabels) {
            for (const colLabel of body.colLabels) {
                const val = body.matrix?.[rowLabel]?.[colLabel] ?? 0;
                const entity = this.wdRepo.create({
                    rowLabel,
                    colLabel,
                    distValue: val,
                });
                entities.push(entity);
            }
        }
        const saved = await this.wdRepo.save(entities, { chunk: 500 });
        return { success: true, count: saved.length };
    }
};
exports.WeightDistributionController = WeightDistributionController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], WeightDistributionController.prototype, "getAll", null);
__decorate([
    (0, common_1.Post)('bulk-save'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WeightDistributionController.prototype, "bulkSave", null);
exports.WeightDistributionController = WeightDistributionController = __decorate([
    (0, common_1.Controller)('api/weight-distribution'),
    __param(0, (0, typeorm_1.InjectRepository)(weight_distribution_entity_1.WeightDistribution)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], WeightDistributionController);
//# sourceMappingURL=weight-distribution.controller.js.map