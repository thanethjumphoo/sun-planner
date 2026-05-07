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
exports.StgErpOrderLine = void 0;
const typeorm_1 = require("typeorm");
let StgErpOrderLine = class StgErpOrderLine {
    id;
    erpOrderLineId;
    erpOrderHeaderId;
    erpOrgId;
    erpOrderLineNumber;
    erpOrderItemId;
    erpOrderItemCode;
    erpOrderItemQty;
    erpOrderItemUom;
    erpOrderShipDate;
    erpCreationDate;
    erpLastUpdateDate;
    erpOrderStatus;
    plannedProductionDate;
    priority;
};
exports.StgErpOrderLine = StgErpOrderLine;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], StgErpOrderLine.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'erp_order_line_id', type: 'int', nullable: true }),
    __metadata("design:type", Number)
], StgErpOrderLine.prototype, "erpOrderLineId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'erp_order_header_id', type: 'int', nullable: true }),
    __metadata("design:type", Number)
], StgErpOrderLine.prototype, "erpOrderHeaderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'erp_org_id', type: 'int', nullable: true }),
    __metadata("design:type", Number)
], StgErpOrderLine.prototype, "erpOrgId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'erp_order_line_number', type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], StgErpOrderLine.prototype, "erpOrderLineNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'erp_order_item_id', type: 'int', nullable: true }),
    __metadata("design:type", Number)
], StgErpOrderLine.prototype, "erpOrderItemId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'erp_order_item_code', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], StgErpOrderLine.prototype, "erpOrderItemCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'erp_order_item_qty', type: 'decimal', precision: 18, scale: 4, nullable: true }),
    __metadata("design:type", Number)
], StgErpOrderLine.prototype, "erpOrderItemQty", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'erp_order_item_uom', type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", String)
], StgErpOrderLine.prototype, "erpOrderItemUom", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'erp_order_ship_date', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], StgErpOrderLine.prototype, "erpOrderShipDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'erp_creation_date', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], StgErpOrderLine.prototype, "erpCreationDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'erp_last_update_date', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], StgErpOrderLine.prototype, "erpLastUpdateDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'erp_order_status', type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], StgErpOrderLine.prototype, "erpOrderStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'planned_production_date', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], StgErpOrderLine.prototype, "plannedProductionDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'priority', type: 'int', nullable: true, default: null }),
    __metadata("design:type", Number)
], StgErpOrderLine.prototype, "priority", void 0);
exports.StgErpOrderLine = StgErpOrderLine = __decorate([
    (0, typeorm_1.Entity)('stg_erp_order_lines')
], StgErpOrderLine);
//# sourceMappingURL=stg-erp-order-line.entity.js.map