import { useState, useRef } from 'react';
import { X, Upload, Download, AlertCircle, CheckCircle, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

// Column definitions for each plan type
const COLUMNS: Record<string, { key: string; label: string }[]> = {
  monthly: [
    { key: 'receive_date', label: 'Receive Date' },
    { key: 'chicken_type', label: 'Chicken Type' },
    { key: 'chicken_count', label: 'Count (Birds)' },
    { key: 'chicken_weight', label: 'Weight (Kg)' },
  ],
  weekly: [
    { key: 'receive_date', label: 'Receive Date' },
    { key: 'chicken_type', label: 'Chicken Type' },
    { key: 'chicken_count', label: 'Count (Birds)' },
    { key: 'chicken_weight', label: 'Weight (Kg)' },
    { key: 'farm_name', label: 'Farm Name' },
    { key: 'farm_name_standard', label: 'Std Farm Name' },
    { key: 'house', label: 'House' },
    { key: 'health', label: 'Health' },
    { key: 'shift', label: 'Shift' },
    { key: 'sex', label: 'Sex' },
    { key: 'batch', label: 'Batch' },
  ],
  daily: [
    { key: 'receive_date', label: 'Receive Date' },
    { key: 'receive_time', label: 'Receive Time' },
    { key: 'chicken_type', label: 'Chicken Type' },
    { key: 'chicken_count', label: 'Count (Birds)' },
    { key: 'chicken_weight', label: 'Weight (Kg)' },
    { key: 'farm_name', label: 'Farm Name' },
    { key: 'farm_name_standard', label: 'Std Farm Name' },
    { key: 'house', label: 'House' },
    { key: 'shift', label: 'Shift' },
    { key: 'sex', label: 'Sex' },
    { key: 'sublot', label: 'Sublot' },
  ],
};

// Sample data for template per type
const SAMPLE_DATA: Record<string, Record<string, string>> = {
  monthly: {
    'Receive Date': '12/5/2026',
    'Chicken Type': 'ไก่เนื้อ',
    'Count (Birds)': '27355',
    'Weight (Kg)': '31390',
  },
  weekly: {
    'Receive Date': '12/5/2026',
    'Chicken Type': 'ไก่เนื้อ',
    'Count (Birds)': '2970',
    'Weight (Kg)': '8019',
    'Farm Name': 'ฟาร์มตัวอย่าง',
    'Std Farm Name': 'STD-FARM-001',
    'House': '1',
    'Health': 'ปกติ',
    'Shift': 'A',
    'Sex': 'ผู้',
    'Batch': '01',
  },
  daily: {
    'Receive Date': '12/5/2026',
    'Receive Time': '3:50:00',
    'Chicken Type': 'ไก่เนื้อ',
    'Count (Birds)': '2970',
    'Weight (Kg)': '8019',
    'Farm Name': 'ฟาร์มตัวอย่าง',
    'Std Farm Name': 'STD-FARM-001',
    'House': '1',
    'Shift': 'A',
    'Sex': 'ผู้',
    'Sublot': '01',
  },
};

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  onImportDone: () => void;
}

function computeAvg(count: number, weight: number): string {
  if (count > 0 && weight > 0) return (weight / count).toFixed(2);
  return '0.00';
}

