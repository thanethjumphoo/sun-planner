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
exports.ErpIntegrationController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const target_sync_item_entity_1 = require("./target-sync-item.entity");
const oracle_integration_service_1 = require("./oracle-integration.service");
let ErpIntegrationController = class ErpIntegrationController {
    targetItemRepo;
    oracleService;
    constructor(targetItemRepo, oracleService) {
        this.targetItemRepo = targetItemRepo;
        this.oracleService = oracleService;
    }
    async getTargetItems() {
        const items = await this.targetItemRepo.find({ order: { createdAt: 'DESC' } });
        return items.map(item => item.itemCode);
    }
    async addTargetItems(body) {
        if (!body.itemCodes || !Array.isArray(body.itemCodes))
            return { success: false };
        for (const code of body.itemCodes) {
            const exists = await this.targetItemRepo.findOne({ where: { itemCode: code } });
            if (!exists) {
                const newItem = this.targetItemRepo.create({ itemCode: code });
                await this.targetItemRepo.save(newItem);
            }
        }
        return { success: true };
    }
    async removeTargetItem(code) {
        await this.targetItemRepo.delete({ itemCode: code });
        return { success: true };
    }
    async syncTargetItems() {
        const items = await this.targetItemRepo.find();
        const codes = items.map(i => i.itemCode);
        if (codes.length === 0)
            return { message: 'No item codes to sync' };
        const syncedItems = await this.oracleService.syncItems(codes);
        return { success: true, count: syncedItems.length, data: syncedItems };
    }
    async syncOrderHeaders() {
        const syncedOrders = await this.oracleService.syncOrderHeaders();
        return { success: true, count: syncedOrders.length, data: syncedOrders };
    }
    async getOrderHeaders() {
        const orders = await this.oracleService.getLocalOrderHeaders();
        return orders;
    }
    async syncOrderLines() {
        const syncedLines = await this.oracleService.syncOrderLines();
        return { success: true, count: syncedLines.length, data: syncedLines };
    }
    async getOrderLines() {
        const lines = await this.oracleService.getLocalOrderLines();
        return lines;
    }
    async getDemandOrders() {
        return this.oracleService.getDemandOrders();
    }
};
exports.ErpIntegrationController = ErpIntegrationController;
__decorate([
    (0, common_1.Get)('target-items'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ErpIntegrationController.prototype, "getTargetItems", null);
__decorate([
    (0, common_1.Post)('target-items'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ErpIntegrationController.prototype, "addTargetItems", null);
__decorate([
    (0, common_1.Delete)('target-items/:code'),
    __param(0, (0, common_1.Param)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ErpIntegrationController.prototype, "removeTargetItem", null);
__decorate([
    (0, common_1.Post)('sync-items'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ErpIntegrationController.prototype, "syncTargetItems", null);
__decorate([
    (0, common_1.Post)('sync-order-headers'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ErpIntegrationController.prototype, "syncOrderHeaders", null);
__decorate([
    (0, common_1.Get)('order-headers'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ErpIntegrationController.prototype, "getOrderHeaders", null);
__decorate([
    (0, common_1.Post)('sync-order-lines'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ErpIntegrationController.prototype, "syncOrderLines", null);
__decorate([
    (0, common_1.Get)('order-lines'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ErpIntegrationController.prototype, "getOrderLines", null);
__decorate([
    (0, common_1.Get)('demand-orders'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ErpIntegrationController.prototype, "getDemandOrders", null);
exports.ErpIntegrationController = ErpIntegrationController = __decorate([
    (0, common_1.Controller)('api/erp'),
    __param(0, (0, typeorm_1.InjectRepository)(target_sync_item_entity_1.TargetSyncItem)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        oracle_integration_service_1.OracleIntegrationService])
], ErpIntegrationController);
//# sourceMappingURL=erp-integration.controller.js.map