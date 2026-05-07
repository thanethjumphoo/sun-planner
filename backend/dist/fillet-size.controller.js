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
exports.FilletSizeController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const fillet_size_entity_1 = require("./fillet-size.entity");
let FilletSizeController = class FilletSizeController {
    configRepo;
    groupRepo;
    calcRepo;
    constructor(configRepo, groupRepo, calcRepo) {
        this.configRepo = configRepo;
        this.groupRepo = groupRepo;
        this.calcRepo = calcRepo;
    }
    async getAll() {
        const configs = await this.configRepo.find();
        const groups = await this.groupRepo.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
        const calcs = await this.calcRepo.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
        const yieldConfig = configs.find(c => c.configKey === 'fillet_yield');
        const filletYield = yieldConfig ? Number(yieldConfig.configValue) : 0.42;
        return {
            filletYield,
            groups: groups.map(g => ({
                id: g.id,
                name: g.groupName,
                sortOrder: g.sortOrder,
            })),
            calcs: calcs.map(c => ({
                id: c.id,
                colLabel: c.colLabel,
                lbWeight: Number(c.lbWeight),
                filletSize: c.filletSize,
                groupName: c.groupName,
                sortOrder: c.sortOrder,
            })),
        };
    }
    async saveYield(body) {
        let config = await this.configRepo.findOne({ where: { configKey: 'fillet_yield' } });
        if (config) {
            config.configValue = body.filletYield;
        }
        else {
            config = this.configRepo.create({ configKey: 'fillet_yield', configValue: body.filletYield });
        }
        await this.configRepo.save(config);
        return { success: true, filletYield: Number(config.configValue) };
    }
    async saveCalc(body) {
        await this.calcRepo.clear();
        const entities = body.items.map((item, idx) => this.calcRepo.create({
            colLabel: item.colLabel,
            lbWeight: item.lbWeight,
            filletSize: item.filletSize,
            groupName: item.groupName,
            sortOrder: idx,
        }));
        const saved = await this.calcRepo.save(entities, { chunk: 100 });
        return { success: true, count: saved.length };
    }
    async addGroup(body) {
        const maxOrder = await this.groupRepo
            .createQueryBuilder('g')
            .select('MAX(g.sortOrder)', 'maxOrder')
            .getRawOne();
        const sortOrder = (maxOrder?.maxOrder ?? 0) + 1;
        const group = this.groupRepo.create({
            groupName: body.name,
            sortOrder,
        });
        const saved = await this.groupRepo.save(group);
        return {
            success: true,
            group: { id: saved.id, name: saved.groupName, sortOrder: saved.sortOrder },
        };
    }
    async updateGroup(id, body) {
        const group = await this.groupRepo.findOneBy({ id });
        if (group) {
            group.groupName = body.name;
            await this.groupRepo.save(group);
        }
        return { success: true };
    }
    async deleteGroup(id) {
        await this.groupRepo.delete(id);
        return { success: true };
    }
    async bulkSaveGroups(body) {
        await this.groupRepo.clear();
        const entities = body.groups.map((g, idx) => this.groupRepo.create({ groupName: g.name, sortOrder: idx }));
        const saved = await this.groupRepo.save(entities, { chunk: 100 });
        return { success: true, count: saved.length };
    }
};
exports.FilletSizeController = FilletSizeController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FilletSizeController.prototype, "getAll", null);
__decorate([
    (0, common_1.Post)('yield'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FilletSizeController.prototype, "saveYield", null);
__decorate([
    (0, common_1.Post)('calc/save'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FilletSizeController.prototype, "saveCalc", null);
__decorate([
    (0, common_1.Post)('groups'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FilletSizeController.prototype, "addGroup", null);
__decorate([
    (0, common_1.Post)('groups/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], FilletSizeController.prototype, "updateGroup", null);
__decorate([
    (0, common_1.Delete)('groups/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], FilletSizeController.prototype, "deleteGroup", null);
__decorate([
    (0, common_1.Post)('groups/bulk-save'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FilletSizeController.prototype, "bulkSaveGroups", null);
exports.FilletSizeController = FilletSizeController = __decorate([
    (0, common_1.Controller)('api/fillet-size'),
    __param(0, (0, typeorm_1.InjectRepository)(fillet_size_entity_1.FilletConfig)),
    __param(1, (0, typeorm_1.InjectRepository)(fillet_size_entity_1.FilletGroup)),
    __param(2, (0, typeorm_1.InjectRepository)(fillet_size_entity_1.FilletSizeCalc)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], FilletSizeController);
//# sourceMappingURL=fillet-size.controller.js.map