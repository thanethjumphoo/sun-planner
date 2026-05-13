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
exports.MasterYieldController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const master_yield_entity_1 = require("./master-yield.entity");
let MasterYieldController = class MasterYieldController {
    masterYieldRepository;
    constructor(masterYieldRepository) {
        this.masterYieldRepository = masterYieldRepository;
    }
    async getTree() {
        return this.masterYieldRepository.find({
            relations: ['children', 'children.children', 'children.children.children'],
            where: { parentId: (0, typeorm_2.IsNull)() },
            order: { createdAt: 'ASC' }
        });
    }
    async createNode(data) {
        const node = this.masterYieldRepository.create(data);
        return this.masterYieldRepository.save(node);
    }
    async updateNode(id, data) {
        await this.masterYieldRepository.update(id, data);
        return this.masterYieldRepository.findOne({ where: { id } });
    }
    async deleteNode(id) {
        const node = await this.masterYieldRepository.findOne({ where: { id }, relations: ['children', 'children.children'] });
        if (!node)
            return { success: false };
        if (node.children) {
            for (const child of node.children) {
                if (child.children) {
                    for (const grandchild of child.children) {
                        await this.masterYieldRepository.delete(grandchild.id);
                    }
                }
                await this.masterYieldRepository.delete(child.id);
            }
        }
        await this.masterYieldRepository.delete(id);
        return { success: true };
    }
};
exports.MasterYieldController = MasterYieldController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MasterYieldController.prototype, "getTree", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MasterYieldController.prototype, "createNode", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MasterYieldController.prototype, "updateNode", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MasterYieldController.prototype, "deleteNode", null);
exports.MasterYieldController = MasterYieldController = __decorate([
    (0, common_1.Controller)('api/master-yield'),
    __param(0, (0, typeorm_1.InjectRepository)(master_yield_entity_1.MasterYield)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], MasterYieldController);
//# sourceMappingURL=master-yield.controller.js.map