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
exports.MpsController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const stg_erp_order_line_entity_1 = require("./stg-erp-order-line.entity");
const stg_erp_order_header_entity_1 = require("./stg-erp-order-header.entity");
const product_spec_entity_1 = require("./product-spec.entity");
const mps_plan_entity_1 = require("./mps-plan.entity");
const mps_plan_supply_entity_1 = require("./mps-plan-supply.entity");
const weight_distribution_entity_1 = require("./weight-distribution.entity");
const mps_exception_entity_1 = require("./mps-exception.entity");
const chicken_receiving_service_1 = require("./chicken-receiving/chicken-receiving.service");
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
    chickenReceivingService;
    constructor(orderLineRepo, orderHeaderRepo, specRepo, mpsPlanRepo, mpsDailyRepo, mpsOrderRepo, mpsSupplyRepo, weightDistRepo, exceptionRepo, chickenReceivingService) {
        this.orderLineRepo = orderLineRepo;
        this.orderHeaderRepo = orderHeaderRepo;
        this.specRepo = specRepo;
        this.mpsPlanRepo = mpsPlanRepo;
        this.mpsDailyRepo = mpsDailyRepo;
        this.mpsOrderRepo = mpsOrderRepo;
        this.mpsSupplyRepo = mpsSupplyRepo;
        this.weightDistRepo = weightDistRepo;
        this.exceptionRepo = exceptionRepo;
        this.chickenReceivingService = chickenReceivingService;
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
                        isManualOverride: true
                    });
                    await this.mpsOrderRepo.save(splitOrder);
                }
                else {
                    planOrder.plannedProductionDate = new Date(body.date);
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
                planOrder.plannedProductionDate = new Date(body.date);
                planOrder.isManualOverride = true;
                await this.mpsOrderRepo.save(planOrder);
                const line = await this.orderLineRepo.findOne({ where: { erpOrderLineId: body.lineId } });
                if (line) {
                    line.plannedProductionDate = new Date(body.date);
                    await this.orderLineRepo.save(line);
                }
                return { success: true };
            }
        }
        const line = await this.orderLineRepo.findOne({ where: { erpOrderLineId: body.lineId } });
        if (line) {
            line.plannedProductionDate = new Date(body.date);
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
            await this.orderLineRepo.save(line);
            allocatedCount++;
        }
        return { success: true, allocatedCount };
    }
    async generatePlan(body) {
        const targetMonth = body.targetMonth;
        const existingApproved = await this.mpsPlanRepo.findOne({ where: { targetMonth, status: 'APPROVED' } });
        if (existingApproved) {
            return { success: false, message: `An approved plan already exists for ${targetMonth}. Reject it first to regenerate.` };
        }
        let plan = await this.mpsPlanRepo.findOne({ where: { targetMonth, status: 'DRAFT' } });
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
                status: 'DRAFT',
            });
            plan = await this.mpsPlanRepo.save(plan);
        }
        const targetDate = new Date(`${targetMonth}-01T00:00:00Z`);
        const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1, 0, 0, 0);
        const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59);
        const orders = await this.orderLineRepo.find({
            where: { erpOrderShipDate: (0, typeorm_2.Between)(startOfMonth, endOfMonth) }
        });
        const orderHeaders = await this.orderHeaderRepo.find();
        const headerMap = new Map();
        orderHeaders.forEach(h => headerMap.set(h.erpOrderHeaderId, h.erpOrderNumber));
        const specs = await this.specRepo.find();
        const specMap = new Map();
        specs.forEach(s => specMap.set(s.erpItemCode, s));
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
        const allIntakesRaw = await this.chickenReceivingService.findAll('monthly');
        const allIntakes = allIntakesRaw.filter((intake) => {
            const d = parseLocalDate(intake.receive_date);
            return d && d.startsWith(targetMonth);
        });
        const supplyMap = new Map();
        allIntakes.forEach((intake) => {
            const d = parseLocalDate(intake.receive_date);
            if (d) {
                const intakeKg = Number(intake.chicken_weight || 0);
                const rmFlAvailKg = intakeKg * 0.9575 * 0.95 * 0.04 * (1 - 0.093);
                supplyMap.set(d, (supplyMap.get(d) || 0) + rmFlAvailKg);
            }
        });
        const chillOrders = [];
        const freezeOrders = [];
        for (const order of orders) {
            const spec = specMap.get(order.erpOrderItemCode);
            if (!spec)
                continue;
            const orderObj = {
                ...order,
                productType: spec.productType,
                qty: Number(order.erpOrderItemQty || 0),
                shipDate: new Date(order.erpOrderShipDate)
            };
            if (orderObj.productType === 'chilled') {
                chillOrders.push(orderObj);
            }
            else {
                freezeOrders.push(orderObj);
            }
        }
        chillOrders.sort((a, b) => a.shipDate.getTime() - b.shipDate.getTime());
        freezeOrders.sort((a, b) => a.shipDate.getTime() - b.shipDate.getTime());
        const mpsOrdersToSave = [];
        const exceptionsToSave = [];
        let totalDemandKg = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        for (const order of chillOrders) {
            totalDemandKg += order.qty;
            let remainingQty = order.qty;
            for (let d = subtractDays(order.shipDate, 1); d >= subtractDays(order.shipDate, 3); d = subtractDays(d, 1)) {
                if (d < today)
                    continue;
                if (remainingQty <= 0)
                    break;
                const dateStr = formatDate(d);
                const supply = supplyMap.get(dateStr) || 0;
                if (supply > 0) {
                    const allocQty = Math.round(Math.min(supply, remainingQty));
                    if (allocQty > 0) {
                        mpsOrdersToSave.push(this.mpsOrderRepo.create({
                            mpsPlan: plan,
                            erpOrderLineId: order.erpOrderLineId,
                            soNumber: headerMap.get(order.erpOrderHeaderId) || order.erpOrderHeaderId?.toString(),
                            itemCode: order.erpOrderItemCode,
                            itemDesc: order.erpOrderItemCode,
                            productType: order.productType,
                            quantityKg: allocQty,
                            shipDate: order.shipDate,
                            plannedProductionDate: d,
                            isManualOverride: false
                        }));
                        supplyMap.set(dateStr, supply - allocQty);
                        remainingQty -= allocQty;
                    }
                }
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
                    reason: `No supply available for Chill order on or before ${formatDate(order.shipDate)}`
                }));
            }
        }
        const weightMatrix = await this.weightDistRepo.find();
        const sizeSupplyMap = new Map();
        allIntakes.forEach((intake) => {
            const d = parseLocalDate(intake.receive_date);
            if (!d)
                return;
            const intakeKg = Number(intake.chicken_weight || 0);
            const intakeBirds = Number(intake.chicken_count || 0);
            if (intakeBirds <= 0 || intakeKg <= 0)
                return;
            const avgWeight = intakeKg / intakeBirds;
            const slaughteredWeight = intakeKg * 0.9575 * 0.95;
            const matchingRows = weightMatrix.filter(row => {
                const label = row.rowLabel;
                if (label.includes('-')) {
                    const parts = label.split('-').map(s => parseFloat(s.trim()));
                    return avgWeight >= parts[0] && avgWeight <= parts[1];
                }
                return Math.abs(Number(label) - avgWeight) < 0.05;
            });
            const existing = sizeSupplyMap.get(d) || { total: 0, bins: { '40Down': 0, '40-45': 0, '45-50': 0, '50-55': 0, '55-60': 0, '60-65': 0, '65-70': 0, '70Up': 0 } };
            matchingRows.forEach(row => {
                const pct = Number(row.distValue || 0);
                if (pct <= 0)
                    return;
                const carcassWt = parseFloat(row.colLabel.replace(/[^\d.]/g, ''));
                if (isNaN(carcassWt))
                    return;
                const pieceGrams = (0.04 * carcassWt * 1000) / 2;
                const kg = slaughteredWeight * 0.04 * (pct / 100);
                if (pieceGrams < 40)
                    existing.bins['40Down'] += kg;
                else if (pieceGrams < 45)
                    existing.bins['40-45'] += kg;
                else if (pieceGrams < 50)
                    existing.bins['45-50'] += kg;
                else if (pieceGrams < 55)
                    existing.bins['50-55'] += kg;
                else if (pieceGrams < 60)
                    existing.bins['55-60'] += kg;
                else if (pieceGrams < 65)
                    existing.bins['60-65'] += kg;
                else if (pieceGrams < 70)
                    existing.bins['65-70'] += kg;
                else
                    existing.bins['70Up'] += kg;
                existing.total += kg;
            });
            sizeSupplyMap.set(d, existing);
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
                return ['60-65', '65-70', '70Up'];
            const rangeMatch = s.match(/(\d+)\s*[-–]\s*(\d+)/);
            if (rangeMatch) {
                const lo = parseInt(rangeMatch[1]);
                const hi = parseInt(rangeMatch[2]);
                const allBins = [
                    { key: '40Down', lo: 0, hi: 40 },
                    { key: '40-45', lo: 40, hi: 45 },
                    { key: '45-50', lo: 45, hi: 50 },
                    { key: '50-55', lo: 50, hi: 55 },
                    { key: '55-60', lo: 55, hi: 60 },
                    { key: '60-65', lo: 60, hi: 65 },
                    { key: '65-70', lo: 65, hi: 70 },
                    { key: '70Up', lo: 70, hi: 999 },
                ];
                return allBins.filter(b => b.hi > lo && b.lo < hi).map(b => b.key);
            }
            return [];
        };
        freezeOrders.sort((a, b) => {
            const dateDiff = a.shipDate.getTime() - b.shipDate.getTime();
            if (dateDiff !== 0)
                return dateDiff;
            const soA = headerMap.get(a.erpOrderHeaderId) || a.erpOrderHeaderId?.toString() || '';
            const soB = headerMap.get(b.erpOrderHeaderId) || b.erpOrderHeaderId?.toString() || '';
            return soA.localeCompare(soB);
        });
        const sizedFreezeOrders = freezeOrders.filter(o => {
            const spec = specMap.get(o.erpOrderItemCode);
            const sz = spec?.productSize?.toLowerCase()?.trim();
            return sz && sz !== 'unsize' && sz !== '';
        });
        const unsizeFreezeOrders = freezeOrders.filter(o => {
            const spec = specMap.get(o.erpOrderItemCode);
            const sz = spec?.productSize?.toLowerCase()?.trim();
            return !sz || sz === 'unsize' || sz === '';
        });
        const addDays = (date, days) => {
            const d = new Date(date);
            d.setDate(d.getDate() + days);
            return d;
        };
        const allDateStrs = [];
        for (let d = new Date(today); d <= endOfMonth; d = addDays(d, 1)) {
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
                const earliestProdDate = subtractDays(order.shipDate, 30) < today ? today : subtractDays(order.shipDate, 30);
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
                        itemDesc: order.erpOrderItemCode,
                        productType: order.productType,
                        quantityKg: allocQty,
                        shipDate: order.shipDate,
                        plannedProductionDate: dateObj,
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
        allocateFreeze(sizedFreezeOrders, true);
        allocateFreeze(unsizeFreezeOrders, false);
        await this.mpsOrderRepo.save(mpsOrdersToSave, { chunk: 500 });
        if (exceptionsToSave.length > 0) {
            await this.exceptionRepo.save(exceptionsToSave, { chunk: 500 });
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
                    const intakeKg = Number(intake.chicken_weight || 0);
                    originalSupplyKg += intakeKg * 0.9575 * 0.95 * 0.04 * (1 - 0.093);
                }
            });
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
        await this.mpsDailyRepo.save(mpsDailiesToSave, { chunk: 500 });
        const mpsSuppliesToSave = [];
        for (let i = 1; i <= daysInMonth; i++) {
            const dayStr = `${targetMonth}-${i.toString().padStart(2, '0')}`;
            let dailyIntakeBirds = 0;
            let dailyTotalWeight = 0;
            allIntakes.forEach((intake) => {
                const d = parseLocalDate(intake.receive_date);
                if (d === dayStr) {
                    dailyIntakeBirds += Number(intake.chicken_count || 0);
                    dailyTotalWeight += Number(intake.chicken_weight || 0);
                }
            });
            if (dailyIntakeBirds > 0) {
                const avgWeight = dailyTotalWeight / dailyIntakeBirds;
                const slaughteredWeight = dailyTotalWeight * 0.9575 * 0.95;
                const matchingRows = weightMatrix.filter(row => {
                    const label = row.rowLabel;
                    if (label.includes('-')) {
                        const parts = label.split('-').map(s => parseFloat(s.trim()));
                        const min = parts[0];
                        const max = parts[1];
                        return avgWeight >= min && avgWeight <= max;
                    }
                    return Math.abs(Number(label) - avgWeight) < 0.05;
                });
                const supplyEntry = this.mpsSupplyRepo.create({
                    mpsPlan: plan,
                    productionDate: new Date(dayStr),
                    intakeBirds: dailyIntakeBirds,
                    totalWeight: dailyTotalWeight,
                    avgWeight: avgWeight,
                    slaughteredWeight: slaughteredWeight,
                    size40Down: 0,
                    size40_45: 0,
                    size45_50: 0,
                    size50_55: 0,
                    size55_60: 0,
                    size60_65: 0,
                    size65_70: 0,
                    size70_up: 0
                });
                matchingRows.forEach(row => {
                    const pct = Number(row.distValue || 0);
                    if (pct <= 0)
                        return;
                    const carcassWt = parseFloat(row.colLabel.replace(/[^\d.]/g, ''));
                    if (isNaN(carcassWt))
                        return;
                    const pieceGrams = (0.04 * carcassWt * 1000) / 2;
                    const kg = slaughteredWeight * 0.04 * (pct / 100);
                    if (pieceGrams < 40)
                        supplyEntry.size40Down += kg;
                    else if (pieceGrams >= 40 && pieceGrams < 45)
                        supplyEntry.size40_45 += kg;
                    else if (pieceGrams >= 45 && pieceGrams < 50)
                        supplyEntry.size45_50 += kg;
                    else if (pieceGrams >= 50 && pieceGrams < 55)
                        supplyEntry.size50_55 += kg;
                    else if (pieceGrams >= 55 && pieceGrams < 60)
                        supplyEntry.size55_60 += kg;
                    else if (pieceGrams >= 60 && pieceGrams < 65)
                        supplyEntry.size60_65 += kg;
                    else if (pieceGrams >= 65 && pieceGrams < 70)
                        supplyEntry.size65_70 += kg;
                    else if (pieceGrams >= 70)
                        supplyEntry.size70_up += kg;
                });
                mpsSuppliesToSave.push(supplyEntry);
            }
        }
        if (mpsSuppliesToSave.length > 0) {
            await this.mpsSupplyRepo.save(mpsSuppliesToSave, { chunk: 500 });
        }
        plan.totalIntakeBirds = totalIntakeBirds;
        plan.totalRmFlKg = totalRmFlKg;
        plan.totalDemandKg = totalDemandKg;
        await this.mpsPlanRepo.save(plan);
        return { success: true, planId: plan.id, status: plan.status };
    }
    async getPlans() {
        return this.mpsPlanRepo.find({
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
    async getPlan(id) {
        const plan = await this.mpsPlanRepo.findOne({
            where: { id },
            relations: ['dailySummaries', 'exceptions', 'supplyBreakdown']
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
            plan.supplyBreakdown.forEach(s => delete s.mpsPlan);
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
            .where('plan.status = :status', { status: 'APPROVED' })
            .andWhere('order.planned_production_date = :date', { date })
            .getMany();
        return orders;
    }
};
exports.MpsController = MpsController;
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
    (0, common_1.Get)('plans'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
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
    __metadata("design:paramtypes", [typeorm_2.Repository,
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