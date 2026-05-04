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
exports.StgErpOrderHeader = void 0;
const typeorm_1 = require("typeorm");
let StgErpOrderHeader = class StgErpOrderHeader {
    id;
    erpOrderHeaderId;
    erpOrgId;
    erpOrderDate;
    erpOrderNumber;
    erpOrderType;
    erpCustomerNumber;
    erpCustomerName;
    erpCustomerGrade;
    erpCreationDate;
    erpLastUpdateDate;
    erpOrderStatus;
};
exports.StgErpOrderHeader = StgErpOrderHeader;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], StgErpOrderHeader.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'erp_order_header_id', type: 'int', nullable: true }),
    __metadata("design:type", Number)
], StgErpOrderHeader.prototype, "erpOrderHeaderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'erp_org_id', type: 'int', nullable: true }),
    __metadata("design:type", Number)
], StgErpOrderHeader.prototype, "erpOrgId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'erp_order_date', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], StgErpOrderHeader.prototype, "erpOrderDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'erp_order_number', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], StgErpOrderHeader.prototype, "erpOrderNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'erp_order_type', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], StgErpOrderHeader.prototype, "erpOrderType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'erp_customer_number', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], StgErpOrderHeader.prototype, "erpCustomerNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'erp_customer_name', type: 'nvarchar', length: 500, nullable: true }),
    __metadata("design:type", String)
], StgErpOrderHeader.prototype, "erpCustomerName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'erp_customer_grade', type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], StgErpOrderHeader.prototype, "erpCustomerGrade", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'erp_creation_date', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], StgErpOrderHeader.prototype, "erpCreationDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'erp_last_update_date', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], StgErpOrderHeader.prototype, "erpLastUpdateDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'erp_order_status', type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], StgErpOrderHeader.prototype, "erpOrderStatus", void 0);
exports.StgErpOrderHeader = StgErpOrderHeader = __decorate([
    (0, typeorm_1.Entity)('stg_erp_order_headers')
], StgErpOrderHeader);
//# sourceMappingURL=stg-erp-order-header.entity.js.map