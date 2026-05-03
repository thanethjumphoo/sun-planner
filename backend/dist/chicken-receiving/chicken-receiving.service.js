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
exports.ChickenReceivingService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const monthly_plan_entity_1 = require("./entities/monthly-plan.entity");
const weekly_plan_entity_1 = require("./entities/weekly-plan.entity");
const daily_plan_entity_1 = require("./entities/daily-plan.entity");
const actual_daily_entity_1 = require("./entities/actual-daily.entity");
let ChickenReceivingService = class ChickenReceivingService {
    monthlyRepo;
    weeklyRepo;
    dailyRepo;
    actualRepo;
    constructor(monthlyRepo, weeklyRepo, dailyRepo, actualRepo) {
        this.monthlyRepo = monthlyRepo;
        this.weeklyRepo = weeklyRepo;
        this.dailyRepo = dailyRepo;
        this.actualRepo = actualRepo;
    }
    getRepo(type) {
        switch (type) {
            case 'monthly':
                return this.monthlyRepo;
            case 'weekly':
                return this.weeklyRepo;
            case 'daily':
                return this.dailyRepo;
            case 'actual':
                return this.actualRepo;
            default:
                throw new common_1.BadRequestException(`Invalid plan type: ${type}`);
        }
    }
    async create(type, data) {
        const repo = this.getRepo(type);
        const cleanData = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v === '' ? null : v]));
        const newEntry = repo.create(cleanData);
        return await repo.save(newEntry);
    }
    async findAll(type) {
        const repo = this.getRepo(type);
        return await repo.find({
            order: {
                receive_date: 'ASC',
            },
        });
    }
    async update(type, id, data) {
        const repo = this.getRepo(type);
        const cleanData = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v === '' ? null : v]));
        await repo.update(id, cleanData);
        return await repo.findOne({ where: { id } });
    }
    async remove(type, id) {
        const repo = this.getRepo(type);
        await repo.delete(id);
        return { deleted: true, id };
    }
    async createBatch(type, rows) {
        const repo = this.getRepo(type);
        const cleaned = rows.map(row => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v === '' ? null : v])));
        const entities = repo.create(cleaned);
        return await repo.save(entities);
    }
};
exports.ChickenReceivingService = ChickenReceivingService;
exports.ChickenReceivingService = ChickenReceivingService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(monthly_plan_entity_1.ChickenReceivingPlanMonthly)),
    __param(1, (0, typeorm_1.InjectRepository)(weekly_plan_entity_1.ChickenReceivingPlanWeekly)),
    __param(2, (0, typeorm_1.InjectRepository)(daily_plan_entity_1.ChickenReceivingPlanDaily)),
    __param(3, (0, typeorm_1.InjectRepository)(actual_daily_entity_1.ChickenReceivingActualDaily)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], ChickenReceivingService);
//# sourceMappingURL=chicken-receiving.service.js.map