import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Save, Plus, Trash2, Loader2, CheckCircle2, AlertTriangle, Scale, Grid3X3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API = import.meta.env.VITE_API_URL;

const WeightDistributionPage: React.FC = () => {
  const [rowLabels, setRowLabels] = useState<string[]>([]);
  const [colLabels, setColLabels] = useState<string[]>([]);
  const [matrix, setMatrix] = useState<Record<string, Record<string, number>>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [newRowInput, setNewRowInput] = useState('');
  const [newColInput, setNewColInput] = useState('');
  const [dirty, setDirty] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/weight-distribution`);
      if (r.ok) {
        const d = await r.json();
        setRowLabels(d.rowLabels || []);
        setColLabels(d.colLabels || []);
        setMatrix(d.matrix || {});
        setDirty(false);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // ─── Matrix helpers ───
  const setCellValue = useCallback((row: string, col: string, val: number) => {
    setMatrix(prev => ({
      ...prev,
      [row]: { ...(prev[row] || {}), [col]: val }
    }));
    setDirty(true);
  }, []);

  const getCell = useCallback((row: string, col: string) => {
    return matrix[row]?.[col] ?? 0;
  }, [matrix]);

  const getRowTotal = useCallback((row: string) => {
    return colLabels.reduce((sum, col) => sum + (matrix[row]?.[col] ?? 0), 0);
  }, [matrix, colLabels]);

  // ─── Add Row ───
  const addRow = () => {
    const label = newRowInput.trim();
    if (!label || rowLabels.includes(label)) return;
    setRowLabels(prev => [...prev, label].sort((a, b) => parseFloat(a) - parseFloat(b) || a.localeCompare(b)));
    setMatrix(prev => ({ ...prev, [label]: {} }));
    setNewRowInput('');
    setDirty(true);
  };

  // ─── Add Column ───
  const addCol = () => {
    const label = newColInput.trim();
    if (!label || colLabels.includes(label)) return;
    setColLabels(prev => [...prev, label]);
    setNewColInput('');
    setDirty(true);
  };

  // ─── Remove Row ───
  const removeRow = (label: string) => {
    setRowLabels(prev => prev.filter(r => r !== label));
    setMatrix(prev => { const n = { ...prev }; delete n[label]; return n; });
    setDirty(true);
  };

  // ─── Remove Column ───
  const removeCol = (label: string) => {
    setColLabels(prev => prev.filter(c => c !== label));
    setMatrix(prev => {
      const n: Record<string, Record<string, number>> = {};
      for (const row of Object.keys(prev)) {
        const rowData = { ...prev[row] };
        delete rowData[label];
        n[row] = rowData;
      }
      return n;
    });
    setDirty(true);
  };

  // ─── Bulk Save ───
  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${API}/api/weight-distribution/bulk-save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowLabels, colLabels, matrix }),
      });
      const d = await r.json();
      if (d.success) {
        showToast(`บันทึกสำเร็จ (${d.count} cells)`, 'success');
        setDirty(false);
      } else {
        showToast('เกิดข้อผิดพลาด', 'error');
      }
    } catch { showToast('เกิดข้อผิดพลาด', 'error'); }
    finally { setSaving(false); }
  };

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const totalCells = rowLabels.length * colLabels.length;
  const filledCells = rowLabels.reduce((acc, row) => acc + colLabels.filter(col => (matrix[row]?.[col] ?? 0) > 0).length, 0);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-full mx-auto space-y-5">
      {/* ═══ HEADER ═══ */}
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Weight Distribution</h1>
          <p className="text-gray-500 mt-1">ตั้งค่าเมทริกซ์การกระจายน้ำหนัก (Live Weight → Product Size)</p>
        </div>
        <button onClick={handleSave} disabled={saving || !dirty}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg transition-all ${
            dirty && !saving
              ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-orange-200'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'}`}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          บันทึกทั้งหมด
          {dirty && <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-[10px]">มีการแก้ไข</span>}
        </button>
      </div>

      {/* ═══ STATS ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Rows (Live Weight)" value={rowLabels.length} icon={Scale} color="blue" />
        <StatCard label="Columns (Size)" value={colLabels.length} icon={Grid3X3} color="indigo" />
        <StatCard label="Total Cells" value={totalCells} icon={Grid3X3} color="purple" />
        <StatCard label="Filled Cells" value={`${filledCells} / ${totalCells}`} icon={CheckCircle2} color="green" />
      </div>

      {/* ═══ ADD ROW / COL ═══ */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-2.5">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Row:</span>
          <input type="text" placeholder="เช่น 1.8, 2.0 ..." value={newRowInput}
            onChange={e => setNewRowInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addRow()}
            className="w-28 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none" />
          <button onClick={addRow} className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-medium transition-colors">
            <Plus className="w-3.5 h-3.5" /> เพิ่มแถว
          </button>
        </div>
        <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-2.5">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Col:</span>
          <input type="text" placeholder="เช่น 50-65, 40 Down ..." value={newColInput}
            onChange={e => setNewColInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCol()}
            className="w-36 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none" />
          <button onClick={addCol} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-medium transition-colors">
            <Plus className="w-3.5 h-3.5" /> เพิ่มคอลัมน์
          </button>
        </div>
      </div>

      {/* ═══ MATRIX TABLE ═══ */}
      {rowLabels.length === 0 && colLabels.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center">
          <Grid3X3 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 font-medium text-lg">ยังไม่มีข้อมูลเมทริกซ์</p>
          <p className="text-gray-400 text-sm mt-1">เพิ่ม Row (Live Weight) และ Column (Product Size) ด้านบนเพื่อเริ่มต้น</p>
        </div>
      ) : (
        <div ref={tableRef} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-auto max-h-[65vh]">
          <table className="text-sm border-collapse min-w-full">
            <thead className="sticky top-0 z-20">
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100">
                {/* Top-left corner */}
                <th className="sticky left-0 z-30 bg-gray-100 px-4 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-r border-gray-200 min-w-[120px]">
                  Live Weight ↓
                </th>
                {colLabels.map(col => (
                  <th key={col} className="px-2 py-3 text-center border-b border-gray-200 min-w-[90px]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs font-bold text-indigo-700">{col}</span>
                      <button onClick={() => removeCol(col)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-100 text-red-400 hover:text-red-600 transition-all" title="ลบคอลัมน์">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </th>
                ))}
                {/* Row Total header */}
                <th className="px-3 py-3 text-center border-b border-l-2 border-gray-300 bg-amber-50 min-w-[80px]">
                  <span className="text-xs font-bold text-amber-700 uppercase">Total</span>
                </th>
                {/* Delete col placeholder */}
                <th className="px-2 py-3 border-b border-gray-200 bg-gray-50 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rowLabels.map((row, rowIdx) => {
                const total = getRowTotal(row);
                const totalOk = Math.abs(total - 1) < 0.001;
                const totalOver = total > 1.001;
                return (
                  <tr key={row} className={`group transition-colors ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-orange-50/40`}>
                    {/* Row label (sticky) */}
                    <td className={`sticky left-0 z-10 px-4 py-2 font-bold text-sm border-r border-gray-200 ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} group-hover:bg-orange-50`}>
                      <div className="flex items-center justify-between">
                        <span className="text-blue-800">{row}</span>
                        <button onClick={() => removeRow(row)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-100 text-red-400 hover:text-red-600 transition-all" title="ลบแถว">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    {/* Data cells */}
                    {colLabels.map(col => {
                      const val = getCell(row, col);
                      const hasValue = val > 0;
                      return (
                        <td key={col} className="px-1 py-1 text-center border-gray-100">
                          <input
                            type="number" step="0.01" min="0" max="1"
                            value={val || ''}
                            placeholder="0"
                            onChange={e => {
                              const v = parseFloat(e.target.value);
                              setCellValue(row, col, isNaN(v) ? 0 : v);
                            }}
                            onFocus={e => e.target.select()}
                            className={`w-full text-center rounded-lg px-1 py-1.5 text-xs font-mono outline-none transition-all border
                              ${hasValue
                                ? 'bg-blue-50 border-blue-200 text-blue-900 font-semibold focus:ring-2 focus:ring-blue-300 focus:border-blue-400'
                                : 'bg-white border-gray-200 text-gray-400 focus:ring-2 focus:ring-orange-300 focus:border-orange-400'
                              }`}
                          />
                        </td>
                      );
                    })}
                    {/* Row Total */}
                    <td className={`px-3 py-2 text-center font-bold text-xs font-mono border-l-2 border-gray-300
                      ${totalOk ? 'bg-green-50 text-green-700' : totalOver ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>
                      <div className="flex items-center justify-center gap-1">
                        {totalOk ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : totalOver ? <AlertTriangle className="w-3 h-3 text-red-500" /> : null}
                        {total.toFixed(4)}
                      </div>
                    </td>
                    <td className="w-10"></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ LEGEND ═══ */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded bg-blue-50 border border-blue-200"></div> มีค่า (&gt; 0)</div>
        <div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> Total = 1.0000 ✓</div>
        <div className="flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-red-500" /> Total &gt; 1.0000 (เกิน)</div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded bg-amber-50 border border-amber-200"></div> Total &lt; 1.0000 (ยังไม่ครบ)</div>
      </div>

      {/* ═══ TOAST ═══ */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium flex items-center gap-2
              ${toast.type === 'success' ? 'bg-gray-900 text-white' : 'bg-red-600 text-white'}`}>
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <AlertTriangle className="w-4 h-4 text-yellow-300" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Sub Components ───
const StatCard = ({ label, value, icon: Icon, color }: { label: string; value: any; icon: any; color: string }) => {
  const colors: Record<string, string> = {
    blue: 'from-blue-500 to-blue-600', indigo: 'from-indigo-500 to-indigo-600',
    purple: 'from-purple-500 to-purple-600', green: 'from-green-500 to-green-600',
  };
  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
      <div className={`p-3 rounded-xl bg-gradient-to-br ${colors[color]} text-white shadow-lg`}><Icon className="w-5 h-5" /></div>
      <div><p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p><p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p></div>
    </div>
  );
};

export default WeightDistributionPage;
