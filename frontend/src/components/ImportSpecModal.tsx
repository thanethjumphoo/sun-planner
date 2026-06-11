import { useState, useRef } from 'react';
import { X, Upload, Download, AlertCircle, CheckCircle, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

const COLUMNS = [
  { key: 'erpItemCode', label: 'Item Code' },
  { key: 'productType', label: 'Product Type (chilled/freeze)' },
  { key: 'productSize', label: 'Size (e.g. unsize, 40-45)' },
  { key: 'productYield', label: 'Yield' },
  { key: 'productWeight', label: 'Weight (kg)' },
  { key: 'productSpeed', label: 'Line Speed (kg/h)' },
  { key: 'icutSpeed', label: 'I-Cut Speed (kg/h)' },
  { key: 'minProductLead', label: 'Min Lead (days)' },
  { key: 'maxProductLead', label: 'Max Lead (days)' },
  { key: 'isExternalRmAllowed', label: 'Allow Ext RM (true/false)' },
];

const SAMPLE_ROW = {
  'Item Code': '111145102',
  'Product Type (chilled/freeze)': 'chilled',
  'Size (e.g. unsize, 40-45)': 'unsize',
  'Yield': '0.84',
  'Weight (kg)': '2.0',
  'Line Speed (kg/h)': '45',
  'I-Cut Speed (kg/h)': '0',
  'Min Lead (days)': '1',
  'Max Lead (days)': '3',
  'Allow Ext RM (true/false)': 'false',
};

interface ImportSpecModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportDone: () => void;
}

export default function ImportSpecModal({ isOpen, onClose, onImportDone }: ImportSpecModalProps) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [status, setStatus] = useState<'idle' | 'importing' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [summary, setSummary] = useState<{ created: number; updated: number; skipped: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Download Template ---
  const handleDownloadTemplate = () => {
    const headers = COLUMNS.map(c => c.label);
    const sampleRow = COLUMNS.map(c => SAMPLE_ROW[c.label as keyof typeof SAMPLE_ROW] || '');

    const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
    ws['!cols'] = COLUMNS.map(() => ({ wch: 20 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Product Specs');
    XLSX.writeFile(wb, 'product_spec_template.xlsx');
  };

  // --- Upload & Parse Excel ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus('idle');
    setErrorMsg('');
    setSummary(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonDataRaw = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '', raw: true });
        const jsonDataFormatted = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '', raw: false });

        let parsed = jsonDataRaw.map((_rawExcelRow, idx) => {
          const formattedExcelRow = jsonDataFormatted[idx] || {};
          const row: Record<string, string> = {};
          
          COLUMNS.forEach(col => {
            const formattedVal = formattedExcelRow[col.label];
            row[col.key] = formattedVal !== undefined && formattedVal !== null ? String(formattedVal).trim() : '';
          });
          return row;
        });

        parsed = parsed.filter(row => row.erpItemCode !== '');
        setRows(parsed);
      } catch {
        setErrorMsg('Cannot read the Excel file. Please use the template.');
        setStatus('error');
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Import to Backend ---
  const handleImport = async () => {
    if (rows.length === 0) return;
    setStatus('importing');
    setErrorMsg('');
    setSummary(null);

    // Prepare payload
    const payloadRows = rows.map(r => ({
      erpItemCode: r.erpItemCode,
      productType: r.productType || undefined,
      productSize: r.productSize || undefined,
      productYield: r.productYield ? parseFloat(r.productYield) : undefined,
      productWeight: r.productWeight ? parseFloat(r.productWeight) : undefined,
      productSpeed: r.productSpeed ? parseFloat(r.productSpeed) : undefined,
      icutSpeed: r.icutSpeed ? parseFloat(r.icutSpeed) : undefined,
      minProductLead: r.minProductLead ? parseInt(r.minProductLead) : undefined,
      maxProductLead: r.maxProductLead ? parseInt(r.maxProductLead) : undefined,
      isExternalRmAllowed: r.isExternalRmAllowed ? r.isExternalRmAllowed.toLowerCase() === 'true' : undefined,
    }));

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/product-spec/import-excel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: payloadRows }),
      });

      if (response.ok) {
        const data = await response.json();
        setSummary(data.summary);
        setStatus('done');
        setTimeout(() => {
          setRows([]);
          setStatus('idle');
          setSummary(null);
          onImportDone();
          onClose();
        }, 2500);
      } else {
        const err = await response.json().catch(() => ({}));
        setErrorMsg(err.message || 'Failed to import data');
        setStatus('error');
      }
    } catch {
      setErrorMsg('Error connecting to the server');
      setStatus('error');
    }
  };

  const handleClose = () => {
    setRows([]);
    setStatus('idle');
    setErrorMsg('');
    setSummary(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-[95vw] max-w-5xl rounded-2xl shadow-xl border border-gray-200 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl shrink-0">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FileSpreadsheet size={20} className="text-orange-500" />
              Import Product Specs
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Download template → Fill in Excel → Upload back here → Import
            </p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-700 bg-white p-1 rounded-full shadow-sm border border-gray-200 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="px-6 py-4 flex items-center gap-4 border-b border-gray-100 shrink-0">
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-semibold hover:bg-emerald-100 transition-colors"
          >
            <Download size={16} />
            Download Template
          </button>

          <div className="h-8 w-px bg-gray-200"></div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-sm font-semibold hover:bg-blue-100 transition-colors"
          >
            <Upload size={16} />
            Upload Excel
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
          />

          {rows.length > 0 && (
            <span className="text-sm text-gray-600 ml-2">
              <span className="font-bold text-orange-600">{rows.length}</span> rows loaded
            </span>
          )}
        </div>

        {/* Data Preview */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <FileSpreadsheet size={48} className="mb-4 opacity-30" />
              <p className="text-sm font-medium mb-1">No data loaded yet</p>
              <p className="text-xs">Download the template, fill it in Excel, then upload it here.</p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2.5 text-center font-semibold text-gray-400 border-b border-r border-gray-200 w-10">#</th>
                      {COLUMNS.map(col => (
                        <th key={col.key} className="px-3 py-2.5 text-left font-semibold text-gray-600 border-b border-r border-gray-200 whitespace-nowrap">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-orange-50/30 transition-colors">
                        <td className="px-3 py-2 text-center text-gray-400 font-mono border-b border-r border-gray-100 text-[10px]">
                          {idx + 1}
                        </td>
                        {COLUMNS.map(col => (
                          <td key={col.key} className="px-3 py-2 border-b border-r border-gray-100 text-gray-800 font-medium whitespace-nowrap">
                            {row[col.key] || <span className="text-gray-300">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl flex justify-between items-center shrink-0">
          <div>
            {status === 'error' && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle size={16} /> {errorMsg}
              </div>
            )}
            {status === 'done' && summary && (
              <div className="flex items-center gap-3 text-sm">
                <span className="flex items-center gap-1 text-emerald-600 font-semibold"><CheckCircle size={16} /> Success</span>
                <span className="text-gray-600 ml-2">Created: <b>{summary.created}</b></span>
                <span className="text-gray-600">Updated: <b>{summary.updated}</b></span>
                <span className="text-gray-600">Skipped: <b>{summary.skipped}</b></span>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={handleClose} className="px-5 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={rows.length === 0 || status === 'importing' || status === 'done'}
              className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-red-500 rounded-xl shadow-md hover:from-orange-600 hover:to-red-600 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload size={16} />
              {status === 'importing' ? 'Importing...' : `Import ${rows.length} Rows`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
