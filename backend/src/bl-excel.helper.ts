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

  // Extract all unique Belt Gate Sizes
  const uniqueBeltGateSizes = new Set<string>();
  dates.forEach(dateStr => {
    const d = dailyMap.get(dateStr);
    try {
      const trk = JSON.parse(d.summary.blTrackerJson || '{}');
      if (trk.beltGateSizes) {
        Object.keys(trk.beltGateSizes).forEach(sz => {
          if (!sz.startsWith('BL_BLOCK')) uniqueBeltGateSizes.add(sz);
        });
      }
    } catch (e) {}
  });
  const beltGateSizeList = Array.from(uniqueBeltGateSizes).sort();

  // ─── LAYOUT SETUP (Dates as Rows, Metrics as Columns) ───
  // Row 1: Section Headers
  const sectionRow = sheet.addRow([]);
  let colIdx = 3; // Start after Date, Day
  
  const supplyStart = colIdx;
  const supplyEnd = colIdx + 5; // Total, Int, Ext, BL, BL-TH, BL-DR
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
    'Total RM BL', 'Internal RM', 'External RM', 'BL (ทั้งชิ้น)', 'BL-TH (สะโพก)', 'BL-DR (น่อง)',
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
    
    const totalInt = Number(intRm.BL || 0) + Number(intRm.BLTH || 0) + Number(intRm.BLDR || 0);
    const totalExt = Number(extRm.BL || 0) + Number(extRm.BLTH || 0) + Number(extRm.BLDR || 0);

    const icutCap = Number(trk.icutCapacityHours || 37);
    const icutHours = Number(trk.icutUsedHours || 0);
    const icutUtil = icutCap > 0 ? (icutHours / icutCap) * 100 : 0;

    const rowData = [
      `${dateObj.getDate()}/${dateObj.toLocaleString('en-US', { month: 'short' })}`,
      dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
      totalBl, totalInt, totalExt, blKg, blThKg, blDrKg,
      Number(trk.icutUsedKg || 0), icutHours, icutCap, `${icutUtil.toFixed(1)}%`, Number(trk.manualUsedKg || 0),
      Number(trk.blBlockProduced || 0), Number(trk.blBlockUsed || 0)
    ];

    beltGateSizeList.forEach(sz => {
      rowData.push(Number(trk.beltGateSizes?.[sz] || 0));
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
    if (i === 9) { // I-Cut Util (%)
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
