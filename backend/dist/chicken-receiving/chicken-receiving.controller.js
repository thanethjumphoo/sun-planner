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
exports.ChickenReceivingController = void 0;
const common_1 = require("@nestjs/common");
const chicken_receiving_service_1 = require("./chicken-receiving.service");
let ChickenReceivingController = class ChickenReceivingController {
    chickenReceivingService;
    constructor(chickenReceivingService) {
        this.chickenReceivingService = chickenReceivingService;
    }
    createBatch(type, data) {
        return this.chickenReceivingService.createBatch(type, data.rows);
    }
    create(type, data) {
        return this.chickenReceivingService.create(type, data);
    }
    findAll(type) {
        return this.chickenReceivingService.findAll(type);
    }
    update(type, id, data) {
        return this.chickenReceivingService.update(type, id, data);
    }
    remove(type, id) {
        return this.chickenReceivingService.remove(type, id);
    }
};
exports.ChickenReceivingController = ChickenReceivingController;
__decorate([
    (0, common_1.Post)(':type/batch'),
    __param(0, (0, common_1.Param)('type')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ChickenReceivingController.prototype, "createBatch", null);
__decorate([
    (0, common_1.Post)(':type'),
    __param(0, (0, common_1.Param)('type')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ChickenReceivingController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':type'),
    __param(0, (0, common_1.Param)('type')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ChickenReceivingController.prototype, "findAll", null);
__decorate([
    (0, common_1.Put)(':type/:id'),
    __param(0, (0, common_1.Param)('type')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], ChickenReceivingController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':type/:id'),
    __param(0, (0, common_1.Param)('type')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ChickenReceivingController.prototype, "remove", null);
exports.ChickenReceivingController = ChickenReceivingController = __decorate([
    (0, common_1.Controller)('api/chicken-receiving'),
    __metadata("design:paramtypes", [chicken_receiving_service_1.ChickenReceivingService])
], ChickenReceivingController);
//# sourceMappingURL=chicken-receiving.controller.js.map