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
exports.ProductSpecController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const product_spec_entity_1 = require("./product-spec.entity");
const stg_erp_item_entity_1 = require("./stg-erp-item.entity");
let ProductSpecController = class ProductSpecController {
    productSpecRepo;
    stgItemRepo;
    constructor(productSpecRepo, stgItemRepo) {
        this.productSpecRepo = productSpecRepo;
        this.stgItemRepo = stgItemRepo;
    }
    async getErpItems(search) {
        if (search) {
            const items = await this.stgItemRepo.find({
                where: [
                    { erpItemCode: (0, typeorm_2.Like)(`%${search}%`) },
                    { erpItemDesc: (0, typeorm_2.Like)(`%${search}%`) }
                ],
                order: { erpItemCode: 'ASC' },
            });
            return items;
        }
        const items = await this.stgItemRepo.find({
            order: { erpItemCode: 'ASC' },
        });
        return items;
    }
    async getAll() {
        const specs = await this.productSpecRepo.find({
            order: { erpItemCode: 'ASC' },
        });
        const items = await this.stgItemRepo.find();
        const itemMap = new Map();
        items.forEach(i => {
            if (i.erpItemCode)
                itemMap.set(i.erpItemCode, i.erpItemDesc);
        });
        return specs.map(spec => ({
            ...spec,
            erpItemDesc: spec.erpItemDesc || itemMap.get(spec.erpItemCode) || '-'
        }));
    }
    async getOne(id) {
        return this.productSpecRepo.findOne({ where: { id } });
    }
    async create(body) {
        const existing = await this.productSpecRepo.findOne({
            where: { erpItemCode: body.erpItemCode },
        });
        if (existing) {
            return { success: false, message: 'Product spec already exists for this item code' };
        }
        let desc = body.erpItemDesc;
        if (!desc || desc === '-') {
            const erpItem = await this.stgItemRepo.findOne({ where: { erpItemCode: body.erpItemCode } });
            if (erpItem)
                desc = erpItem.erpItemDesc;
        }
        const spec = this.productSpecRepo.create({
            erpItemId: body.erpItemId,
            erpItemCode: body.erpItemCode,
            erpItemDesc: desc,
            erpItemType: body.erpItemType,
            productType: body.productType,
            productSize: body.productSize,
            productYield: body.productYield,
            productWeight: body.productWeight,
            productSpeed: body.productSpeed,
            productLead: body.productLead,
        });
        const saved = await this.productSpecRepo.save(spec);
        return { success: true, data: saved };
    }
    async update(id, body) {
        const spec = await this.productSpecRepo.findOne({ where: { id } });
        if (!spec) {
            return { success: false, message: 'Product spec not found' };
        }
        if (body.productType !== undefined)
            spec.productType = body.productType;
        if (body.productSize !== undefined)
            spec.productSize = body.productSize;
        if (body.productYield !== undefined)
            spec.productYield = body.productYield;
        if (body.productWeight !== undefined)
            spec.productWeight = body.productWeight;
        if (body.productSpeed !== undefined)
            spec.productSpeed = body.productSpeed;
        if (body.productLead !== undefined)
            spec.productLead = body.productLead;
        const saved = await this.productSpecRepo.save(spec);
        return { success: true, data: saved };
    }
    async bulkCreate(body) {
        const results = [];
        for (const item of body.items) {
            const existing = await this.productSpecRepo.findOne({
                where: { erpItemCode: item.erpItemCode },
            });
            if (existing) {
                results.push({ itemCode: item.erpItemCode, status: 'skipped', message: 'Already exists' });
                continue;
            }
            let desc = item.erpItemDesc;
            if (!desc || desc === '-') {
                const erpItem = await this.stgItemRepo.findOne({ where: { erpItemCode: item.erpItemCode } });
                if (erpItem)
                    desc = erpItem.erpItemDesc;
            }
            const spec = this.productSpecRepo.create({
                erpItemId: item.erpItemId,
                erpItemCode: item.erpItemCode,
                erpItemDesc: desc,
                erpItemType: item.erpItemType,
                productType: body.productType,
                productSize: body.productSize,
                productYield: body.productYield,
                productWeight: body.productWeight,
                productSpeed: body.productSpeed,
                productLead: body.productLead,
            });
            const saved = await this.productSpecRepo.save(spec);
            results.push({ itemCode: item.erpItemCode, status: 'created', data: saved });
        }
        return { success: true, results };
    }
};
exports.ProductSpecController = ProductSpecController;
__decorate([
    (0, common_1.Get)('erp-items'),
    __param(0, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProductSpecController.prototype, "getErpItems", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ProductSpecController.prototype, "getAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], ProductSpecController.prototype, "getOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProductSpecController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], ProductSpecController.prototype, "update", null);
__decorate([
    (0, common_1.Post)('bulk'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProductSpecController.prototype, "bulkCreate", null);
exports.ProductSpecController = ProductSpecController = __decorate([
    (0, common_1.Controller)('api/product-spec'),
    __param(0, (0, typeorm_1.InjectRepository)(product_spec_entity_1.ProductSpec)),
    __param(1, (0, typeorm_1.InjectRepository)(stg_erp_item_entity_1.StgErpItem)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], ProductSpecController);
//# sourceMappingURL=product-spec.controller.js.map