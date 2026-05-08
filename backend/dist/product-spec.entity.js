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
exports.ProductSpec = void 0;
const typeorm_1 = require("typeorm");
let ProductSpec = class ProductSpec {
    id;
    erpItemId;
    erpItemCode;
    erpItemDesc;
    erpItemType;
    productType;
    productSize;
    productYield;
    productWeight;
    productSpeed;
    productLead;
    createdAt;
    updatedAt;
};
exports.ProductSpec = ProductSpec;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], ProductSpec.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ERP_ITEM_ID', type: 'int', nullable: true }),
    __metadata("design:type", Number)
], ProductSpec.prototype, "erpItemId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ERP_ITEM_CODE', type: 'varchar', length: 100, unique: true }),
    __metadata("design:type", String)
], ProductSpec.prototype, "erpItemCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ERP_ITEM_DESC', type: 'nvarchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ProductSpec.prototype, "erpItemDesc", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ERP_ITEM_TYPE', type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], ProductSpec.prototype, "erpItemType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'PRODUCT_TYPE', type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", String)
], ProductSpec.prototype, "productType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'PRODUCT_SIZE', type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], ProductSpec.prototype, "productSize", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'PRODUCT_YIELD', type: 'decimal', precision: 10, scale: 4, nullable: true }),
    __metadata("design:type", Number)
], ProductSpec.prototype, "productYield", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'PRODUCT_WEIGHT', type: 'decimal', precision: 10, scale: 4, nullable: true }),
    __metadata("design:type", Number)
], ProductSpec.prototype, "productWeight", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'PRODUCT_SPEED', type: 'decimal', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], ProductSpec.prototype, "productSpeed", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'PRODUCT_LEAD', type: 'int', nullable: true }),
    __metadata("design:type", Number)
], ProductSpec.prototype, "productLead", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'CREATED_AT' }),
    __metadata("design:type", Date)
], ProductSpec.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'UPDATED_AT' }),
    __metadata("design:type", Date)
], ProductSpec.prototype, "updatedAt", void 0);
exports.ProductSpec = ProductSpec = __decorate([
    (0, typeorm_1.Entity)('product_specs')
], ProductSpec);
//# sourceMappingURL=product-spec.entity.js.map