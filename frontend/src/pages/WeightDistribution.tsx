import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Save, Plus, Trash2, Loader2, CheckCircle2, AlertTriangle, Scale, Grid3X3, Scissors, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API = import.meta.env.VITE_API_URL;

/* ════════════════════════════════════════════════════════════
   Tab definitions
   ════════════════════════════════════════════════════════════ */
const TABS = [
  { key: 'weight', label: 'Weight Distribution', icon: Scale },
  { key: 'fillet', label: 'Fillet Size', icon: Scissors },
  { key: 'bil', label: 'Bone-In Leg', icon: Layers },
] as const;
type TabKey = (typeof TABS)[number]['key'];

interface FilletGroup {
  id: string;
  name: string;
}



const WeightDistributionPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('weight');
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

  // ─── Fillet Size state ───
  const [filletYield, setFilletYield] = useState(0.04);
  const [filletGroups, setFilletGroups] = useState<FilletGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [filletAssignments, setFilletAssignments] = useState<Record<string, string>>({});

  // ─── BIL state ───
  const [bilRowLabels, setBilRowLabels] = useState<string[]>([]);
  const [bilColLabels, setBilColLabels] = useState<string[]>([]);
  const [blColLabelsMap, setBlColLabelsMap] = useState<Record<string, string>>({});
  const [bilMatrix, setBilMatrix] = useState<Record<string, Record<string, number>>>({});
  const [bilDirty, setBilDirty] = useState(false);
  const [newBilRowInput, setNewBilRowInput] = useState('');
  const [newBilColInput, setNewBilColInput] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [wdRes, filletRes, bilRes] = await Promise.all([
        fetch(`${API}/api/weight-distribution`),
        fetch(`${API}/api/fillet-size`),
        fetch(`${API}/api/bil-weight-distribution`),
      ]);
      if (wdRes.ok) {
        const d = await wdRes.json();
        setRowLabels(d.rowLabels || []);
        setColLabels(d.colLabels || []);
        setMatrix(d.matrix || {});
        setDirty(false);
      }
      if (bilRes.ok) {
        const d = await bilRes.json();
        setBilRowLabels(d.rowLabels || []);
        setBilColLabels(d.colLabels || []);
        setBlColLabelsMap(d.blColLabelsMap || {});
        setBilMatrix(d.matrix || {});
        setBilDirty(false);
      }
      if (filletRes.ok) {
        const f = await filletRes.json();
        setFilletYield(f.filletYield ?? 0.04);
        setFilletGroups((f.groups || []).map((g: any) => ({
          id: String(g.id),
          name: g.name
        })));

        // Populate assignments from saved calcs
        const assignments: Record<string, string> = {};
        (f.calcs || []).forEach((c: any) => {
          if (c.groupName) assignments[c.colLabel] = c.groupName;
        });
        setFilletAssignments(assignments);
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

  // ─── BIL Matrix helpers ───
  const setBilCellValue = useCallback((row: string, col: string, val: number) => {
    setBilMatrix(prev => ({
      ...prev,
      [row]: { ...(prev[row] || {}), [col]: val }
    }));
    setBilDirty(true);
  }, []);

  const getBilCell = useCallback((row: string, col: string) => {
    return bilMatrix[row]?.[col] ?? 0;
  }, [bilMatrix]);

  const getBilRowTotal = useCallback((row: string) => {
    return bilColLabels.reduce((sum, col) => sum + (bilMatrix[row]?.[col] ?? 0), 0);
  }, [bilMatrix, bilColLabels]);

  const addBilRow = () => {
    const label = newBilRowInput.trim();
    if (!label || bilRowLabels.includes(label)) return;
    setBilRowLabels(prev => [...prev, label].sort((a, b) => parseFloat(a) - parseFloat(b) || a.localeCompare(b)));
    setBilMatrix(prev => ({ ...prev, [label]: {} }));
    setNewBilRowInput('');
    setBilDirty(true);
  };

  const addBilCol = () => {
    const label = newBilColInput.trim();
    if (!label || bilColLabels.includes(label)) return;
    setBilColLabels(prev => [...prev, label]);
    setNewBilColInput('');
    setBilDirty(true);
  };

  const removeBilRow = (label: string) => {
    setBilRowLabels(prev => prev.filter(r => r !== label));
    setBilMatrix(prev => { const n = { ...prev }; delete n[label]; return n; });
    setBilDirty(true);
  };

  const removeBilCol = (label: string) => {
    setBilColLabels(prev => prev.filter(c => c !== label));
    setBlColLabelsMap(prev => {
      const n = { ...prev };
      delete n[label];
      return n;
    });
    setBilMatrix(prev => {
      const n: Record<string, Record<string, number>> = {};
      for (const row of Object.keys(prev)) {
        const rowData = { ...prev[row] };
        delete rowData[label];
        n[row] = rowData;
      }
      return n;
    });
    setBilDirty(true);
  };

  const handleBilSave = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${API}/api/bil-weight-distribution/bulk-save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowLabels: bilRowLabels, colLabels: bilColLabels, blColLabelsMap, matrix: bilMatrix }),
      });
      const d = await r.json();
      if (d.success) {
        showToast(`บันทึกสำเร็จ (${d.count} cells)`, 'success');
        setBilDirty(false);
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
        {activeTab === 'weight' && (
          <button onClick={handleSave} disabled={saving || !dirty}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg transition-all ${dirty && !saving
              ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-orange-200'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'}`}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            บันทึกทั้งหมด
            {dirty && <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-[10px]">มีการแก้ไข</span>}
          </button>
        )}
      </div>

      {/* ═══ TABS ═══ */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${isActive
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ═══ TAB: Weight Distribution ═══ */}
      {activeTab === 'weight' && (
        <>
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
        </>
      )}

      {/* ═══ TAB: Fillet Size ═══ */}
      {activeTab === 'fillet' && (() => {
        // ── Parse column labels to numbers ──
        const parseColValue = (label: string): number => {
          const cleaned = label.replace(/[^0-9.\-]/g, '');
          // Handle range like "50-65" → midpoint
          if (cleaned.includes('-')) {
            const parts = cleaned.split('-').map(Number).filter(n => !isNaN(n));
            if (parts.length === 2) return (parts[0] + parts[1]) / 2;
            if (parts.length === 1) return parts[0];
          }
          const n = parseFloat(cleaned);
          return isNaN(n) ? 0 : n;
        };

        const filletData = colLabels.map(col => {
          const colVal = parseColValue(col);
          const lbWeight = colVal / 0.8;
          const filletSize = Math.round((filletYield * lbWeight * 1000) / 2);
          return { col, colVal, lbWeight, filletSize };
        });

        // ── Remove group (API) ──
        const removeGroup = async (id: string) => {
          if (!window.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบกลุ่มนี้?")) return;
          try {
            await fetch(`${API}/api/fillet-size/groups/${id}`, { method: 'DELETE' });
            setFilletGroups(prev => prev.filter(g => g.id !== id));
            showToast('ลบ Group สำเร็จ', 'success');
          } catch { showToast('เกิดข้อผิดพลาดในการลบ Group', 'error'); }
        };

        // ── Save/Update group (API) ──
        const saveGroup = async () => {
          const name = newGroupName.trim();
          if (!name) return;
          try {
            const method = 'POST';
            const url = editingGroupId
              ? `${API}/api/fillet-size/groups/${editingGroupId}`
              : `${API}/api/fillet-size/groups`;

            const r = await fetch(url, {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name }),
            });
            const d = await r.json();
            if (d.success) {
              await fetchData();
              setNewGroupName('');
              setEditingGroupId(null);
              setIsGroupModalOpen(false);
              showToast(editingGroupId ? 'แก้ไข Group สำเร็จ' : 'เพิ่ม Group สำเร็จ', 'success');
            }
          } catch { showToast('เกิดข้อผิดพลาด', 'error'); }
        };

        // ── Group colors ──
        const groupColors = [
          { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' },
          { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
          { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
          { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-700' },
          { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700' },
          { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', badge: 'bg-cyan-100 text-cyan-700' },
          { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700' },
        ];
        const getGroupColor = (idx: number) => groupColors[idx % groupColors.length];

        return (
          <div className="space-y-5">
            {/* ─── Banner & Yield ─── */}
            <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-5 flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg">
                  <Scissors className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-violet-900">Fillet Size Analysis</h3>
                  <p className="text-xs text-violet-600 mt-1">คำนวณ Fillet Size และจัดกลุ่มตามต้องการ (Object Assignment)</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-violet-500 font-mono">
                    <span>LB Weight = Chicken C Weight ÷ 80%</span>
                    <span>•</span>
                    <span>Fillet Size = (Yield × LB × 1000) ÷ 2</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-white rounded-xl border border-violet-200 shadow-sm px-4 py-2.5">
                <span className="text-xs font-semibold text-violet-600 uppercase tracking-wider">Fillet Yield:</span>
                <input
                  type="number" step="0.01" min="0" max="1"
                  value={filletYield || ''}
                  onChange={e => setFilletYield(parseFloat(e.target.value) || 0)}
                  onBlur={async () => {
                    try {
                      await fetch(`${API}/api/fillet-size/yield`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ filletYield }),
                      });
                      showToast(`บันทึก Fillet Yield ${(filletYield * 100).toFixed(0)}% สำเร็จ`, 'success');
                    } catch { /* silent */ }
                  }}
                  onFocus={e => e.target.select()}
                  className="w-20 border border-violet-200 rounded-lg px-2.5 py-1.5 text-sm font-mono text-center focus:ring-2 focus:ring-violet-300 outline-none"
                />
                <span className="text-xs text-gray-400">({(filletYield * 100).toFixed(0)}%)</span>
              </div>
            </div>

            {/* ─── Table 1: Groups ─── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Fillet Groups</h3>
                    <p className="text-[11px] text-gray-500">จัดการรายชื่อกลุ่มเพื่อนำไป Assign</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditingGroupId(null);
                    setNewGroupName('');
                    setIsGroupModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold transition-all shadow-md shadow-amber-100"
                >
                  <Plus className="w-3.5 h-3.5" /> เพิ่มกลุ่ม
                </button>
              </div>

              {filletGroups.length === 0 ? (
                <div className="p-10 text-center">
                  <Layers className="w-10 h-10 mx-auto text-gray-200 mb-3" />
                  <p className="text-gray-400 text-sm italic">ยังไม่มีกลุ่ม — คลิกปุ่ม "เพิ่มกลุ่ม" เพื่อเริ่มต้น</p>
                </div>
              ) : (
                <div className="overflow-auto max-h-[300px]">
                  <table className="text-sm border-collapse min-w-full">
                    <thead className="sticky top-0 bg-gray-50 z-10">
                      <tr>
                        <th className="px-6 py-3 text-left text-[11px] font-bold text-gray-500 uppercase border-b border-gray-100">Group Name</th>
                        <th className="px-6 py-3 text-center text-[11px] font-bold text-gray-500 uppercase border-b border-gray-100">Assigned Count</th>
                        <th className="px-6 py-3 text-center text-xs border-b border-gray-100 w-24"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filletGroups.map((g, gIdx) => {
                        const count = Object.values(filletAssignments).filter(name => name === g.name).length;
                        const color = getGroupColor(gIdx);
                        return (
                          <tr key={g.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-lg text-xs font-bold ${color.badge}`}>{g.name}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="font-bold text-gray-700">{count}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex justify-center gap-2">
                                <button
                                  onClick={() => {
                                    setEditingGroupId(g.id);
                                    setNewGroupName(g.name);
                                    setIsGroupModalOpen(true);
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                >
                                  <Save className="w-4 h-4" /> {/* Use Save as Edit icon or similar */}
                                </button>
                                <button
                                  onClick={() => removeGroup(g.id)}
                                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ─── Table 2: Assignments ─── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-violet-100 text-violet-600">
                    <Scissors className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Calculated Fillet Sizes</h3>
                    <p className="text-[11px] text-gray-500">เลือก Group สำหรับแต่ละรายการเพื่อนำไปใช้งานต่อ</p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    try {
                      setSaving(true);
                      const items = filletData.map(d => ({
                        colLabel: d.col,
                        lbWeight: d.lbWeight,
                        filletSize: d.filletSize,
                        groupName: filletAssignments[d.col] || null,
                      }));
                      const r = await fetch(`${API}/api/fillet-size/calc/save`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ items }),
                      });
                      const d = await r.json();
                      if (d.success) showToast(`บันทึกการจัดกลุ่มสำเร็จ (${d.count} รายการ)`, 'success');
                    } catch { showToast('เกิดข้อผิดพลาดในการบันทึก', 'error'); }
                    finally { setSaving(false); }
                  }}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-semibold transition-all shadow-md shadow-violet-100 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  บันทึกการจัดกลุ่ม
                </button>
              </div>

              {colLabels.length === 0 ? (
                <div className="p-16 text-center">
                  <Grid3X3 className="w-12 h-12 mx-auto text-gray-200 mb-3" />
                  <p className="text-gray-400 text-sm">ยังไม่มี Chicken C Weight ในระบบ</p>
                </div>
              ) : (
                <div className="overflow-auto max-h-[500px]">
                  <table className="text-sm border-collapse min-w-full">
                    <thead className="sticky top-0 bg-gray-50 z-10 shadow-sm">
                      <tr>
                        <th className="px-6 py-3 text-left text-[11px] font-bold text-gray-500 uppercase border-b border-gray-100 w-12">#</th>
                        <th className="px-6 py-3 text-left text-[11px] font-bold text-gray-500 uppercase border-b border-gray-100">Chicken C Weight</th>
                        <th className="px-6 py-3 text-right text-[11px] font-bold text-gray-500 uppercase border-b border-gray-100">LB Weight</th>
                        <th className="px-6 py-3 text-right text-[11px] font-bold text-gray-500 uppercase border-b border-gray-100">Fillet Size (g)</th>
                        <th className="px-6 py-3 text-center text-[11px] font-bold text-gray-500 uppercase border-b border-gray-100">Assign to Group</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filletData.map((item, idx) => {
                        const currentGroup = filletAssignments[item.col];
                        return (
                          <tr key={item.col} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-3 text-xs text-gray-400 font-mono">{idx + 1}</td>
                            <td className="px-6 py-3 font-semibold text-gray-700">{item.col}</td>
                            <td className="px-6 py-3 text-right font-mono text-blue-600">{item.lbWeight.toFixed(2)}</td>
                            <td className="px-6 py-3 text-right">
                              <span className="font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">{item.filletSize}g</span>
                            </td>
                            <td className="px-6 py-3 text-center">
                              <select
                                value={currentGroup || ''}
                                onChange={e => setFilletAssignments(prev => ({ ...prev, [item.col]: e.target.value }))}
                                className={`w-full max-w-[200px] border rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-violet-300 transition-all ${currentGroup ? 'bg-violet-50 border-violet-200 text-violet-700 font-bold' : 'bg-white border-gray-200 text-gray-400'
                                  }`}
                              >
                                <option value="">-- เลือกกลุ่ม --</option>
                                {filletGroups.map(g => (
                                  <option key={g.id} value={g.name}>{g.name}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ─── Group Modal (ChickenReceiving Style) ─── */}
            <AnimatePresence>
              {isGroupModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
                  >
                    {/* Modal Header */}
                    <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        {editingGroupId ? <Layers className="text-amber-500 w-5 h-5" /> : <Plus className="text-amber-500 w-5 h-5" />}
                        {editingGroupId ? 'แก้ไขกลุ่ม Fillet' : 'เพิ่มกลุ่ม Fillet'}
                      </h3>
                      <button
                        onClick={() => setIsGroupModalOpen(false)}
                        className="text-gray-400 hover:text-gray-700 bg-white p-1 rounded-full shadow-sm border border-gray-200 transition-colors"
                      >
                        <Trash2 className="w-4 h-4 rotate-45" /> {/* Close icon using rotated trash or X */}
                      </button>
                    </div>

                    {/* Modal Body */}
                    <div className="px-6 py-6 space-y-5">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">ชื่อกลุ่ม (Group Name)</label>
                        <input
                          type="text"
                          placeholder="เช่น 40 Down, 45-50 ..."
                          value={newGroupName}
                          onChange={e => setNewGroupName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveGroup()}
                          autoFocus
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 outline-none transition-all shadow-sm"
                        />
                        <p className="text-[10px] text-gray-400 mt-2 italic">* ชื่อกลุ่มจะแสดงใน Dropdown สำหรับ Assign</p>
                      </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-between items-center">
                      <div>
                        {editingGroupId && (
                          <button
                            onClick={() => removeGroup(editingGroupId)}
                            className="text-red-500 hover:text-red-700 text-xs font-bold hover:underline"
                          >
                            ลบกลุ่มนี้
                          </button>
                        )}
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setIsGroupModalOpen(false)}
                          className="px-5 py-2.5 text-xs font-bold text-gray-600 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
                        >
                          ยกเลิก
                        </button>
                        <button
                          onClick={saveGroup}
                          className="px-6 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl shadow-md hover:from-amber-600 hover:to-orange-600 transition-all flex items-center gap-2"
                        >
                          <Save className="w-4 h-4" />
                          {editingGroupId ? 'บันทึกการแก้ไข' : 'สร้างกลุ่มใหม่'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        );
      })()}
      {/* ═══ TAB: Bone-In Leg (BIL) ═══ */}
      {/* ═══ TAB: Bone-In Leg (BIL) ═══ */}
      {activeTab === 'bil' && (
        <>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Layers className="text-orange-500 w-6 h-6" />
                Bone-In Leg Matrix
              </h2>
              <p className="text-sm text-gray-500 mt-1">ตั้งค่าเมทริกซ์การกระจายน้ำหนักสำหรับ Bone-In Leg (Live Weight → BIL Size)</p>
            </div>
            <button onClick={handleBilSave} disabled={saving || !bilDirty}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg transition-all ${bilDirty && !saving
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-orange-500/30'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'}`}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'กำลังบันทึก...' : bilDirty ? 'บันทึกการเปลี่ยนแปลง' : 'ข้อมูลล่าสุดแล้ว'}
            </button>
          </div>

          {/* ═══ STATS ═══ */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Rows (Live Weight)" value={bilRowLabels.length} icon={Scale} color="blue" />
            <StatCard label="Columns (BIL Size)" value={bilColLabels.length} icon={Grid3X3} color="orange" />
            <StatCard label="Total Cells" value={bilRowLabels.length * bilColLabels.length} icon={Grid3X3} color="purple" />
            <StatCard label="Filled Cells" value={`${bilRowLabels.reduce((acc, row) => acc + bilColLabels.filter(col => (bilMatrix[row]?.[col] ?? 0) > 0).length, 0)} / ${bilRowLabels.length * bilColLabels.length}`} icon={CheckCircle2} color="green" />
          </div>

          {/* ═══ ADD ROW / COL ═══ */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-2.5">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Row:</span>
              <input type="text" placeholder="เช่น 1.10-1.39, 1.40-1.49 ..." value={newBilRowInput}
                onChange={e => setNewBilRowInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addBilRow()}
                className="w-40 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none" />
              <button onClick={addBilRow} className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-medium transition-colors">
                <Plus className="w-3.5 h-3.5" /> เพิ่มแถว
              </button>
            </div>
            <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-2.5">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Col:</span>
              <input type="text" placeholder="เช่น 180 g down, 180-210 ..." value={newBilColInput}
                onChange={e => setNewBilColInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addBilCol()}
                className="w-40 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none" />
              <button onClick={addBilCol} className="flex items-center gap-1 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-medium transition-colors">
                <Plus className="w-3.5 h-3.5" /> เพิ่มคอลัมน์
              </button>
            </div>
          </div>

          {/* ═══ MATRIX TABLE ═══ */}
          {bilRowLabels.length === 0 && bilColLabels.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center mb-6">
              <Grid3X3 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 font-medium text-lg">ยังไม่มีข้อมูลเมทริกซ์ BIL</p>
              <p className="text-gray-400 text-sm mt-1">เพิ่ม Row (Live Weight) และ Column (BIL Size) ด้านบนเพื่อเริ่มต้น</p>
            </div>
          ) : (
            <div ref={tableRef} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-auto max-h-[65vh] mb-6">
              <table className="text-sm border-collapse min-w-full">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-gradient-to-r from-orange-50 to-amber-50">
                    <th className="sticky left-0 z-30 bg-orange-100 px-4 py-3 text-xs font-bold text-orange-800 uppercase tracking-wider border-b border-r border-orange-200 min-w-[120px]">
                      Live Weight ↓
                    </th>
                    {bilColLabels.map(col => (
                      <th key={col} className="px-2 py-3 text-center border-b border-orange-200 min-w-[100px]">
                        <div className="flex flex-col items-center gap-2">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-500 font-bold uppercase">BIL:</span>
                            <span className="text-xs font-bold text-orange-900">{col}</span>
                            <button onClick={() => removeBilCol(col)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-100 text-red-400 hover:text-red-600 transition-all" title="ลบคอลัมน์">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="flex items-center gap-1 w-full mt-1">
                            <span className="text-[10px] text-blue-500 font-bold uppercase">BL:</span>
                            <input
                              type="text"
                              value={blColLabelsMap[col] || ''}
                              onChange={e => {
                                setBlColLabelsMap(prev => ({ ...prev, [col]: e.target.value }));
                                setBilDirty(true);
                              }}
                              placeholder="BL Size"
                              className="w-full text-center text-xs text-blue-700 bg-white border border-blue-200 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                            />
                          </div>
                        </div>
                      </th>
                    ))}
                    <th className="px-3 py-3 text-center border-b border-l-2 border-orange-300 bg-amber-100 min-w-[80px]">
                      <span className="text-xs font-bold text-amber-800 uppercase">Total</span>
                    </th>
                    <th className="px-2 py-3 border-b border-orange-200 bg-orange-50 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {bilRowLabels.map((row, rowIdx) => {
                    const total = getBilRowTotal(row);
                    const totalOk = Math.abs(total - 1) < 0.001;
                    const totalOver = total > 1.001;
                    return (
                      <tr key={row} className={`group transition-colors ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-orange-50/20'} hover:bg-orange-50/60`}>
                        <td className={`sticky left-0 z-10 px-4 py-2 font-bold text-sm border-r border-gray-200 ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-orange-50/20'} group-hover:bg-orange-50`}>
                          <div className="flex items-center justify-between">
                            <span className="text-blue-800">{row}</span>
                            <button onClick={() => removeBilRow(row)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-100 text-red-400 hover:text-red-600 transition-all" title="ลบแถว">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        {bilColLabels.map(col => {
                          const val = getBilCell(row, col);
                          const hasValue = val > 0;
                          return (
                            <td key={col} className="px-1 py-1 text-center border-gray-100">
                              <input
                                type="number" step="0.000001" min="0" max="1"
                                value={val || ''}
                                placeholder="0"
                                onChange={e => {
                                  const v = parseFloat(e.target.value);
                                  setBilCellValue(row, col, isNaN(v) ? 0 : v);
                                }}
                                onFocus={e => e.target.select()}
                                className={`w-full text-center rounded-lg px-1 py-1.5 text-xs font-mono outline-none transition-all border
                                ${hasValue
                                    ? 'bg-orange-50 border-orange-200 text-orange-900 font-semibold focus:ring-2 focus:ring-orange-300 focus:border-orange-400'
                                    : 'bg-white border-gray-200 text-gray-400 focus:ring-2 focus:ring-orange-300 focus:border-orange-400'
                                  }`}
                              />
                            </td>
                          );
                        })}
                        <td className={`px-3 py-2 text-center font-bold text-xs font-mono border-l-2 border-orange-200
                        ${totalOk ? 'bg-green-50 text-green-700' : totalOver ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>
                          <div className="flex items-center justify-center gap-1">
                            {totalOk ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : totalOver ? <AlertTriangle className="w-3 h-3 text-red-500" /> : null}
                            {total.toFixed(6)}
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
            <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded bg-orange-50 border border-orange-200"></div> มีค่า (&gt; 0)</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> Total = 1.0000 ✓</div>
            <div className="flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-red-500" /> Total &gt; 1.0000 (เกิน)</div>
            <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded bg-amber-50 border border-amber-200"></div> Total &lt; 1.0000 (ยังไม่ครบ)</div>
          </div>
        </>
      )}

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
