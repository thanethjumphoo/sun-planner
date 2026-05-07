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
exports.FilletSizeCalc = exports.FilletGroup = exports.FilletConfig = void 0;
const typeorm_1 = require("typeorm");
let FilletConfig = class FilletConfig {
    id;
    configKey;
    configValue;
    createdAt;
    updatedAt;
};
exports.FilletConfig = FilletConfig;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], FilletConfig.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'CONFIG_KEY', type: 'varchar', length: 50, unique: true }),
    __metadata("design:type", String)
], FilletConfig.prototype, "configKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'CONFIG_VALUE', type: 'decimal', precision: 10, scale: 6, default: 0 }),
    __metadata("design:type", Number)
], FilletConfig.prototype, "configValue", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'CREATED_AT' }),
    __metadata("design:type", Date)
], FilletConfig.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'UPDATED_AT' }),
    __metadata("design:type", Date)
], FilletConfig.prototype, "updatedAt", void 0);
exports.FilletConfig = FilletConfig = __decorate([
    (0, typeorm_1.Entity)('fillet_config')
], FilletConfig);
let FilletGroup = class FilletGroup {
    id;
    groupName;
    sortOrder;
    createdAt;
    updatedAt;
};
exports.FilletGroup = FilletGroup;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], FilletGroup.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'GROUP_NAME', type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], FilletGroup.prototype, "groupName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'SORT_ORDER', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], FilletGroup.prototype, "sortOrder", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'CREATED_AT' }),
    __metadata("design:type", Date)
], FilletGroup.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'UPDATED_AT' }),
    __metadata("design:type", Date)
], FilletGroup.prototype, "updatedAt", void 0);
exports.FilletGroup = FilletGroup = __decorate([
    (0, typeorm_1.Entity)('fillet_groups')
], FilletGroup);
let FilletSizeCalc = class FilletSizeCalc {
    id;
    colLabel;
    lbWeight;
    filletSize;
    groupName;
    sortOrder;
    createdAt;
    updatedAt;
};
exports.FilletSizeCalc = FilletSizeCalc;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], FilletSizeCalc.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'COL_LABEL', type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], FilletSizeCalc.prototype, "colLabel", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'LB_WEIGHT', type: 'decimal', precision: 10, scale: 4, default: 0 }),
    __metadata("design:type", Number)
], FilletSizeCalc.prototype, "lbWeight", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'FILLET_SIZE', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], FilletSizeCalc.prototype, "filletSize", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'GROUP_NAME', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", Object)
], FilletSizeCalc.prototype, "groupName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'SORT_ORDER', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], FilletSizeCalc.prototype, "sortOrder", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'CREATED_AT' }),
    __metadata("design:type", Date)
], FilletSizeCalc.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'UPDATED_AT' }),
    __metadata("design:type", Date)
], FilletSizeCalc.prototype, "updatedAt", void 0);
exports.FilletSizeCalc = FilletSizeCalc = __decorate([
    (0, typeorm_1.Entity)('fillet_size_calc')
], FilletSizeCalc);
//# sourceMappingURL=fillet-size.entity.js.map