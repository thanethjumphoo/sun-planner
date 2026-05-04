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
exports.StgErpItem = void 0;
const typeorm_1 = require("typeorm");
let StgErpItem = class StgErpItem {
    id;
    erpItemId;
    erpOrgId;
    erpItemType;
    erpItemCode;
    erpItemDesc;
    erpItemUom;
    erpCreationDate;
    erpLastUpdateDate;
    erpEnabledFlag;
};
exports.StgErpItem = StgErpItem;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], StgErpItem.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ERP_ITEM_ID', type: 'int', nullable: true }),
    __metadata("design:type", Number)
], StgErpItem.prototype, "erpItemId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ERP_ORG_ID', type: 'int', nullable: true }),
    __metadata("design:type", Number)
], StgErpItem.prototype, "erpOrgId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ERP_ITEM_TYPE', type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], StgErpItem.prototype, "erpItemType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ERP_ITEM_CODE', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], StgErpItem.prototype, "erpItemCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ERP_ITEM_DESC', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], StgErpItem.prototype, "erpItemDesc", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ERP_ITEM_UOM', type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", String)
], StgErpItem.prototype, "erpItemUom", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ERP_CREATION_DATE', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], StgErpItem.prototype, "erpCreationDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ERP_LAST_UPDATE_DATE', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], StgErpItem.prototype, "erpLastUpdateDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ERP_ENABLED_FLAG', type: 'varchar', length: 1, nullable: true }),
    __metadata("design:type", String)
], StgErpItem.prototype, "erpEnabledFlag", void 0);
exports.StgErpItem = StgErpItem = __decorate([
    (0, typeorm_1.Entity)('stg_erp_items')
], StgErpItem);
//# sourceMappingURL=stg-erp-item.entity.js.map