export default function ImportModal({ isOpen, onClose, activeTab, onImportDone }: ImportModalProps) {
  const columns = COLUMNS[activeTab] || COLUMNS['monthly'];
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [status, setStatus] = useState<'idle' | 'importing' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Download Template ---
  const handleDownloadTemplate = () => {
    const headers = columns.map(c => c.label);
    const sampleRow = columns.map(c => SAMPLE_DATA[activeTab]?.[c.label] || '');

    const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);

    // Set column widths
    ws['!cols'] = columns.map(() => ({ wch: 18 }));

    const wb = XLSX.utils.book_new();
    const tabLabel = activeTab === 'monthly' ? 'Monthly' : activeTab === 'weekly' ? 'Weekly' : 'Daily';
    XLSX.utils.book_append_sheet(wb, ws, `${tabLabel} Plan`);
    XLSX.writeFile(wb, `chicken_receiving_${activeTab}_template.xlsx`);
  };

  // --- Upload & Parse Excel ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus('idle');
    setErrorMsg('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonDataRaw = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '', raw: true });
        const jsonDataFormatted = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '', raw: false });

        // Map Excel column labels to our keys
        let parsed = jsonDataRaw.map((rawExcelRow, idx) => {
          const formattedExcelRow = jsonDataFormatted[idx] || {};
          const row: Record<string, string> = {};
          
          columns.forEach(col => {
            const rawVal = rawExcelRow[col.label];
            const formattedVal = formattedExcelRow[col.label];
            
            // If the library returns a number for date, it's an Excel serial date.
            // We manually convert it using UTC to completely avoid any Timezone offset (-1 day) bugs.
            if (col.key === 'receive_date' && typeof rawVal === 'number') {
               const excelEpoch = new Date(Date.UTC(1899, 11, 30));
               const jsDate = new Date(excelEpoch.getTime() + rawVal * 86400000);
               const d = String(jsDate.getUTCDate()).padStart(2, '0');
               const m = String(jsDate.getUTCMonth() + 1).padStart(2, '0');
               const y = jsDate.getUTCFullYear();
               row[col.key] = `${y}-${m}-${d}`;
            } else {
               // Fallback to formatted text to preserve 'Receive Time' and other strings
               row[col.key] = formattedVal !== undefined && formattedVal !== null ? String(formattedVal).trim() : '';
            }
          });
          
          // Format date and time if present
          if (row.receive_date) {
              const dateStr = String(row.receive_date).trim();
              const separator = dateStr.includes('/') ? '/' : (dateStr.includes('-') ? '-' : null);
              
              if (separator) {
                  const parts = dateStr.split(separator);
                  if (parts.length === 3) {
                      let d, m, y;
                      
                      if (parts[0].length === 4) {
                          // Case: YYYY/MM/DD (International Standard)
                          y = parts[0];
                          m = parts[1];
                          d = parts[2];
                      } else {
                          // Case: DD/MM/YYYY (User's Requirement)
                          // We strictly map parts[0] to Day and parts[1] to Month
                          d = parts[0];
                          m = parts[1];
                          y = parts[2];
                          if (y.length === 2) y = '20' + y;
                      }
                      
                      // Ensure double digits
                      const finalDay = d.padStart(2, '0');
                      const finalMonth = m.padStart(2, '0');
                      const finalYear = y;
                      
                      // Final DB format: YYYY-MM-DD
                      row.receive_date = `${finalYear}-${finalMonth}-${finalDay}`;
                  }
              }
          }
          if (row.receive_time) {
              const timeParts = row.receive_time.split(':');
              if (timeParts.length >= 2) {
                  const h = timeParts[0].padStart(2, '0');
                  const m = timeParts[1].padStart(2, '0');
                  const s = timeParts[2] ? timeParts[2].padStart(2, '0') : '00';
                  row.receive_time = `${h}:${m}:${s}`;
              }
          }

          // Clean numbers
          if (row.chicken_count) row.chicken_count = row.chicken_count.replace(/,/g, '');
          if (row.chicken_weight) row.chicken_weight = row.chicken_weight.replace(/,/g, '');
          // Auto-calc avg
          row.chicken_avg = computeAvg(Number(row.chicken_count), Number(row.chicken_weight));
          return row;
        });

        // Filter out rows with empty, null, or zero chicken_count
        parsed = parsed.filter(row => {
          const countStr = row.chicken_count ? row.chicken_count.trim() : '';
          const countNum = Number(countStr);
          return countStr !== '' && !isNaN(countNum) && countNum > 0;
        });

        setRows(parsed);
      } catch {
        setErrorMsg('Cannot read the Excel file. Please use the template.');
        setStatus('error');
      }
    };
    reader.readAsArrayBuffer(file);

    // Reset input so the same file can be re-uploaded
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Import to Backend ---
  const handleImport = async () => {
    if (rows.length === 0) return;
    setStatus('importing');
    setErrorMsg('');

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chicken-receiving/${activeTab}/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });

      if (response.ok) {
        setStatus('done');
        setTimeout(() => {
          setRows([]);
          setStatus('idle');
          onImportDone();
          onClose();
        }, 1500);
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
    onClose();
  };

  if (!isOpen) return null;

  const tabLabel = activeTab === 'monthly' ? 'Monthly' : activeTab === 'weekly' ? 'Weekly' : 'Daily';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-[95vw] max-w-6xl rounded-2xl shadow-xl border border-gray-200 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl shrink-0">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FileSpreadsheet size={20} className="text-orange-500" />
              Import {tabLabel} Plan
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
                      {columns.map(col => (
                        <th key={col.key} className="px-3 py-2.5 text-left font-semibold text-gray-600 border-b border-r border-gray-200 whitespace-nowrap">
                          {col.label}
                        </th>
                      ))}
                      <th className="px-3 py-2.5 text-left font-semibold text-emerald-700 border-b border-gray-200 whitespace-nowrap bg-emerald-50/50">
                        Avg (Kg/Bird)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-orange-50/30 transition-colors">
                        <td className="px-3 py-2 text-center text-gray-400 font-mono border-b border-r border-gray-100 text-[10px]">
                          {idx + 1}
                        </td>
                        {columns.map(col => (
                          <td key={col.key} className="px-3 py-2 border-b border-r border-gray-100 text-gray-800 font-medium whitespace-nowrap">
                            {row[col.key] || <span className="text-gray-300">—</span>}
                          </td>
                        ))}
                        <td className="px-3 py-2 border-b border-gray-100 text-emerald-700 font-bold whitespace-nowrap bg-emerald-50/20 text-center">
                          {row.chicken_avg || '—'}
                        </td>
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
            {status === 'done' && (
              <div className="flex items-center gap-2 text-emerald-600 text-sm font-semibold">
                <CheckCircle size={16} /> Imported {rows.length} rows successfully!
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
