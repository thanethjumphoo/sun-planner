"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MpsController = void 0;
const common_1 = require("@nestjs/common");
const express = __importStar(require("express"));
const ExcelJS = __importStar(require("exceljs"));
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const stg_erp_order_line_entity_1 = require("./stg-erp-order-line.entity");
const stg_erp_order_header_entity_1 = require("./stg-erp-order-header.entity");
const product_spec_entity_1 = require("./product-spec.entity");
const mps_plan_entity_1 = require("./mps-plan.entity");
const mps_plan_supply_entity_1 = require("./mps-plan-supply.entity");
const mps_plan_supply_size_entity_1 = require("./mps-plan-supply-size.entity");
const weight_distribution_entity_1 = require("./weight-distribution.entity");
const fillet_size_entity_1 = require("./fillet-size.entity");
const mps_exception_entity_1 = require("./mps-exception.entity");
const chicken_receiving_service_1 = require("./chicken-receiving/chicken-receiving.service");
const weekly_size_entity_1 = require("./chicken-receiving/entities/weekly-size.entity");
const manual_operation_entity_1 = require("./manual-operation.entity");
const stg_erp_item_entity_1 = require("./stg-erp-item.entity");
const master_yield_entity_1 = require("./master-yield.entity");
let MpsController = class MpsController {
    orderLineRepo;
    orderHeaderRepo;
    specRepo;
    mpsPlanRepo;
    mpsDailyRepo;
    mpsOrderRepo;
    mpsSupplyRepo;
    weightDistRepo;
    exceptionRepo;
    filletSizeRepo;
    filletConfigRepo;
    manualOpRepo;
    itemRepo;
    masterYieldRepo;
    mpsSupplySizeRepo;
    weeklySizeRepo;
    chickenReceivingService;
    constructor(orderLineRepo, orderHeaderRepo, specRepo, mpsPlanRepo, mpsDailyRepo, mpsOrderRepo, mpsSupplyRepo, weightDistRepo, exceptionRepo, filletSizeRepo, filletConfigRepo, manualOpRepo, itemRepo, masterYieldRepo, mpsSupplySizeRepo, weeklySizeRepo, chickenReceivingService) {
        this.orderLineRepo = orderLineRepo;
        this.orderHeaderRepo = orderHeaderRepo;
        this.specRepo = specRepo;
        this.mpsPlanRepo = mpsPlanRepo;
        this.mpsDailyRepo = mpsDailyRepo;
        this.mpsOrderRepo = mpsOrderRepo;
        this.mpsSupplyRepo = mpsSupplyRepo;
        this.weightDistRepo = weightDistRepo;
        this.exceptionRepo = exceptionRepo;
        this.filletSizeRepo = filletSizeRepo;
        this.filletConfigRepo = filletConfigRepo;
        this.manualOpRepo = manualOpRepo;
        this.itemRepo = itemRepo;
        this.masterYieldRepo = masterYieldRepo;
        this.mpsSupplySizeRepo = mpsSupplySizeRepo;
        this.weeklySizeRepo = weeklySizeRepo;
        this.chickenReceivingService = chickenReceivingService;
    }
    async getItemCodesByPartType(partType) {
        const categoryMap = {
            'fillet': ['สันใน'],
            'bil': ['BIL L/C'],
        };
        const categoryNames = categoryMap[partType];
        if (!categoryNames)
            return null;
        const allNodes = await this.masterYieldRepo.find();
        const nodeIds = [];
        const collectTree = (parentId) => {
            const children = allNodes.filter(n => n.parentId === parentId);
            for (const child of children) {
                nodeIds.push(child.id);
                collectTree(child.id);
            }
        };
        for (const name of categoryNames) {
            const matches = allNodes.filter(n => n.type === 'CATEGORY' && n.name === name);
            for (const m of matches) {
                nodeIds.push(m.id);
                collectTree(m.id);
            }
        }
        if (nodeIds.length === 0)
            return null;
        const specs = await this.specRepo.find();
        const codes = specs
            .filter(s => s.masterYieldId && nodeIds.includes(s.masterYieldId))
            .map(s => s.erpItemCode);
        return codes.length > 0 ? codes : null;
    }
    async getAllowedItems(partType) {
        const pt = partType || 'fillet';
        const codes = await this.getItemCodesByPartType(pt);
        return { partType: pt, itemCodes: codes || [] };
    }
    async updateDate(body) {
        if (body.planId) {
            const plan = await this.mpsPlanRepo.findOne({ where: { id: body.planId } });
            if (plan && plan.status === 'APPROVED') {
                return { success: false, message: 'Cannot modify an approved plan' };
            }
        }
        if (body.mpsOrderId) {
            const planOrder = await this.mpsOrderRepo.findOne({ where: { id: body.mpsOrderId }, relations: ['mpsPlan'] });
            if (planOrder) {
                if (planOrder.mpsPlan && planOrder.mpsPlan.status === 'APPROVED') {
                    return { success: false, message: 'Cannot modify an approved plan' };
                }
                if (body.splitQty && body.splitQty > 0 && body.splitQty < planOrder.quantityKg) {
                    const remainQty = planOrder.quantityKg - body.splitQty;
                    planOrder.quantityKg = remainQty;
                    await this.mpsOrderRepo.save(planOrder);
                    const splitOrder = this.mpsOrderRepo.create({
                        mpsPlan: planOrder.mpsPlan,
                        erpOrderLineId: planOrder.erpOrderLineId,
                        soNumber: planOrder.soNumber,
                        itemCode: planOrder.itemCode,
                        itemDesc: planOrder.itemDesc,
                        productType: planOrder.productType,
                        quantityKg: body.splitQty,
                        shipDate: planOrder.shipDate,
                        plannedProductionDate: new Date(body.date),
                        finishedProductionDate: planOrder.productType === 'chilled'
                            ? new Date(body.date)
                            : new Date(new Date(body.date).getTime() + 4 * 24 * 60 * 60 * 1000),
                        isManualOverride: true
                    });
                    await this.mpsOrderRepo.save(splitOrder);
                }
                else {
                    const newDate = new Date(body.date);
                    planOrder.plannedProductionDate = newDate;
                    planOrder.finishedProductionDate = planOrder.productType === 'chilled'
                        ? newDate
                        : new Date(newDate.getTime() + 4 * 24 * 60 * 60 * 1000);
                    planOrder.isManualOverride = true;
                    await this.mpsOrderRepo.save(planOrder);
                }
                return { success: true };
            }
        }
        else if (body.planId && body.lineId) {
            const planOrder = await this.mpsOrderRepo.findOne({
                where: { mpsPlan: { id: body.planId }, erpOrderLineId: body.lineId }
            });
            if (planOrder) {
                const newDate = new Date(body.date);
                planOrder.plannedProductionDate = newDate;
                planOrder.finishedProductionDate = planOrder.productType === 'chilled'
                    ? newDate
                    : new Date(newDate.getTime() + 4 * 24 * 60 * 60 * 1000);
                planOrder.isManualOverride = true;
                await this.mpsOrderRepo.save(planOrder);
                const line = await this.orderLineRepo.findOne({ where: { erpOrderLineId: body.lineId } });
                if (line) {
                    const newDate = new Date(body.date);
                    line.plannedProductionDate = newDate;
                    line.finishedProductionDate = planOrder.productType === 'chilled'
                        ? newDate
                        : new Date(newDate.getTime() + 4 * 24 * 60 * 60 * 1000);
                    await this.orderLineRepo.save(line);
                }
                return { success: true };
            }
        }
        const line = await this.orderLineRepo.findOne({ where: { erpOrderLineId: body.lineId } });
        if (line) {
            const newDate = new Date(body.date);
            line.plannedProductionDate = newDate;
            line.finishedProductionDate = newDate;
            await this.orderLineRepo.save(line);
            return { success: true };
        }
        return { success: false, message: 'Line not found' };
    }
    async autoAllocate() {
        const unallocated = await this.orderLineRepo.createQueryBuilder('line')
            .where('line.planned_production_date IS NULL')
            .andWhere('line.erp_order_ship_date IS NOT NULL')
            .getMany();
        const specs = await this.specRepo.find();
        const specMap = new Map();
        specs.forEach(s => specMap.set(s.erpItemCode, s.productType));
        let allocatedCount = 0;
        for (const line of unallocated) {
            const type = specMap.get(line.erpOrderItemCode) || 'chilled';
            const shipDate = new Date(line.erpOrderShipDate);
            const plannedDate = new Date(shipDate);
            if (type === 'chilled') {
                plannedDate.setDate(plannedDate.getDate() - 1);
            }
            else {
                plannedDate.setDate(plannedDate.getDate() - 5);
            }
            line.plannedProductionDate = plannedDate;
            line.finishedProductionDate = type === 'chilled'
                ? plannedDate
                : new Date(plannedDate.getTime() + 4 * 24 * 60 * 60 * 1000);
            await this.orderLineRepo.save(line);
            allocatedCount++;
        }
        return { success: true, allocatedCount };
    }
    async generatePlan(body) {
        const targetMonth = body.targetMonth;
        const partType = body.partType || 'fillet';
        const existingApproved = await this.mpsPlanRepo.findOne({ where: { targetMonth, partType, status: 'APPROVED' } });
        if (existingApproved) {
            return { success: false, message: `An approved plan already exists for ${targetMonth}. Reject it first to regenerate.` };
        }
        let plan = await this.mpsPlanRepo.findOne({ where: { targetMonth, partType, status: 'DRAFT' } });
        if (plan) {
            await this.mpsDailyRepo.delete({ mpsPlan: { id: plan.id } });
            await this.mpsSupplyRepo.delete({ mpsPlan: { id: plan.id } });
            await this.mpsOrderRepo.delete({ mpsPlan: { id: plan.id } });
            await this.exceptionRepo.delete({ mpsPlan: { id: plan.id } });
        }
        else {
            plan = this.mpsPlanRepo.create({
                planName: `MPS ${targetMonth} - Draft`,
                targetMonth,
                partType,
                status: 'DRAFT',
            });
            plan = await this.mpsPlanRepo.save(plan);
        }
        let startOfRange;
        let endOfRange;
        if (body.orderStartDate && body.orderEndDate) {
            startOfRange = new Date(`${body.orderStartDate}T00:00:00`);
            endOfRange = new Date(`${body.orderEndDate}T23:59:59`);
        }
        else {
            const targetDate = new Date(`${targetMonth}-01T00:00:00Z`);
            startOfRange = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1, 0, 0, 0);
            endOfRange = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59);
        }
        const targetDate = new Date(`${targetMonth}-01T00:00:00Z`);
        const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1, 0, 0, 0);
        const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59);
        const orders = await this.orderLineRepo.find({
            where: { erpOrderShipDate: (0, typeorm_2.Between)(startOfRange, endOfRange) }
        });
        const orderHeaders = await this.orderHeaderRepo.find();
        const headerMap = new Map();
        const gradeMap = new Map();
        orderHeaders.forEach(h => {
            headerMap.set(h.erpOrderHeaderId, h.erpOrderNumber);
            gradeMap.set(h.erpOrderHeaderId, h.erpCustomerGrade);
        });
        const specs = await this.specRepo.find();
        const specMap = new Map();
        specs.forEach(s => specMap.set(s.erpItemCode, s));
        const allowedItemCodes = await this.getItemCodesByPartType(partType);
        const formatDate = (date) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };
        const parseLocalDate = (val) => {
            if (!val)
                return null;
            if (val instanceof Date)
                return formatDate(val);
            if (typeof val === 'string')
                return val.split('T')[0];
            return null;
        };
        const subtractDays = (date, days) => {
            const d = new Date(date);
            d.setDate(d.getDate() - days);
            return d;
        };
        const configRow = await this.filletConfigRepo.findOne({ where: { configKey: 'fillet_yield' } });
        const filletYield = configRow ? Number(configRow.configValue) : 0.04;
        const allIntakesRaw = await this.chickenReceivingService.findAll('monthly');
        const prevMonthDate = new Date(targetDate.getFullYear(), targetDate.getMonth() - 1, 1);
        const prevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
        const allIntakesExpanded = allIntakesRaw.filter((intake) => {
            const d = parseLocalDate(intake.receive_date);
            return d && (d.startsWith(targetMonth) || d.startsWith(prevMonth));
        });
        const allIntakes = allIntakesRaw.filter((intake) => {
            const d = parseLocalDate(intake.receive_date);
            return d && d.startsWith(targetMonth);
        });
        const supplyMap = new Map();
        allIntakesExpanded.forEach((intake) => {
            const d = parseLocalDate(intake.receive_date);
            if (d) {
                const intakeKg = Number(intake.chicken_weight || 0);
                const rmFlAvailKg = intakeKg * 0.9575 * 0.95 * filletYield * 0.907;
                supplyMap.set(d, (supplyMap.get(d) || 0) + rmFlAvailKg);
            }
        });
        const chillOrders = [];
        const freezeOrders = [];
        for (const order of orders) {
            const spec = specMap.get(order.erpOrderItemCode);
            if (!spec)
                continue;
            if (allowedItemCodes && !allowedItemCodes.includes(order.erpOrderItemCode))
                continue;
            let adjustedQty = Number(order.erpOrderItemQty || 0);
            if (body._allocatedMap?.has(order.erpOrderLineId)) {
                adjustedQty -= body._allocatedMap.get(order.erpOrderLineId);
                if (adjustedQty <= 0)
                    continue;
            }
            const orderObj = {
                ...order,
                productType: spec.productType,
                qty: adjustedQty,
                shipDate: new Date(order.erpOrderShipDate)
            };
            if (orderObj.productType === 'chilled') {
                chillOrders.push(orderObj);
            }
            else {
                freezeOrders.push(orderObj);
            }
        }
        const gradeWeight = {
            'A+': 1,
            'A': 2,
            'B': 3,
            'C': 4,
            'D': 5,
            'DEFAULT': 6,
            '-': 7
        };
        const getGradeWeight = (line) => {
            const grade = gradeMap.get(line.erpOrderHeaderId) || '';
            return gradeWeight[grade] || 8;
        };
        const prioritySort = (a, b) => {
            const dateDiff = a.shipDate.getTime() - b.shipDate.getTime();
            if (dateDiff !== 0)
                return dateDiff;
            const aGrade = getGradeWeight(a);
            const bGrade = getGradeWeight(b);
            if (aGrade !== bGrade)
                return aGrade - bGrade;
            const soA = headerMap.get(a.erpOrderHeaderId) || a.erpOrderHeaderId?.toString() || '';
            const soB = headerMap.get(b.erpOrderHeaderId) || b.erpOrderHeaderId?.toString() || '';
            const soDiff = soA.localeCompare(soB);
            if (soDiff !== 0)
                return soDiff;
            const aPri = a.priority ?? 9999;
            const bPri = b.priority ?? 9999;
            return aPri - bPri;
        };
        chillOrders.sort(prioritySort);
        freezeOrders.sort(prioritySort);
        const weightMatrix = await this.weightDistRepo.find();
        const filletCalcs = await this.filletSizeRepo.find();
        const filletMap = new Map();
        filletCalcs.forEach(c => {
            if (c.groupName)
                filletMap.set(c.colLabel, c.groupName);
        });
        const uniqueRowLabels = [...new Set(weightMatrix.map(r => r.rowLabel))];
        const uniqueColLabels = [...new Set(weightMatrix.map(r => r.colLabel))];
        console.log(`[MPS DEBUG] weightMatrix total rows: ${weightMatrix.length}`);
        console.log(`[MPS DEBUG] unique rowLabels: ${uniqueRowLabels.length}, unique colLabels: ${uniqueColLabels.length}`);
        console.log(`[MPS DEBUG] expected rows (rowLabels × colLabels): ${uniqueRowLabels.length * uniqueColLabels.length}`);
        const keyCount = new Map();
        weightMatrix.forEach(r => {
            const k = `${r.rowLabel}|${r.colLabel}`;
            keyCount.set(k, (keyCount.get(k) || 0) + 1);
        });
        const duplicates = [...keyCount.entries()].filter(([, cnt]) => cnt > 1);
        if (duplicates.length > 0) {
            console.log(`[MPS DEBUG] ⚠️ DUPLICATE weight_distributions found: ${duplicates.length} keys have duplicates`);
            duplicates.slice(0, 5).forEach(([k, cnt]) => console.log(`  -> ${k} appears ${cnt} times`));
        }
        const rowSums = new Map();
        weightMatrix.forEach(r => {
            rowSums.set(r.rowLabel, (rowSums.get(r.rowLabel) || 0) + Number(r.distValue || 0));
        });
        console.log(`[MPS DEBUG] distValue sums per rowLabel:`);
        rowSums.forEach((sum, label) => console.log(`  ${label}: ${sum.toFixed(4)}`));
        console.log(`[MPS DEBUG] filletMap size: ${filletMap.size}, filletCalcs total: ${filletCalcs.length}`);
        console.log(`[MPS DEBUG] filletYield: ${filletYield}`);
        const sizeSupplyMap = new Map();
        allIntakesExpanded.forEach((intake) => {
            const d = parseLocalDate(intake.receive_date);
            if (!d)
                return;
            const intakeKg = Number(intake.chicken_weight || 0);
            const intakeBirds = Number(intake.chicken_count || 0);
            if (intakeBirds <= 0 || intakeKg <= 0)
                return;
            const avgWeight = parseFloat((intakeKg / intakeBirds).toFixed(2));
            const slaughteredWeight = intakeKg * 0.9575 * 0.95;
            const matchingRows = weightMatrix.filter(row => {
                const label = row.rowLabel;
                if (label.includes('-')) {
                    const parts = label.split('-').map(s => parseFloat(s.trim()));
                    return avgWeight >= parts[0] && avgWeight <= parts[1];
                }
                return Math.abs(Number(label) - avgWeight) < 0.05;
            });
            const existing = sizeSupplyMap.get(d) || {
                total: 0,
                bins: { '40Down': 0, '40_45': 0, '45_50': 0, '50_55': 0, '55_60': 0, '60_65': 0, '65_70': 0, '70Up': 0 }
            };
            matchingRows.forEach(row => {
                const pct = Number(row.distValue || 0);
                if (pct <= 0)
                    return;
                const kg = Math.round(slaughteredWeight * filletYield * (pct / 100) * 0.907);
                const groupName = filletMap.get(row.colLabel);
                if (groupName) {
                    const binKey = groupName.replace(/\s+/g, '').replace(/-/g, '_');
                    let key = binKey;
                    if (key === '40Down')
                        key = '40Down';
                    else if (key === '70Up')
                        key = '70Up';
                    else if (key.includes('_')) { }
                    else { }
                    if (existing.bins[key] !== undefined) {
                        existing.bins[key] += kg;
                    }
                    else if (key === '40Down')
                        existing.bins['40Down'] += kg;
                    else if (key === '40_45')
                        existing.bins['40_45'] += kg;
                    else if (key === '45_50')
                        existing.bins['45_50'] += kg;
                    else if (key === '50_55')
                        existing.bins['50_55'] += kg;
                    else if (key === '55_60')
                        existing.bins['55_60'] += kg;
                    else if (key === '60_65')
                        existing.bins['60_65'] += kg;
                    else if (key === '65_70')
                        existing.bins['65_70'] += kg;
                    else if (key === '70Up')
                        existing.bins['70Up'] += kg;
                }
                existing.total += kg;
            });
            sizeSupplyMap.set(d, existing);
        });
        const originalSizeTotalMap = new Map();
        sizeSupplyMap.forEach((sizeData, dateStr) => {
            const binTotal = Object.values(sizeData.bins).reduce((sum, val) => sum + val, 0);
            if (binTotal > 0) {
                supplyMap.set(dateStr, binTotal);
                originalSizeTotalMap.set(dateStr, binTotal);
            }
        });
        const getSizeBinKeys = (productSize) => {
            if (!productSize)
                return [];
            const s = productSize.toLowerCase().trim();
            if (s === 'unsize' || s === '')
                return [];
            if (s.includes('40 down') || s === '40down')
                return ['40Down'];
            if (s.includes('70 up') || s === '70up' || s.includes('60 up') || s === '60up')
                return ['60_65', '65_70', '70Up'];
            const rangeMatch = s.match(/(\d+)\s*[-–]\s*(\d+)/);
            if (rangeMatch) {
                const lo = parseInt(rangeMatch[1]);
                const hi = parseInt(rangeMatch[2]);
                const allBins = [
                    { key: '40Down', lo: 0, hi: 40 },
                    { key: '40_45', lo: 40, hi: 45 },
                    { key: '45_50', lo: 45, hi: 50 },
                    { key: '50_55', lo: 50, hi: 55 },
                    { key: '55_60', lo: 55, hi: 60 },
                    { key: '60_65', lo: 60, hi: 65 },
                    { key: '65_70', lo: 65, hi: 70 },
                    { key: '70Up', lo: 70, hi: 999 },
                ];
                return allBins.filter(b => b.hi > lo && b.lo < hi).map(b => b.key);
            }
            return [];
        };
        const mpsOrdersToSave = [];
        const exceptionsToSave = [];
        let totalDemandKg = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        for (const order of chillOrders) {
            totalDemandKg += order.qty;
            let remainingQty = order.qty;
            const spec = specMap.get(order.erpOrderItemCode);
            const productSize = spec?.productSize || '';
            const sizeBinKeys = getSizeBinKeys(productSize);
            const isUnsize = sizeBinKeys.length === 0;
            for (let d = subtractDays(order.shipDate, 1); d >= subtractDays(order.shipDate, 3); d = subtractDays(d, 1)) {
                if (remainingQty <= 0)
                    break;
                const dateStr = formatDate(d);
                const totalRmForDate = supplyMap.get(dateStr) || 0;
                if (totalRmForDate <= 0)
                    continue;
                const sizeData = sizeSupplyMap.get(dateStr);
                let availableQty = 0;
                if (!isUnsize && sizeData) {
                    availableQty = sizeBinKeys.reduce((sum, key) => sum + (sizeData.bins[key] || 0), 0);
                }
                else {
                    availableQty = totalRmForDate;
                }
                if (availableQty <= 0)
                    continue;
                const allocQty = Math.round(Math.min(availableQty, remainingQty, totalRmForDate));
                if (allocQty <= 0)
                    continue;
                mpsOrdersToSave.push(this.mpsOrderRepo.create({
                    mpsPlan: plan,
                    erpOrderLineId: order.erpOrderLineId,
                    soNumber: headerMap.get(order.erpOrderHeaderId) || order.erpOrderHeaderId?.toString(),
                    itemCode: order.erpOrderItemCode,
                    itemDesc: specMap.get(order.erpOrderItemCode)?.erpItemDesc || order.erpOrderItemCode,
                    productType: order.productType,
                    quantityKg: allocQty,
                    shipDate: order.shipDate,
                    plannedProductionDate: d,
                    finishedProductionDate: d,
                    isManualOverride: false
                }));
                supplyMap.set(dateStr, totalRmForDate - allocQty);
                if (sizeData) {
                    sizeData.total -= allocQty;
                    if (!isUnsize) {
                        let deductRemaining = allocQty;
                        for (const key of sizeBinKeys) {
                            if (deductRemaining <= 0)
                                break;
                            const binVal = sizeData.bins[key] || 0;
                            const deduct = Math.min(binVal, deductRemaining);
                            sizeData.bins[key] = binVal - deduct;
                            deductRemaining -= deduct;
                        }
                    }
                }
                remainingQty -= allocQty;
            }
            if (remainingQty > 0) {
                exceptionsToSave.push(this.exceptionRepo.create({
                    mpsPlan: plan,
                    erpOrderLineId: order.erpOrderLineId,
                    soNumber: headerMap.get(order.erpOrderHeaderId) || order.erpOrderHeaderId?.toString() || '-',
                    itemCode: order.erpOrderItemCode,
                    shipDate: order.shipDate,
                    requiredKg: order.qty,
                    shortageKg: remainingQty,
                    reason: `No ${isUnsize ? 'total' : productSize} supply available for Chill order on or before ${formatDate(order.shipDate)}`
                }));
            }
        }
        freezeOrders.sort((a, b) => {
            const dateDiff = a.shipDate.getTime() - b.shipDate.getTime();
            if (dateDiff !== 0)
                return dateDiff;
            const aGrade = getGradeWeight(a);
            const bGrade = getGradeWeight(b);
            if (aGrade !== bGrade)
                return aGrade - bGrade;
            const soA = headerMap.get(a.erpOrderHeaderId) || a.erpOrderHeaderId?.toString() || '';
            const soB = headerMap.get(b.erpOrderHeaderId) || b.erpOrderHeaderId?.toString() || '';
            const soDiff = soA.localeCompare(soB);
            if (soDiff !== 0)
                return soDiff;
            const aPri = a.priority ?? 9999;
            const bPri = b.priority ?? 9999;
            return aPri - bPri;
        });
        const addDays = (date, days) => {
            const d = new Date(date);
            d.setDate(d.getDate() + days);
            return d;
        };
        const supplyBufferStart = subtractDays(startOfMonth, 30);
        const allDateStrs = [];
        for (let d = new Date(supplyBufferStart); d <= endOfMonth; d = addDays(d, 1)) {
            allDateStrs.push(formatDate(d));
        }
        const allocateFreeze = (orderList, useSizeMatch) => {
            for (const order of orderList) {
                totalDemandKg += order.qty;
                let remainingQty = order.qty;
                const spec = specMap.get(order.erpOrderItemCode);
                const productSize = spec?.productSize || '';
                const sizeBinKeys = getSizeBinKeys(productSize);
                const isUnsize = sizeBinKeys.length === 0;
                const latestProdDate = subtractDays(order.shipDate, 5);
                const earliestProdDate = subtractDays(order.shipDate, 30);
                for (const dateStr of allDateStrs) {
                    if (remainingQty <= 0)
                        break;
                    const dateObj = new Date(dateStr + 'T00:00:00');
                    if (dateObj < earliestProdDate || dateObj > latestProdDate)
                        continue;
                    const totalRmForDate = supplyMap.get(dateStr) || 0;
                    if (totalRmForDate <= 0)
                        continue;
                    const sizeData = sizeSupplyMap.get(dateStr);
                    let availableQty = 0;
                    if (useSizeMatch && !isUnsize && sizeData) {
                        availableQty = sizeBinKeys.reduce((sum, key) => sum + (sizeData.bins[key] || 0), 0);
                    }
                    else {
                        availableQty = totalRmForDate;
                    }
                    if (availableQty <= 0)
                        continue;
                    const allocQty = Math.round(Math.min(availableQty, remainingQty, totalRmForDate));
                    if (allocQty <= 0)
                        continue;
                    mpsOrdersToSave.push(this.mpsOrderRepo.create({
                        mpsPlan: plan,
                        erpOrderLineId: order.erpOrderLineId,
                        soNumber: headerMap.get(order.erpOrderHeaderId) || order.erpOrderHeaderId?.toString(),
                        itemCode: order.erpOrderItemCode,
                        itemDesc: specMap.get(order.erpOrderItemCode)?.erpItemDesc || order.erpOrderItemCode,
                        productType: order.productType,
                        quantityKg: allocQty,
                        shipDate: order.shipDate,
                        plannedProductionDate: dateObj,
                        finishedProductionDate: new Date(dateObj.getTime() + 4 * 24 * 60 * 60 * 1000),
                        isManualOverride: false
                    }));
                    supplyMap.set(dateStr, totalRmForDate - allocQty);
                    if (sizeData) {
                        sizeData.total -= allocQty;
                        if (useSizeMatch && !isUnsize) {
                            let deductRemaining = allocQty;
                            for (const key of sizeBinKeys) {
                                if (deductRemaining <= 0)
                                    break;
                                const binVal = sizeData.bins[key] || 0;
                                const deduct = Math.min(binVal, deductRemaining);
                                sizeData.bins[key] = binVal - deduct;
                                deductRemaining -= deduct;
                            }
                        }
                    }
                    remainingQty -= allocQty;
                }
                if (remainingQty > 0) {
                    exceptionsToSave.push(this.exceptionRepo.create({
                        mpsPlan: plan,
                        erpOrderLineId: order.erpOrderLineId,
                        soNumber: headerMap.get(order.erpOrderHeaderId) || order.erpOrderHeaderId?.toString() || '-',
                        itemCode: order.erpOrderItemCode,
                        shipDate: order.shipDate,
                        requiredKg: order.qty,
                        shortageKg: remainingQty,
                        reason: `Insufficient ${isUnsize ? 'total' : productSize} supply for Freeze order (Ship: ${formatDate(order.shipDate)})`
                    }));
                }
            }
        };
        allocateFreeze(freezeOrders, true);
        await this.mpsOrderRepo.save(mpsOrdersToSave, { chunk: 100 });
        if (exceptionsToSave.length > 0) {
            await this.exceptionRepo.save(exceptionsToSave, { chunk: 100 });
        }
        const mpsDailiesToSave = [];
        let totalIntakeBirds = 0;
        let totalRmFlKg = 0;
        const dailyDemand = new Map();
        const dailyStaff = new Map();
        mpsOrdersToSave.forEach(o => {
            const d = formatDate(o.plannedProductionDate);
            dailyDemand.set(d, (dailyDemand.get(d) || 0) + Number(o.quantityKg));
            const spec = specMap.get(o.itemCode);
            const speed = Number(spec?.productSpeed || 45);
            dailyStaff.set(d, (dailyStaff.get(d) || 0) + (Number(o.quantityKg) / speed));
        });
        const daysInMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
            const dayStr = `${targetMonth}-${i.toString().padStart(2, '0')}`;
            let intakeBirds = 0;
            let originalSupplyKg = 0;
            allIntakes.forEach((intake) => {
                const d = parseLocalDate(intake.receive_date);
                if (d === dayStr) {
                    intakeBirds += Number(intake.chicken_count || 0);
                }
            });
            originalSupplyKg = originalSizeTotalMap.get(dayStr) || 0;
            const demand = dailyDemand.get(dayStr) || 0;
            totalIntakeBirds += intakeBirds;
            totalRmFlKg += originalSupplyKg;
            const cuttingStaff = demand > 0 ? (dailyStaff.get(dayStr) || 0) / 10 : 0;
            const supportStaff = demand > 0 ? 28 : 0;
            mpsDailiesToSave.push(this.mpsDailyRepo.create({
                mpsPlan: plan,
                productionDate: new Date(dayStr),
                intakeBirds: intakeBirds,
                rmFlAvailKg: originalSupplyKg,
                demandKg: demand,
                cuttingStaff: Math.ceil(cuttingStaff),
                supportStaff,
                totalStaff: Math.ceil(cuttingStaff + supportStaff)
            }));
        }
        await this.mpsDailyRepo.save(mpsDailiesToSave, { chunk: 100 });
        const mpsSuppliesToSave = [];
        const partNameMap = {
            'fillet': 'สันใน',
            'bil': 'BIL L/C',
        };
        const currentPartName = partNameMap[partType] || partType;
        for (let i = 1; i <= daysInMonth; i++) {
            const dayStr = `${targetMonth}-${i.toString().padStart(2, '0')}`;
            let dailyIntakeBirds = 0;
            let dailyTotalWeight = 0;
            const dayIntakes = [];
            allIntakes.forEach((intake) => {
                const d = parseLocalDate(intake.receive_date);
                if (d === dayStr) {
                    dailyIntakeBirds += Number(intake.chicken_count || 0);
                    dailyTotalWeight += Number(intake.chicken_weight || 0);
                    dayIntakes.push(intake);
                }
            });
            if (dailyIntakeBirds > 0) {
                const avgWeightDaily = parseFloat((dailyTotalWeight / dailyIntakeBirds).toFixed(2));
                const slaughteredWeightDaily = dailyTotalWeight * 0.9575 * 0.95;
                const supplyEntry = this.mpsSupplyRepo.create({
                    mpsPlan: plan,
                    productionDate: new Date(dayStr),
                    intakeBirds: dailyIntakeBirds,
                    totalWeight: dailyTotalWeight,
                    avgWeight: parseFloat(avgWeightDaily.toFixed(2)),
                    slaughteredWeight: slaughteredWeightDaily,
                });
                const sizeBins = {};
                dayIntakes.forEach((intake) => {
                    const intakeKg = Number(intake.chicken_weight || 0);
                    const intakeBirds = Number(intake.chicken_count || 0);
                    if (intakeBirds <= 0 || intakeKg <= 0)
                        return;
                    const avgWeight = parseFloat((intakeKg / intakeBirds).toFixed(2));
                    const slaughteredWeight = intakeKg * 0.9575 * 0.95;
                    const matchingRows = weightMatrix.filter(row => {
                        const label = row.rowLabel;
                        if (label.includes('-')) {
                            const parts = label.split('-').map(s => parseFloat(s.trim()));
                            return avgWeight >= parts[0] && avgWeight <= parts[1];
                        }
                        return Math.abs(Number(label) - avgWeight) < 0.05;
                    });
                    matchingRows.forEach(row => {
                        const pct = Number(row.distValue || 0);
                        if (pct <= 0)
                            return;
                        const kg = Math.round(slaughteredWeight * filletYield * (pct / 100) * 0.907);
                        const groupName = filletMap.get(row.colLabel);
                        if (groupName) {
                            sizeBins[groupName] = (sizeBins[groupName] || 0) + kg;
                        }
                    });
                });
                const sizeEntries = [];
                for (const [groupName, kg] of Object.entries(sizeBins)) {
                    if (kg <= 0)
                        continue;
                    sizeEntries.push(this.mpsSupplySizeRepo.create({
                        groupSize: groupName,
                        partName: currentPartName,
                        quantityKg: Math.round(kg),
                        productionDate: new Date(dayStr),
                    }));
                }
                supplyEntry.sizes = sizeEntries;
                mpsSuppliesToSave.push(supplyEntry);
            }
        }
        if (mpsSuppliesToSave.length > 0) {
            await this.mpsSupplyRepo.save(mpsSuppliesToSave, { chunk: 100 });
        }
        plan.totalIntakeBirds = totalIntakeBirds;
        plan.totalRmFlKg = totalRmFlKg;
        plan.totalDemandKg = totalDemandKg;
        await this.mpsPlanRepo.save(plan);
        return { success: true, planId: plan.id, status: plan.status };
    }
    async generateRange(body) {
        const { orderStartDate, orderEndDate } = body;
        const partType = body.partType || 'fillet';
        if (!orderStartDate || !orderEndDate) {
            return { success: false, message: 'orderStartDate and orderEndDate are required' };
        }
        const start = new Date(`${orderStartDate}T00:00:00`);
        const end = new Date(`${orderEndDate}T23:59:59`);
        const months = [];
        const current = new Date(start.getFullYear(), start.getMonth(), 1);
        while (current <= end) {
            const monthStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
            months.push(monthStr);
            current.setMonth(current.getMonth() + 1);
        }
        const allocatedMap = new Map();
        const results = [];
        for (const month of months) {
            const result = await this.generatePlan({
                targetMonth: month,
                orderStartDate: body.orderStartDate,
                orderEndDate: body.orderEndDate,
                partType,
                _allocatedMap: new Map(allocatedMap),
            });
            if (result.success && result.planId) {
                const planOrders = await this.mpsOrderRepo.find({
                    where: { mpsPlan: { id: result.planId } }
                });
                for (const po of planOrders) {
                    const prev = allocatedMap.get(po.erpOrderLineId) || 0;
                    allocatedMap.set(po.erpOrderLineId, prev + Number(po.quantityKg));
                }
            }
            results.push({ targetMonth: month, ...result });
        }
        return { success: true, results };
    }
    async getPlans(partType) {
        return this.mpsPlanRepo.find({
            where: { partType: partType || 'fillet' },
            order: {
                createdAt: 'DESC'
            }
        });
    }
    async deletePlan(body, id) {
        const plan = await this.mpsPlanRepo.findOne({ where: { id } });
        if (!plan)
            return { success: false, message: 'Plan not found' };
        if (plan.status === 'APPROVED') {
            return { success: false, message: 'Cannot delete an approved plan. Reject it first.' };
        }
        await this.mpsPlanRepo.remove(plan);
        return { success: true };
    }
    async getWeeklySizesForPlan(id) {
        const plan = await this.mpsPlanRepo.findOne({ where: { id } });
        if (!plan)
            return { success: false, message: 'Plan not found' };
        const targetMonth = plan.targetMonth;
        const partType = plan.partType;
        const partNameMap = { 'fillet': 'สันใน', 'bil': 'BIL L/C' };
        const currentPartName = partNameMap[partType] || partType;
        const allSizes = await this.weeklySizeRepo.find({ where: { partName: currentPartName } });
        const monthSizes = allSizes.filter(s => {
            const recDate = s.receiveDate;
            const dStr = typeof recDate === 'string' ? recDate.split('T')[0] : recDate.toISOString().split('T')[0];
            return dStr.startsWith(targetMonth);
        });
        return { success: true, data: monthSizes };
    }
    async importWeeklyForPlan(id) {
        const plan = await this.mpsPlanRepo.findOne({ where: { id } });
        if (!plan)
            return { success: false, message: 'Plan not found' };
        const targetMonth = plan.targetMonth;
        const partType = plan.partType;
        const allIntakesRaw = await this.chickenReceivingService.findAll('weekly');
        const targetIntakes = allIntakesRaw.filter((intake) => {
            const d = typeof intake.receive_date === 'string' ? intake.receive_date.split('T')[0] : intake.receive_date.toISOString().split('T')[0];
            return d.startsWith(targetMonth);
        });
        const weightMatrix = await this.weightDistRepo.find();
        const filletCalcs = await this.filletSizeRepo.find();
        const filletMap = new Map();
        filletCalcs.forEach(c => {
            if (c.groupName)
                filletMap.set(c.colLabel, c.groupName);
        });
        const configRow = await this.filletConfigRepo.findOne({ where: { configKey: 'fillet_yield' } });
        const filletYield = configRow ? Number(configRow.configValue) : 0.04;
        const partNameMap = { 'fillet': 'สันใน', 'bil': 'BIL L/C' };
        const currentPartName = partNameMap[partType] || partType;
        const existingSizes = await this.weeklySizeRepo.find({ where: { partName: currentPartName } });
        const toRemove = existingSizes.filter(s => {
            const recDate = s.receiveDate;
            const dStr = typeof recDate === 'string' ? recDate.split('T')[0] : recDate.toISOString().split('T')[0];
            return dStr.startsWith(targetMonth);
        });
        if (toRemove.length > 0) {
            await this.weeklySizeRepo.remove(toRemove);
        }
        const sizesToSave = [];
        const dailyGroups = new Map();
        targetIntakes.forEach(intake => {
            const dStr = typeof intake.receive_date === 'string' ? intake.receive_date.split('T')[0] : intake.receive_date.toISOString().split('T')[0];
            if (!dailyGroups.has(dStr))
                dailyGroups.set(dStr, []);
            dailyGroups.get(dStr).push(intake);
        });
        for (const [dayStr, dayIntakes] of dailyGroups.entries()) {
            const sizeBins = {};
            dayIntakes.forEach((intake) => {
                const intakeKg = Number(intake.chicken_weight || 0);
                const intakeBirds = Number(intake.chicken_count || 0);
                if (intakeBirds <= 0 || intakeKg <= 0)
                    return;
                const avgWeight = parseFloat((intakeKg / intakeBirds).toFixed(2));
                const slaughteredWeight = intakeKg * 0.9575 * 0.95;
                const matchingRows = weightMatrix.filter(row => {
                    const label = row.rowLabel;
                    if (label.includes('-')) {
                        const parts = label.split('-').map(s => parseFloat(s.trim()));
                        return avgWeight >= parts[0] && avgWeight <= parts[1];
                    }
                    return Math.abs(Number(label) - avgWeight) < 0.05;
                });
                matchingRows.forEach(row => {
                    const pct = Number(row.distValue || 0);
                    if (pct <= 0)
                        return;
                    const kg = Math.round(slaughteredWeight * filletYield * (pct / 100) * 0.907);
                    const groupName = filletMap.get(row.colLabel);
                    if (groupName) {
                        sizeBins[groupName] = (sizeBins[groupName] || 0) + kg;
                    }
                });
            });
            for (const [groupName, kg] of Object.entries(sizeBins)) {
                if (kg <= 0)
                    continue;
                sizesToSave.push(this.weeklySizeRepo.create({
                    receiveDate: new Date(dayStr),
                    groupSize: groupName,
                    partName: currentPartName,
                    quantityKg: Math.round(kg)
                }));
            }
        }
        if (sizesToSave.length > 0) {
            await this.weeklySizeRepo.save(sizesToSave, { chunk: 100 });
        }
        return { success: true, count: sizesToSave.length };
    }
    async getPlan(id) {
        const plan = await this.mpsPlanRepo.findOne({
            where: { id },
            relations: ['dailySummaries', 'exceptions', 'supplyBreakdown', 'supplyBreakdown.sizes']
        });
        if (!plan) {
            return { success: false, message: 'Plan not found' };
        }
        const orders = await this.mpsOrderRepo.find({
            where: { mpsPlan: { id: plan.id } }
        });
        plan.orders = orders;
        if (plan.dailySummaries)
            plan.dailySummaries.forEach(d => delete d.mpsPlan);
        if (plan.supplyBreakdown)
            plan.supplyBreakdown.forEach(s => {
                delete s.mpsPlan;
                if (s.sizes)
                    s.sizes.forEach(sz => delete sz.mpsPlanSupply);
            });
        if (plan.exceptions)
            plan.exceptions.forEach(e => delete e.mpsPlan);
        return { success: true, data: plan };
    }
    async approvePlan(id) {
        const plan = await this.mpsPlanRepo.findOne({ where: { id } });
        if (!plan)
            return { success: false, message: 'Plan not found' };
        if (plan.status === 'APPROVED')
            return { success: false, message: 'Plan is already approved' };
        plan.status = 'APPROVED';
        await this.mpsPlanRepo.save(plan);
        return { success: true, message: 'Plan approved and locked' };
    }
    async rejectPlan(id) {
        const plan = await this.mpsPlanRepo.findOne({ where: { id } });
        if (!plan)
            return { success: false, message: 'Plan not found' };
        plan.status = 'DRAFT';
        await this.mpsPlanRepo.save(plan);
        return { success: true, message: 'Plan reverted to draft' };
    }
    async getApprovedOrdersForDate(date) {
        const orders = await this.mpsOrderRepo.createQueryBuilder('order')
            .leftJoinAndSelect('order.mpsPlan', 'plan')
            .leftJoin('stg_erp_order_lines', 'sol', 'sol.erp_order_line_id = order.erp_order_line_id')
            .addSelect('sol.priority', 'priority')
            .where('plan.status = :status', { status: 'APPROVED' })
            .andWhere('order.planned_production_date = :date', { date })
            .getRawAndEntities();
        const merged = orders.entities.map((order, idx) => {
            return {
                ...order,
                priority: orders.raw[idx].priority
            };
        });
        return merged;
    }
    async updatePriorities(body) {
        if (!body.priorities || !Array.isArray(body.priorities)) {
            return { success: false, message: 'Invalid input' };
        }
        for (const item of body.priorities) {
            await this.orderLineRepo.update({ erpOrderLineId: item.lineId }, { priority: item.priority === null ? undefined : item.priority });
        }
        return { success: true, updated: body.priorities.length };
    }
    async exportPlan(id, res) {
        const plan = await this.mpsPlanRepo.findOne({
            where: { id },
            relations: ['dailySummaries', 'exceptions', 'supplyBreakdown', 'supplyBreakdown.sizes']
        });
        if (!plan)
            return res.status(404).json({ success: false, message: 'Plan not found' });
        const orders = await this.mpsOrderRepo.find({
            where: { mpsPlan: { id: plan.id } },
        });
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Fillet MPS Plan');
        const headers = await this.orderHeaderRepo.find();
        const gradeMap = new Map();
        headers.forEach(h => {
            if (h.erpOrderNumber)
                gradeMap.set(h.erpOrderNumber, h.erpCustomerGrade);
        });
        const dailyMap = new Map();
        plan.dailySummaries.sort((a, b) => new Date(a.productionDate).getTime() - new Date(b.productionDate).getTime()).forEach(d => {
            dailyMap.set(new Date(d.productionDate).toISOString().split('T')[0], { summary: d, orders: new Map(), supply: null });
        });
        plan.supplyBreakdown.forEach(s => {
            const dateKey = new Date(s.productionDate).toISOString().split('T')[0];
            if (dailyMap.has(dateKey)) {
                dailyMap.get(dateKey).supply = s;
            }
        });
        const [year, month] = plan.targetMonth.split('-').map(Number);
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        const manualOps = await this.manualOpRepo.find({
            where: {
                productionDate: (0, typeorm_2.Between)(startDate, endDate)
            }
        });
        const manualOpMap = new Map();
        manualOps.forEach(op => {
            const dateKey = new Date(op.productionDate).toISOString().split('T')[0];
            manualOpMap.set(dateKey, op);
        });
        const erpItems = await this.itemRepo.find();
        const itemDescMap = new Map();
        erpItems.forEach(i => {
            if (i.erpItemCode)
                itemDescMap.set(i.erpItemCode, i.erpItemDesc);
        });
        const specs = await this.specRepo.find();
        const specMap = new Map();
        specs.forEach(s => specMap.set(s.erpItemCode, itemDescMap.get(s.erpItemCode) || s.erpItemDesc));
        const itemMap = new Map();
        orders.forEach(o => itemMap.set(o.itemCode, specMap.get(o.itemCode) || o.itemDesc));
        const itemCodes = Array.from(itemMap.keys()).sort();
        orders.forEach(o => {
            const dateKey = new Date(o.plannedProductionDate).toISOString().split('T')[0];
            if (dailyMap.has(dateKey)) {
                const d = dailyMap.get(dateKey);
                d.orders.set(o.itemCode, (d.orders.get(o.itemCode) || 0) + o.quantityKg);
            }
        });
        const dates = Array.from(dailyMap.keys());
        const sectionRow = sheet.addRow([]);
        sectionRow.getCell(1).value = 'Supply Control';
        sheet.mergeCells(1, 1, 1, 6);
        sectionRow.getCell(7).value = 'Manpower & Execution';
        sheet.mergeCells(1, 7, 1, 11);
        sectionRow.getCell(12).value = 'RM FL by Size';
        sheet.mergeCells(1, 12, 1, 19);
        sectionRow.getCell(20).value = 'Production Plan';
        sheet.mergeCells(1, 20, 1, 20 + itemCodes.length - 1);
        [
            { start: 1, end: 6, color: 'FF4472C4' },
            { start: 7, end: 11, color: 'FF70AD47' },
            { start: 12, end: 19, color: 'FFED7D31' },
            { start: 20, end: 20 + itemCodes.length - 1, color: 'FF7030A0' }
        ].forEach(sec => {
            for (let i = sec.start; i <= sec.end; i++) {
                const cell = sectionRow.getCell(i);
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sec.color } };
                cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
                cell.alignment = { horizontal: 'center' };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            }
        });
        const descRowData = new Array(19).fill('');
        itemCodes.forEach(code => descRowData.push(itemMap.get(code) || ''));
        const descRow = sheet.addRow(descRowData);
        descRow.eachCell((cell, colNumber) => {
            if (colNumber >= 20) {
                cell.font = { bold: true, size: 8 };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
                cell.alignment = { horizontal: 'center', wrapText: true };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            }
        });
        descRow.height = 30;
        const subHeaders = [
            'Date', 'Day', 'Avg. Wt', 'RM FL Total', 'RM Used (Demand)', 'RM Balance',
            'Cut (P)', 'Sup (P)', 'Cut (A)', 'Sup (A)', 'Variance',
            '40 down', '40 45', '45 50', '50 55', '55 60', '60 65', '65 70', '70 up',
            ...itemCodes
        ];
        const headerRow = sheet.addRow(subHeaders);
        headerRow.eachCell((cell, colNumber) => {
            cell.font = { bold: true, size: 9 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
        dates.forEach(dateStr => {
            const d = dailyMap.get(dateStr);
            const s = d.summary;
            const supply = d.supply;
            const dateObj = new Date(dateStr);
            const isNoSupply = !s.intakeBirds || s.intakeBirds === 0;
            const manualOp = manualOpMap.get(dateStr);
            const actualCut = manualOp?.actualCuttingWorkers || 0;
            const actualSup = manualOp?.actualStationWorkers || 0;
            const plannedCut = s.cuttingStaff;
            const plannedSup = manualOp?.plannedStationWorkers || s.supportStaff;
            const variance = (actualCut + actualSup) - (plannedCut + plannedSup);
            const getSizeKg = (sizeArr, groupSize) => {
                if (!sizeArr)
                    return 0;
                return sizeArr
                    .filter((sz) => sz.groupSize === groupSize)
                    .reduce((sum, sz) => sum + Number(sz.quantityKg || 0), 0);
            };
            const rowData = [
                dateStr,
                dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
                supply?.avgWeight || '-',
                Math.round(s.rmFlAvailKg),
                Math.round(s.demandKg),
                Math.round(s.rmFlAvailKg - s.demandKg),
                plannedCut,
                plannedSup,
                actualCut,
                actualSup,
                variance,
                Math.round(getSizeKg(supply?.sizes, '40 Down')),
                Math.round(getSizeKg(supply?.sizes, '40-45')),
                Math.round(getSizeKg(supply?.sizes, '45-50')),
                Math.round(getSizeKg(supply?.sizes, '50-55')),
                Math.round(getSizeKg(supply?.sizes, '55-60')),
                Math.round(getSizeKg(supply?.sizes, '60-65')),
                Math.round(getSizeKg(supply?.sizes, '65-70')),
                Math.round(getSizeKg(supply?.sizes, '70 Up')),
                ...itemCodes.map(code => d.orders.has(code) ? Math.round(d.orders.get(code)) : '-')
            ];
            const r = sheet.addRow(rowData);
            r.eachCell((cell, colNumber) => {
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                cell.font = { size: 9 };
                if (isNoSupply) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' } };
                    cell.font = { color: { argb: 'FF999999' }, size: 9 };
                }
                else if (colNumber === 11) {
                    if (variance > 0) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
                        cell.font = { color: { argb: 'FF006100' }, bold: true, size: 9 };
                    }
                    else if (variance < 0) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
                        cell.font = { color: { argb: 'FF9C0006' }, bold: true, size: 9 };
                    }
                }
                else if (colNumber >= 20 && cell.value !== '-') {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
                    cell.font = { color: { argb: 'FF375623' }, bold: true, size: 9 };
                }
            });
        });
        sheet.getColumn(1).width = 12;
        sheet.getColumn(2).width = 8;
        sheet.getColumn(4).width = 15;
        sheet.getColumn(5).width = 15;
        sheet.getColumn(6).width = 15;
        for (let i = 20; i <= 20 + itemCodes.length; i++) {
            sheet.getColumn(i).width = 15;
        }
        sheet.views = [{ state: 'frozen', xSplit: 6, ySplit: 3 }];
        const demandSheet = workbook.addWorksheet('Demand Plan');
        demandSheet.columns = [
            { header: 'SO Number', key: 'so', width: 15 },
            { header: 'Grade', key: 'grade', width: 10 },
            { header: 'Item Code', key: 'code', width: 15 },
            { header: 'Item Description', key: 'desc', width: 40 },
            { header: 'Type', key: 'type', width: 12 },
            { header: 'Qty (KG)', key: 'qty', width: 15 },
            { header: 'Ship Date', key: 'ship', width: 15 },
            { header: 'Planned Prod', key: 'planned', width: 15 },
            { header: 'Finished Prod', key: 'finished', width: 15 },
            { header: 'Method', key: 'method', width: 12 }
        ];
        const dHeaderRow = demandSheet.getRow(1);
        dHeaderRow.height = 30;
        dHeaderRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
            cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
        const sortedOrders = [...orders].sort((a, b) => {
            const dateA = new Date(a.plannedProductionDate).getTime();
            const dateB = new Date(b.plannedProductionDate).getTime();
            if (dateA !== dateB)
                return dateA - dateB;
            return (a.soNumber || '').localeCompare(b.soNumber || '');
        });
        sortedOrders.forEach((o, idx) => {
            const row = demandSheet.addRow({
                so: o.soNumber,
                grade: gradeMap.get(o.soNumber) || '-',
                code: o.itemCode,
                desc: specMap.get(o.itemCode) || o.itemDesc || '-',
                type: o.productType?.toUpperCase(),
                qty: Math.round(Number(o.quantityKg)),
                ship: new Date(o.shipDate).toLocaleDateString('en-GB'),
                planned: new Date(o.plannedProductionDate).toLocaleDateString('en-GB'),
                finished: o.finishedProductionDate ? new Date(o.finishedProductionDate).toLocaleDateString('en-GB') : '-',
                method: o.isManualOverride ? 'Manual' : 'Auto'
            });
            row.eachCell((cell, colNum) => {
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                cell.font = { size: 10 };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                if (colNum === 4)
                    cell.alignment.horizontal = 'left';
                if (idx % 2 === 1) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };
                }
            });
            const typeCell = row.getCell(5);
            if (o.productType?.toLowerCase() === 'chilled') {
                typeCell.font = { color: { argb: 'FFC0504D' }, bold: true, size: 10 };
            }
            else {
                typeCell.font = { color: { argb: 'FF4F81BD' }, bold: true, size: 10 };
            }
        });
        demandSheet.views = [{ state: 'frozen', ySplit: 1 }];
        const exceptionSheet = workbook.addWorksheet('Unfulfilled Orders');
        exceptionSheet.columns = [
            { header: 'SO Number', key: 'so', width: 15 },
            { header: 'Item Code', key: 'code', width: 15 },
            { header: 'Item Description', key: 'desc', width: 40 },
            { header: 'Ship Date', key: 'ship', width: 15 },
            { header: 'Required Qty', key: 'req', width: 15 },
            { header: 'Shortage Qty', key: 'short', width: 15 },
            { header: 'Reason', key: 'reason', width: 50 }
        ];
        const exHeaderRow = exceptionSheet.getRow(1);
        exHeaderRow.height = 30;
        exHeaderRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC0504D' } };
            cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
        plan.exceptions.sort((a, b) => new Date(a.shipDate).getTime() - new Date(b.shipDate).getTime()).forEach((ex, idx) => {
            const row = exceptionSheet.addRow({
                so: ex.soNumber,
                code: ex.itemCode,
                desc: itemDescMap.get(ex.itemCode) || '-',
                ship: new Date(ex.shipDate).toLocaleDateString('en-GB'),
                req: Math.round(Number(ex.requiredKg)),
                short: Math.round(Number(ex.shortageKg)),
                reason: ex.reason
            });
            row.eachCell((cell, colNum) => {
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                cell.font = { size: 10 };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                if (colNum === 3 || colNum === 7)
                    cell.alignment.horizontal = 'left';
                if (idx % 2 === 1) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };
                }
            });
            row.getCell(6).font = { color: { argb: 'FFC0504D' }, bold: true, size: 10 };
        });
        exceptionSheet.views = [{ state: 'frozen', ySplit: 1 }];
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=MPS_Plan_${plan.targetMonth}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    }
};
exports.MpsController = MpsController;
__decorate([
    (0, common_1.Get)('allowed-items'),
    __param(0, (0, common_1.Query)('partType')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MpsController.prototype, "getAllowedItems", null);
__decorate([
    (0, common_1.Post)('update-date'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MpsController.prototype, "updateDate", null);
__decorate([
    (0, common_1.Post)('auto-allocate'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MpsController.prototype, "autoAllocate", null);
__decorate([
    (0, common_1.Post)('generate'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MpsController.prototype, "generatePlan", null);
__decorate([
    (0, common_1.Post)('generate-range'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MpsController.prototype, "generateRange", null);
__decorate([
    (0, common_1.Get)('plans'),
    __param(0, (0, common_1.Query)('partType')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MpsController.prototype, "getPlans", null);
__decorate([
    (0, common_1.Post)('plans/:id/delete'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], MpsController.prototype, "deletePlan", null);
__decorate([
    (0, common_1.Get)('plans/:id/weekly-sizes'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], MpsController.prototype, "getWeeklySizesForPlan", null);
__decorate([
    (0, common_1.Post)('plans/:id/import-weekly'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], MpsController.prototype, "importWeeklyForPlan", null);
__decorate([
    (0, common_1.Get)('plans/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], MpsController.prototype, "getPlan", null);
__decorate([
    (0, common_1.Post)('plans/:id/approve'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], MpsController.prototype, "approvePlan", null);
__decorate([
    (0, common_1.Post)('plans/:id/reject'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], MpsController.prototype, "rejectPlan", null);
__decorate([
    (0, common_1.Get)('approved-orders/:date'),
    __param(0, (0, common_1.Param)('date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MpsController.prototype, "getApprovedOrdersForDate", null);
__decorate([
    (0, common_1.Post)('update-priorities'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MpsController.prototype, "updatePriorities", null);
__decorate([
    (0, common_1.Get)('plans/:id/export'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], MpsController.prototype, "exportPlan", null);
exports.MpsController = MpsController = __decorate([
    (0, common_1.Controller)('api/mps'),
    __param(0, (0, typeorm_1.InjectRepository)(stg_erp_order_line_entity_1.StgErpOrderLine)),
    __param(1, (0, typeorm_1.InjectRepository)(stg_erp_order_header_entity_1.StgErpOrderHeader)),
    __param(2, (0, typeorm_1.InjectRepository)(product_spec_entity_1.ProductSpec)),
    __param(3, (0, typeorm_1.InjectRepository)(mps_plan_entity_1.MpsPlan)),
    __param(4, (0, typeorm_1.InjectRepository)(mps_plan_entity_1.MpsPlanDaily)),
    __param(5, (0, typeorm_1.InjectRepository)(mps_plan_entity_1.MpsPlanOrder)),
    __param(6, (0, typeorm_1.InjectRepository)(mps_plan_supply_entity_1.MpsPlanSupply)),
    __param(7, (0, typeorm_1.InjectRepository)(weight_distribution_entity_1.WeightDistribution)),
    __param(8, (0, typeorm_1.InjectRepository)(mps_exception_entity_1.MpsExceptionReport)),
    __param(9, (0, typeorm_1.InjectRepository)(fillet_size_entity_1.FilletSizeCalc)),
    __param(10, (0, typeorm_1.InjectRepository)(fillet_size_entity_1.FilletConfig)),
    __param(11, (0, typeorm_1.InjectRepository)(manual_operation_entity_1.ManualOperation)),
    __param(12, (0, typeorm_1.InjectRepository)(stg_erp_item_entity_1.StgErpItem)),
    __param(13, (0, typeorm_1.InjectRepository)(master_yield_entity_1.MasterYield)),
    __param(14, (0, typeorm_1.InjectRepository)(mps_plan_supply_size_entity_1.MpsPlanSupplySize)),
    __param(15, (0, typeorm_1.InjectRepository)(weekly_size_entity_1.ChickenReceivingWeeklySize)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        chicken_receiving_service_1.ChickenReceivingService])
], MpsController);
//# sourceMappingURL=mps.controller.js.map