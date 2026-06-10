import * as ExcelJS from 'exceljs';
import { MpsPlan, MpsPlanOrder } from './mps-plan.entity';
import { ProductSpec } from './product-spec.entity';
import { StgErpOrderHeader } from './stg-erp-order-header.entity';

export async function generateBlExcelPlan(
  plan: MpsPlan,
  orders: MpsPlanOrder[],
  specs: ProductSpec[],
  orderHeaders: StgErpOrderHeader[]
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('BL MPS Plan');

  // Prepare Data
  const dailyMap = new Map();
  plan.dailySummaries.sort((a: any, b: any) => new Date(a.productionDate).getTime() - new Date(b.productionDate).getTime()).forEach((d: any) => {
    dailyMap.set(new Date(d.productionDate).toISOString().split('T')[0], { summary: d, orders: new Map() });
  });

  const dates = Array.from(dailyMap.keys());
  const specMap = new Map();
  specs.forEach(s => specMap.set(s.erpItemCode, s));

  const itemMap = new Map();
  orders.forEach(o => itemMap.set(o.itemCode, o.itemDesc));
  const itemCodes = Array.from(itemMap.keys()).sort();

  orders.forEach(o => {
    const dateKey = new Date(o.plannedProductionDate).toISOString().split('T')[0];
    if (dailyMap.has(dateKey)) {
      const d = dailyMap.get(dateKey);
      d.orders.set(o.itemCode, (d.orders.get(o.itemCode) || 0) + o.quantityKg);
    }
  });

  // Use standard RM sizes for the Belt Gate Sizes
  const beltGateSizeList = ['140 DOWN', '160-180', '180-200', '200-220', '220-240', '240-260', '260-280', '280-300', '300-320', '320-340', '340-360', '360-380', '380-400', '400-420', '420-440', '440 UP'];

  // ─── LAYOUT SETUP (Dates as Rows, Metrics as Columns) ───
  // Row 1: Section Headers
  const sectionRow = sheet.addRow([]);
  let colIdx = 3; // Start after Date, Day
  
  const supplyStart = colIdx;
  const supplyEnd = colIdx + 11; // Total(4), Int(4), Ext(4) = 12 columns
  sectionRow.getCell(supplyStart).value = 'Supply Control (RM BL)';
  sheet.mergeCells(1, supplyStart, 1, supplyEnd);
  colIdx = supplyEnd + 1;

  const icutStart = colIdx;
  const icutEnd = colIdx + 4; // Process, Hours, Cap, Util, Manual
  sectionRow.getCell(icutStart).value = 'I-Cut & Manual Trimming';
  sheet.mergeCells(1, icutStart, 1, icutEnd);
  colIdx = icutEnd + 1;

  const blockStart = colIdx;
  const blockEnd = colIdx + 1; // Produced, Used
  sectionRow.getCell(blockStart).value = 'BL BLOCK Tracking';
  sheet.mergeCells(1, blockStart, 1, blockEnd);
  colIdx = blockEnd + 1;

  const sizeStart = colIdx;
  const sizeEnd = colIdx + beltGateSizeList.length - 1;
  if (beltGateSizeList.length > 0) {
    sectionRow.getCell(sizeStart).value = 'Belt Gate Sizes (RM BL)';
    if (sizeEnd > sizeStart) sheet.mergeCells(1, sizeStart, 1, sizeEnd);
  }
  colIdx = beltGateSizeList.length > 0 ? sizeEnd + 1 : colIdx;

  const prodStart = colIdx;
  const prodEnd = colIdx + itemCodes.length - 1;
  if (itemCodes.length > 0) {
    sectionRow.getCell(prodStart).value = 'Production Plan';
    if (prodEnd > prodStart) sheet.mergeCells(1, prodStart, 1, prodEnd);
  }

  // Style Section Headers
  const secDefs = [
    { start: supplyStart, end: supplyEnd, color: 'FF4472C4' },
    { start: icutStart, end: icutEnd, color: 'FFE67CA0' },
    { start: blockStart, end: blockEnd, color: 'FFED7D31' },
    { start: sizeStart, end: sizeEnd, color: 'FF2E7D32' },
    { start: prodStart, end: prodEnd, color: 'FF7030A0' }
  ];
  secDefs.forEach(sec => {
    if (sec.start <= sec.end) {
      for (let i = sec.start; i <= sec.end; i++) {
        const cell = sectionRow.getCell(i);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sec.color } };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 };
        cell.alignment = { horizontal: 'center' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      }
    }
  });

  // Row 2: Sub-Headers (Item Descriptions for Production Plan)
  const machineNameRow = sheet.addRow([]);
  itemCodes.forEach((code, idx) => {
    machineNameRow.getCell(prodStart + idx).value = itemMap.get(code) || '';
  });
  for (let i = prodStart; i <= prodEnd; i++) {
    const cell = machineNameRow.getCell(i);
    cell.font = { bold: true, size: 8 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    cell.alignment = { horizontal: 'center', wrapText: true };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  }
  machineNameRow.height = 30;

  // Row 3: Column Headers
  const subHeaders = [
    'Date', 'Day',
    'Total RM BL', 'BL (เนื้อรวม)', 'BL-TH (สะโพก)', 'BL-DR (น่อง)',
    'Int. RM Total', 'Int. BL (เนื้อรวม)', 'Int. BL-TH (สะโพก)', 'Int. BL-DR (น่อง)',
    'Ext. RM Total', 'Ext. BL (เนื้อรวม)', 'Ext. BL-TH (สะโพก)', 'Ext. BL-DR (น่อง)',
    'I-Cut Process (kg)', 'I-Cut Hours', 'I-Cut Cap (hrs)', 'I-Cut Util (%)', 'Manual Trim (kg)',
    'Block Produced', 'Block Used',
    ...beltGateSizeList,
    ...itemCodes
  ];
  const headerRow = sheet.addRow(subHeaders);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 8 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  });
  headerRow.height = 35;

  // Data Rows
  dates.forEach(dateStr => {
    const d = dailyMap.get(dateStr);
    const dateObj = new Date(dateStr);
    const trk = (() => {
      try { return JSON.parse(d.summary.blTrackerJson || '{}'); } catch (e) { return {}; }
    })();
    const rm = trk.rmBreakdown || {};
    const intRm = trk.internalRemaining || {};
    const extRm = trk.externalRemaining || {};
    
    const blKg = Number(rm.bl || 0);
    const blThKg = Number(rm.blTh || 0);
    const blDrKg = Number(rm.blDr || 0);
    const totalBl = blKg + blThKg + blDrKg;
    
    const totalBlSum = blKg + blThKg + blDrKg;
    
    const intBl = Number(intRm.BL || 0);
    const intBlTh = Number(intRm.BLTH || 0);
    const intBlDr = Number(intRm.BLDR || 0);
    const totalIntBl = intBl + intBlTh + intBlDr;

    const extBl = Number(extRm.BL || 0);
    const extBlTh = Number(extRm.BLTH || 0);
    const extBlDr = Number(extRm.BLDR || 0);
    const totalExtBl = extBl + extBlTh + extBlDr;

    const icutCap = Number(trk.icutCapacityHours || 37);
    const icutHours = Number(trk.icutUsedHours || 0);
    const icutUtil = icutCap > 0 ? (icutHours / icutCap) * 100 : 0;

    const rmBreakdownArr = beltGateSizeList.map(() => 0);
    const supply = (plan as any).supplies?.find((s: any) => s.productionDate === dateStr || new Date(s.productionDate).toISOString().split('T')[0] === dateStr);
    const rmBlUsed = Number(trk.rmBlUsed || 0);

    if (rmBlUsed > 0) {
      const bilSizesRecord: Record<string, number> = {};
      const fullTrk = (() => { try { return JSON.parse(d.summary.trackerJson || '{}'); } catch (e) { return {}; } })();
      const extSizes = fullTrk.extSizes || {};

      beltGateSizeList.forEach(label => {
        let kg = 0;
        if (supply?.sizes) {
          kg += supply.sizes.filter((sz: any) => sz.groupSize === label).reduce((sum: number, sz: any) => sum + Number(sz.quantityKg || 0), 0);
        }
        if (extSizes[label]) kg += Number(extSizes[label]);
        bilSizesRecord[label] = kg;
      });

      const demandKgByBilSize: Record<string, number> = {};
      d.orders.forEach((qty: number, itemCode: string) => {
        const spec = specs.find(s => s.erpItemCode === itemCode);
        const sizeMatch = (spec?.productSize || '').match(/(\d+-\d+|\d+\s*Up|\d+\s*Down)/i);
        const oSize = sizeMatch ? sizeMatch[0] : 'Unsized';
        const oYield = spec?.productYield && Number(spec.productYield) > 0 ? Number(spec.productYield) : 1;
        demandKgByBilSize[oSize] = (demandKgByBilSize[oSize] || 0) + (qty / oYield);
      });

      let totalRemaining = 0;
      const blBreakdownRecord: Record<string, number> = {};
      Object.keys(bilSizesRecord).forEach(bilSz => {
        const remaining = Math.max(0, bilSizesRecord[bilSz] - (demandKgByBilSize[bilSz] || 0));
        blBreakdownRecord[bilSz] = remaining;
        totalRemaining += remaining;
      });

      if (totalRemaining > 0) {
        beltGateSizeList.forEach((bilSz, i) => {
          rmBreakdownArr[i] = Math.round(((blBreakdownRecord[bilSz] || 0) / totalRemaining) * rmBlUsed);
        });
      } else {
        let totalBilSizes = 0;
        Object.values(bilSizesRecord).forEach(v => totalBilSizes += v);
        if (totalBilSizes > 0) {
          beltGateSizeList.forEach((bilSz, i) => {
            const ratio = bilSizesRecord[bilSz] / totalBilSizes;
            rmBreakdownArr[i] = Math.round(rmBlUsed * ratio);
          });
        }
      }
    }

    const intRatio = totalBlSum > 0 ? totalIntBl / totalBlSum : 1;
    const extRatio = totalBlSum > 0 ? totalExtBl / totalBlSum : 0;
    const totalIntRm = Math.round(rmBlUsed * intRatio);
    const totalExtRm = Math.round(rmBlUsed * extRatio);

    const rowData = [
      `${dateObj.getDate()}/${dateObj.toLocaleString('en-US', { month: 'short' })}`,
      dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
      rmBlUsed, blKg, blThKg, blDrKg,
      totalIntRm, intBl, intBlTh, intBlDr,
      totalExtRm, extBl, extBlTh, extBlDr,
      Number(trk.icutUsedKg || 0), icutHours, icutCap, `${icutUtil.toFixed(1)}%`, Number(trk.manualUsedKg || 0),
      Number(trk.blBlockProduced || 0), Number(trk.blBlockUsed || 0)
    ];

    beltGateSizeList.forEach((sz, i) => {
      rowData.push(rmBreakdownArr[i] || 0);
    });

    itemCodes.forEach(code => {
      rowData.push(d.orders.get(code) || 0);
    });

    const dataRow = sheet.addRow(rowData);
    dataRow.eachCell((cell, colNumber) => {
      if (colNumber > 2 && typeof cell.value === 'number') {
        cell.numFmt = '#,##0';
      }
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
  });

  // Totals Row
  const totalRowData: any[] = ['Total', ''];
  for (let i = 2; i < subHeaders.length; i++) {
    if (i === 15) { // I-Cut Util (%)
      totalRowData.push('');
      continue;
    }
    let colSum = 0;
    for (let r = 4; r < 4 + dates.length; r++) {
      const val = sheet.getCell(r, i + 1).value;
      if (typeof val === 'number') colSum += val;
    }
    totalRowData.push(colSum);
  }
  const totalsRow = sheet.addRow(totalRowData);
  totalsRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } };
    if (colNumber > 2 && typeof cell.value === 'number') {
      cell.numFmt = '#,##0';
    }
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  });

  // Formatting
  sheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 3 }];
  sheet.getColumn(1).width = 10;
  sheet.getColumn(2).width = 6;
  for (let c = 3; c <= subHeaders.length; c++) sheet.getColumn(c).width = 12;

  return workbook;
}
