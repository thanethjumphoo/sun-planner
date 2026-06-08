import { Controller, Get, Post, Put, Delete, Body, Param, Query, NotFoundException, Res } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { DpsPlan, DpsSublot, DpsSublotBin, DpsOrder, DpsAllocation } from './dps-plan.entity';
import * as express from 'express';
import * as ExcelJS from 'exceljs';


@Controller('api/dps')
export class DpsController {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(DpsPlan) private planRepo: Repository<DpsPlan>,
    @InjectRepository(DpsSublot) private sublotRepo: Repository<DpsSublot>,
    @InjectRepository(DpsOrder) private orderRepo: Repository<DpsOrder>,
    @InjectRepository(DpsAllocation) private allocationRepo: Repository<DpsAllocation>,
  ) {}

  @Get(':date')
  async getPlanByDate(@Param('date') date: string, @Query('partType') partType: string) {
    const pt = partType || 'fillet';
    const plan = await this.planRepo.findOne({
      where: { productionDate: new Date(date), partType: pt },
      relations: [
        'sublots', 
        'sublots.bins', 
        'orders', 
        'allocations', 
        'allocations.sourceBin', 
        'allocations.sourceBin.sublot',
        'allocations.targetOrder'
      ],
    });
    if (!plan) return { exists: false };
    return { exists: true, data: plan };
  }

  @Delete(':date')
  async deletePlan(@Param('date') date: string, @Query('partType') partType: string) {
    const pt = partType || 'fillet';
    const existing = await this.planRepo.findOne({ where: { productionDate: new Date(date), partType: pt } });
    if (existing) {
      await this.planRepo.remove(existing);
    }
    return { success: true };
  }

  @Post(':date/generate')
  async saveGeneratedPlan(@Param('date') date: string, @Body() payload: any) {
    return await this.dataSource.transaction(async (manager) => {
      const pt = payload.partType || 'fillet';

      // 1. Delete existing if any (to replace) — scoped by partType
      const existing = await manager.findOne(DpsPlan, { where: { productionDate: new Date(date), partType: pt } });
      if (existing) {
        await manager.remove(existing);
      }

      // 2. Map frontend payload to entities
      const plan = manager.create(DpsPlan, {
        productionDate: new Date(date),
        partType: pt,
        status: 'CONFIRMED',
        totalSupplyKg: payload.totalSupplyKg,
        totalDemandKg: payload.totalDemandKg,
        fulfillmentRate: payload.fulfillmentRate,
      });

      // Map sublots
      plan.sublots = payload.sublots.map((sl: any) => {
        const sublot = new DpsSublot();
        sublot.sublotNumber = sl.id.includes('_') ? sl.id.split('_')[0] : sl.id;
        sublot.farmName = sl.farmName;
        sublot.shift = sl.shift || 'A';
        sublot.totalBirds = Math.round(sl.totalBirds);
        sublot.totalWeightKg = Math.round(sl.totalWeightKg);
        sublot.avgLiveWeight = sl.avgLiveWeight;
        sublot.coProductKg = Number((sl.coProductKg || 0).toFixed(1));
        sublot.supportManpower = sl.supportManpower || 0;

        sublot.bins = Object.keys(sl.bins).map(binKey => {
          const bin = new DpsSublotBin();
          bin.sizeLabel = binKey;
          bin.availableKg = Number((sl.bins[binKey] || 0).toFixed(1));
          return bin;
        });

        return sublot;
      });

      // Map orders
      plan.orders = payload.orders.map((o: any) => {
        const order = new DpsOrder();
        order.erpOrderLineId = parseInt(o.id.replace('L-', '')) || 0;
        order.itemCode = o.itemCode;
        order.itemDesc = o.itemDesc;
        order.productType = o.type;
        order.productSize = o.size;
        order.requiredKg = Number(o.qty.toFixed(1));
        order.fulfilledKg = Number(o.fulfilledKg.toFixed(1));
        order.unfulfilledKg = Number(o.unfulfilledKg.toFixed(1));
        return order;
      });

      // Let's save the plan first with sublots and orders, then add allocations.
      const savedPlan = await manager.save(plan);

      // Reload to get IDs
      const reloadedPlan = await manager.findOne(DpsPlan, {
        where: { id: savedPlan.id },
        relations: ['sublots', 'sublots.bins', 'orders'],
      });

      if (!reloadedPlan) return { success: false, message: 'Plan not found after saving' };

      // Build allocations
      const allocationsToSave = [];
      for (const alloc of payload.allocations) {
        const allocSublotNumber = alloc.sublotId.includes('_') ? alloc.sublotId.split('_')[0] : alloc.sublotId;
        const allocShift = alloc.sublotId.includes('_') ? alloc.sublotId.split('_')[1] : null;

        const dbSublot = reloadedPlan.sublots.find(s => {
          if (allocShift) {
            return s.sublotNumber === allocSublotNumber && s.shift === allocShift;
          }
          return s.sublotNumber === allocSublotNumber;
        });
        if (!dbSublot) continue;
        
        const dbBin = dbSublot.bins.find(b => b.sizeLabel === alloc.size);
        const dbOrder = reloadedPlan.orders.find(o => `L-${o.erpOrderLineId}` === alloc.orderId);
        
        if (!dbOrder) continue;

        const newAlloc = manager.create(DpsAllocation, {
          dpsPlan: reloadedPlan,
          sourceBin: dbBin,
          targetOrder: dbOrder,
          allocatedKg: Number(alloc.qty.toFixed(1)),
          allocationPass: 'Auto',
        });
        allocationsToSave.push(newAlloc);
      }

      if (allocationsToSave.length > 0) {
        await manager.save(allocationsToSave);
      }

      return { success: true, planId: savedPlan.id };
    });
  }

  @Get(':date/export')
  async exportPlan(@Param('date') date: string, @Query('partType') partType: string, @Res() res: express.Response) {
    const pt = partType || 'fillet';
    const plan = await this.planRepo.findOne({
      where: { productionDate: new Date(date), partType: pt },
      relations: [
        'sublots', 
        'sublots.bins', 
        'orders', 
        'allocations', 
        'allocations.sourceBin', 
        'allocations.sourceBin.sublot',
        'allocations.targetOrder'
      ],
    });

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    const workbook = new ExcelJS.Workbook();
    
    // Sheet 1: Shift Summary
    const summarySheet = workbook.addWorksheet('Shift Summary');
    
    // Sheet 2: Sublot Breakdown
    const detailSheet = workbook.addWorksheet('Sublot Breakdown');

    // Gather and group allocations
    const shiftSummaries: Record<string, Record<string, {
      itemCode: string;
      itemDesc: string;
      productSize: string;
      qty: number;
    }>> = {};

    plan.allocations.forEach(alloc => {
      const sublot = alloc.sourceBin?.sublot;
      const shift = (sublot?.shift || 'A').toUpperCase().trim();
      const order = alloc.targetOrder;
      
      if (!order) return;
      
      if (!shiftSummaries[shift]) {
        shiftSummaries[shift] = {};
      }
      
      const key = `${order.itemCode}_${order.productSize}`;
      if (!shiftSummaries[shift][key]) {
        shiftSummaries[shift][key] = {
          itemCode: order.itemCode,
          itemDesc: order.itemDesc,
          productSize: order.productSize || '-',
          qty: 0
        };
      }
      shiftSummaries[shift][key].qty += Number(alloc.allocatedKg);
    });

    // Format target date as DD/MM/YYYY
    const formattedDate = new Date(date).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // ─── 1. SHIFT SUMMARY SHEET ───
    summarySheet.views = [{ showGridLines: true }];
    
    // Title Banner
    summarySheet.mergeCells('A1:E1');
    const titleCell = summarySheet.getCell('A1');
    titleCell.value = 'รายงานสรุปผลผลิตรายกะ (Daily Shift Production Summary)';
    titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F497D' } }; // Dark Navy
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    summarySheet.getRow(1).height = 40;

    // Info Section
    summarySheet.getCell('A3').value = 'วันที่ผลิต (Production Date):';
    summarySheet.getCell('A3').font = { bold: true };
    summarySheet.getCell('B3').value = formattedDate;

    summarySheet.getCell('D3').value = 'ประเภทแผน (Part Type):';
    summarySheet.getCell('D3').font = { bold: true };
    summarySheet.getCell('E3').value = pt.toUpperCase();
    
    summarySheet.getRow(3).height = 20;

    // Let's list each shift's summary
    let currentRow = 5;

    const sortedShifts = Object.keys(shiftSummaries).sort();
    if (sortedShifts.length === 0) {
      summarySheet.getCell(`A${currentRow}`).value = 'ไม่มีข้อมูลการจัดสรรผลผลิต';
      summarySheet.getCell(`A${currentRow}`).font = { italic: true };
    } else {
      sortedShifts.forEach(shift => {
        // Shift Title Row
        summarySheet.mergeCells(`A${currentRow}:E${currentRow}`);
        const shiftHeaderCell = summarySheet.getCell(`A${currentRow}`);
        shiftHeaderCell.value = `กะ ${shift} (Shift ${shift})`;
        shiftHeaderCell.font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF1F497D' } };
        shiftHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } }; // Light Slate Blue
        shiftHeaderCell.alignment = { vertical: 'middle', horizontal: 'left' };
        summarySheet.getRow(currentRow).height = 25;
        currentRow++;

        // Table Header
        const headers = ['ลำดับ (No.)', 'รหัสสินค้า (Product Code)', 'รายละเอียดสินค้า (Description)', 'ขนาด (Size)', 'น้ำหนักผลิตรวม (Total Qty - Kg)'];
        const headerRow = summarySheet.addRow(headers);
        headerRow.height = 25;
        headerRow.eachCell((cell) => {
          cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } }; // Steel Blue
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
        
        let startDataRow = currentRow + 1;
        let index = 1;
        const items = Object.values(shiftSummaries[shift]);
        items.forEach(item => {
          let cleanDesc = item.itemDesc || '-';
          if (cleanDesc.startsWith(`${item.itemCode} - `)) {
            cleanDesc = cleanDesc.replace(`${item.itemCode} - `, '');
          } else if (cleanDesc === item.itemCode) {
            cleanDesc = '-';
          }
          
          const rowData = [
            index++,
            item.itemCode,
            cleanDesc,
            item.productSize,
            Number(item.qty.toFixed(1))
          ];
          const dataRow = summarySheet.addRow(rowData);
          dataRow.height = 20;
          dataRow.eachCell((cell, colNum) => {
            cell.font = { name: 'Segoe UI', size: 10 };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            if (colNum === 1 || colNum === 2 || colNum === 4) {
              cell.alignment = { vertical: 'middle', horizontal: 'center' };
            } else if (colNum === 3) {
              cell.alignment = { vertical: 'middle', horizontal: 'left' };
            } else if (colNum === 5) {
              cell.alignment = { vertical: 'middle', horizontal: 'right' };
              cell.numFmt = '#,##0.0';
            }
          });
          currentRow++;
        });

        // Shift Total Row
        const totalRow = summarySheet.addRow(['รวมกะ ' + shift, '', '', '', { formula: `=SUM(E${startDataRow}:E${currentRow + 1})` }]);
        summarySheet.mergeCells(`A${currentRow + 2}:D${currentRow + 2}`);
        totalRow.height = 22;
        totalRow.eachCell((cell, colNum) => {
          cell.font = { name: 'Segoe UI', size: 10, bold: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'double' }, right: { style: 'thin' } };
          if (colNum === 1) {
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
          } else if (colNum === 5) {
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
            cell.numFmt = '#,##0.0';
          }
        });
        
        currentRow += 4; // Add spacing before next shift
      });
    }

    // Auto-fit columns for Shift Summary sheet
    if (summarySheet.columns) {
      summarySheet.columns.forEach(column => {
        if (column && column.eachCell) {
          let maxLen = 10;
          column.eachCell({ includeEmpty: true }, cell => {
            const val = cell.value ? cell.value.toString() : '';
            if (val.length > maxLen) maxLen = val.length;
          });
          column.width = Math.min(Math.max(maxLen + 3, 12), 40);
        }
      });
    }

    // ─── 2. SUBLOT BREAKDOWN SHEET ───
    detailSheet.views = [{ showGridLines: true }];
    
    // Title Banner
    detailSheet.mergeCells('A1:H1');
    const titleCell2 = detailSheet.getCell('A1');
    titleCell2.value = 'รายละเอียดการผลิตแยกรายซับลอต (Daily Sublot Production Details)';
    titleCell2.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F497D' } }; // Dark Navy
    titleCell2.alignment = { vertical: 'middle', horizontal: 'center' };
    detailSheet.getRow(1).height = 40;

    // Info Section
    detailSheet.getCell('A3').value = 'วันที่ผลิต (Production Date):';
    detailSheet.getCell('A3').font = { bold: true };
    detailSheet.getCell('B3').value = formattedDate;

    detailSheet.getCell('F3').value = 'ประเภทแผน (Part Type):';
    detailSheet.getCell('F3').font = { bold: true };
    detailSheet.getCell('G3').value = pt.toUpperCase();
    
    detailSheet.getRow(3).height = 20;

    // Section 1: Incoming Sublots
    detailSheet.getCell('A5').value = '1. รายการวัตถุดิบไก่เข้าแยกรายซับลอต (Raw Material Incoming)';
    detailSheet.getCell('A5').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF1F497D' } };
    
    const rmHeaders = ['ลำดับ', 'ซับลอต', 'ชื่อฟาร์ม', 'กะ', 'จำนวนตัว (Birds)', 'น้ำหนักเฉลี่ย (Avg Wt)', 'น้ำหนักรวม (RM Wt)', 'ยอด Grade B (Co-product)'];
    const rmHeaderRow = detailSheet.addRow(rmHeaders);
    rmHeaderRow.height = 25;
    rmHeaderRow.eachCell((cell) => {
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B9BD5' } }; // Soft Blue
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    let startRmRow = 7;
    let rmIdx = 1;
    plan.sublots.forEach(sl => {
      const row = detailSheet.addRow([
        rmIdx++,
        sl.sublotNumber || '-',
        sl.farmName || '-',
        (sl.shift || 'A').toUpperCase(),
        Number(sl.totalBirds || 0),
        Number(sl.avgLiveWeight || 0),
        Number(sl.totalWeightKg || 0),
        Number(sl.coProductKg || 0)
      ]);
      row.height = 20;
      row.eachCell((cell, colNum) => {
        cell.font = { name: 'Segoe UI', size: 10 };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        if (colNum <= 4) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (colNum === 5) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = '#,##0';
        } else if (colNum === 6) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = '0.0000';
        } else if (colNum === 7 || colNum === 8) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = '#,##0.0';
        }
      });
    });

    let currentDetailRow = startRmRow + plan.sublots.length + 2;

    // Section 2: Detailed Allocations by Sublot
    detailSheet.getCell(`A${currentDetailRow}`).value = '2. รายละเอียดการจัดสรรผลผลิตรายซับลอต (Production Allocation Details)';
    detailSheet.getCell(`A${currentDetailRow}`).font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF1F497D' } };
    currentDetailRow++;

    const allocHeaders = ['ซับลอต', 'ชื่อฟาร์ม', 'กะ', 'รหัสสินค้า (Code)', 'รายละเอียดสินค้า (Description)', 'ขนาด (Size)', 'น้ำหนักจัดสรร (Allocated - Kg)', 'วิธีการจัดสรร (Pass)'];
    
    // We add row manually
    const allocHeaderRow = detailSheet.insertRow(currentDetailRow, allocHeaders);
    allocHeaderRow.height = 25;
    allocHeaderRow.eachCell((cell) => {
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } }; // Steel Blue
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
    currentDetailRow++;

    const allocMap = new Map<string, any>();
    plan.allocations.forEach(alloc => {
      const sublot = alloc.sourceBin?.sublot;
      const order = alloc.targetOrder;
      if (!sublot || !order) return;

      const key = `${sublot.sublotNumber}_${order.itemCode}`;
      if (!allocMap.has(key)) {
        let cleanDesc = order.itemDesc || '-';
        if (cleanDesc.startsWith(`${order.itemCode} - `)) {
          cleanDesc = cleanDesc.replace(`${order.itemCode} - `, '');
        } else if (cleanDesc === order.itemCode) {
          cleanDesc = '-';
        }

        allocMap.set(key, {
          sublotNumber: sublot.sublotNumber || '-',
          farmName: sublot.farmName || '-',
          shift: (sublot.shift || 'A').toUpperCase(),
          itemCode: order.itemCode,
          itemDesc: cleanDesc,
          productSize: order.productSize || '-',
          allocatedKg: 0,
          allocationPass: alloc.allocationPass || 'Auto'
        });
      }
      allocMap.get(key).allocatedKg += Number(alloc.allocatedKg);
    });

    const groupedAllocs = Array.from(allocMap.values());
    groupedAllocs.sort((a, b) => {
      const sA = a.sublotNumber;
      const sB = b.sublotNumber;
      return sA.localeCompare(sB, undefined, { numeric: true });
    }).forEach(alloc => {
      const row = detailSheet.addRow([
        alloc.sublotNumber,
        alloc.farmName,
        alloc.shift,
        alloc.itemCode,
        alloc.itemDesc,
        alloc.productSize,
        alloc.allocatedKg,
        alloc.allocationPass
      ]);
      row.height = 20;
      row.eachCell((cell, colNum) => {
        cell.font = { name: 'Segoe UI', size: 10 };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        if (colNum === 1 || colNum === 3 || colNum === 4 || colNum === 6 || colNum === 8) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (colNum === 2 || colNum === 5) {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        } else if (colNum === 7) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = '#,##0.0';
        }
      });
      currentDetailRow++;
    });

    // Auto-fit columns for Sublot Breakdown sheet
    if (detailSheet.columns) {
      detailSheet.columns.forEach(column => {
        if (column && column.eachCell) {
          let maxLen = 10;
          column.eachCell({ includeEmpty: true }, cell => {
            const val = cell.value ? cell.value.toString() : '';
            if (val.length > maxLen) maxLen = val.length;
          });
          column.width = Math.min(Math.max(maxLen + 3, 12), 40);
        }
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=DPS_Plan_${date}_${pt}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  }
}

