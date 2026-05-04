import React, { useState, useEffect } from 'react';
import { Search, Plus, Save, X, Loader2, Package, Edit3, Snowflake, Thermometer, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API = import.meta.env.VITE_API_URL;

const PRODUCT_TYPES = ['chilled', 'freeze'] as const;
const SIZE_PATTERNS = [
  { id: 'unsize', label: 'Unsize', format: 'unsize', fields: 0 },
  { id: 'range', label: 'XX-XX', format: '{0}-{1}', fields: 2 },
  { id: 'down', label: 'XX Down', format: '{0} Down', fields: 1 },
  { id: 'up', label: 'XX Up', format: '{0} Up', fields: 1 },
] as const;

type SizePatternId = typeof SIZE_PATTERNS[number]['id'];

const parseSizePattern = (sizeStr: string): { pattern: SizePatternId; num1: string; num2: string } => {
  if (!sizeStr || sizeStr === 'unsize') return { pattern: 'unsize', num1: '', num2: '' };
  const downMatch = sizeStr.match(/^(\d+)\s*Down$/i);
  if (downMatch) return { pattern: 'down', num1: downMatch[1], num2: '' };
  const upMatch = sizeStr.match(/^(\d+)\s*Up$/i);
  if (upMatch) return { pattern: 'up', num1: upMatch[1], num2: '' };
  const rangeMatch = sizeStr.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) return { pattern: 'range', num1: rangeMatch[1], num2: rangeMatch[2] };
  return { pattern: 'unsize', num1: '', num2: '' };
};

const buildSizeString = (pattern: SizePatternId, num1: string, num2: string): string => {
  if (pattern === 'unsize') return 'unsize';
  if (pattern === 'down') return `${num1} Down`;
  if (pattern === 'up') return `${num1} Up`;
  if (pattern === 'range') return `${num1}-${num2}`;
  return 'unsize';
};

interface ErpItem {
  id: number; erpItemId: number; erpItemCode: string; erpItemDesc: string; erpItemType: string;
}
interface Spec {
  id: number; erpItemId: number; erpItemCode: string; erpItemDesc: string; erpItemType: string;
  productType: string; productSize: string; productYield: number; productWeight: number;
  productSpeed: number; productLead: number; createdAt: string; updatedAt: string;
}

const ProductSpec: React.FC = () => {
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [erpItems, setErpItems] = useState<ErpItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<Spec>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // New spec form
  const [selectedItem, setSelectedItem] = useState<ErpItem | null>(null);
  const [form, setForm] = useState({ productType: 'chilled', productSize: 'unsize', productYield: 0.84, productWeight: 2, productSpeed: 45, productLead: 1 });
  const [formSizePattern, setFormSizePattern] = useState<SizePatternId>('unsize');
  const [formSizeNum1, setFormSizeNum1] = useState('');
  const [formSizeNum2, setFormSizeNum2] = useState('');
  const [editSizePattern, setEditSizePattern] = useState<SizePatternId>('unsize');
  const [editSizeNum1, setEditSizeNum1] = useState('');
  const [editSizeNum2, setEditSizeNum2] = useState('');
  const [itemSearch, setItemSearch] = useState('');

  useEffect(() => { fetchSpecs(); }, []);

  const fetchSpecs = async () => {
    try { const r = await fetch(`${API}/api/product-spec`); if (r.ok) setSpecs(await r.json()); } catch (e) { console.error(e); }
  };
  const fetchErpItems = async () => {
    try { const r = await fetch(`${API}/api/product-spec/erp-items`); if (r.ok) setErpItems(await r.json()); } catch (e) { console.error(e); }
  };

  const openAddModal = () => { fetchErpItems(); setSelectedItem(null); setForm({ productType: 'chilled', productSize: 'unsize', productYield: 0.84, productWeight: 2, productSpeed: 45, productLead: 1 }); setFormSizePattern('unsize'); setFormSizeNum1(''); setFormSizeNum2(''); setItemSearch(''); setIsModalOpen(true); };

  const updateFormSize = (pattern: SizePatternId, n1: string, n2: string) => {
    setFormSizePattern(pattern); setFormSizeNum1(n1); setFormSizeNum2(n2);
    setForm(f => ({ ...f, productSize: buildSizeString(pattern, n1, n2) }));
  };

  const handleTypeChange = (type: string) => {
    const lead = type === 'chilled' ? 1 : 5;
    setForm(f => ({ ...f, productType: type, productLead: lead }));
  };

  const handleSave = async () => {
    if (!selectedItem) return;
    setSaving(true);
    try {
      const r = await fetch(`${API}/api/product-spec`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ erpItemId: selectedItem.erpItemId, erpItemCode: selectedItem.erpItemCode, erpItemDesc: selectedItem.erpItemDesc, erpItemType: selectedItem.erpItemType, ...form }),
      });
      const d = await r.json();
      if (d.success) { showToast('บันทึก Product Spec สำเร็จ'); setIsModalOpen(false); fetchSpecs(); }
      else showToast(d.message || 'เกิดข้อผิดพลาด');
    } catch { showToast('เกิดข้อผิดพลาด'); } finally { setSaving(false); }
  };

  const startEdit = (spec: Spec) => {
    setEditingId(spec.id);
    setEditData({ productType: spec.productType, productSize: spec.productSize, productYield: spec.productYield, productWeight: spec.productWeight, productSpeed: spec.productSpeed, productLead: spec.productLead });
    const parsed = parseSizePattern(spec.productSize);
    setEditSizePattern(parsed.pattern); setEditSizeNum1(parsed.num1); setEditSizeNum2(parsed.num2);
  };

  const updateEditSize = (pattern: SizePatternId, n1: string, n2: string) => {
    setEditSizePattern(pattern); setEditSizeNum1(n1); setEditSizeNum2(n2);
    setEditData(d => ({ ...d, productSize: buildSizeString(pattern, n1, n2) }));
  };

  const handleEditTypeChange = (type: string) => {
    const lead = type === 'chilled' ? 1 : 5;
    setEditData(d => ({ ...d, productType: type, productLead: lead }));
  };

  const saveEdit = async (id: number) => {
    setSaving(true);
    try {
      const r = await fetch(`${API}/api/product-spec/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      });
      const d = await r.json();
      if (d.success) { showToast('อัพเดทสำเร็จ'); setEditingId(null); fetchSpecs(); }
    } catch { showToast('เกิดข้อผิดพลาด'); } finally { setSaving(false); }
  };

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const filteredSpecs = specs.filter(s =>
    s.erpItemCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.erpItemDesc || '').toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredErpItems = erpItems.filter(i =>
    i.erpItemCode.toLowerCase().includes(itemSearch.toLowerCase()) ||
    (i.erpItemDesc || '').toLowerCase().includes(itemSearch.toLowerCase())
  );
  // Exclude items that already have specs
  const availableItems = filteredErpItems.filter(i => !specs.some(s => s.erpItemCode === i.erpItemCode));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Product Spec</h1>
          <p className="text-gray-500 mt-1">กำหนดข้อมูล Specification ของสินค้าจาก ERP เพื่อใช้ในการคำนวณแผนการผลิต</p>
        </div>
        <button onClick={openAddModal} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl shadow-lg shadow-orange-200 text-sm font-semibold transition-all">
          <Plus className="w-4 h-4" /> เพิ่ม Product Spec
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Specs" value={specs.length} icon={Package} color="blue" />
        <StatCard label="Chilled" value={specs.filter(s => s.productType === 'chilled').length} icon={Thermometer} color="green" />
        <StatCard label="Freeze" value={specs.filter(s => s.productType === 'freeze').length} icon={Snowflake} color="cyan" />
        <StatCard label="Avg Yield" value={specs.length > 0 ? (specs.reduce((a, s) => a + Number(s.productYield || 0), 0) / specs.length * 100).toFixed(1) + '%' : '-'} icon={CheckCircle2} color="purple" />
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="ค้นหา Item Code หรือ Description..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none" />
          </div>
          <span className="text-sm text-gray-500">{filteredSpecs.length} รายการ</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-600 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">Item Code</th>
                <th className="px-4 py-3">Item Description</th>
                <th className="px-4 py-3">Item Type</th>
                <th className="px-4 py-3 text-center">Product Type</th>
                <th className="px-4 py-3 text-center">Size</th>
                <th className="px-4 py-3 text-center">Yield</th>
                <th className="px-4 py-3 text-center">Weight (kg)</th>
                <th className="px-4 py-3 text-center">Speed</th>
                <th className="px-4 py-3 text-center">Lead (days)</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredSpecs.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-16 text-center text-gray-400">
                  <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">ยังไม่มีข้อมูล Product Spec</p>
                  <p className="text-xs mt-1">คลิก "เพิ่ม Product Spec" เพื่อเริ่มต้น</p>
                </td></tr>
              ) : filteredSpecs.map(spec => {
                const isEditing = editingId === spec.id;
                return (
                  <tr key={spec.id} className="border-b border-gray-100 hover:bg-orange-50/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-blue-700">{spec.erpItemCode}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-[220px] truncate" title={spec.erpItemDesc}>{spec.erpItemDesc || '-'}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">{spec.erpItemType || '-'}</span></td>

                    {isEditing ? (<>
                      <td className="px-4 py-3 text-center">
                        <select value={editData.productType} onChange={e => handleEditTypeChange(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-xs bg-white focus:ring-2 focus:ring-orange-300 outline-none">
                          {PRODUCT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <SizeBuilder pattern={editSizePattern} num1={editSizeNum1} num2={editSizeNum2} onChange={updateEditSize} compact />
                      </td>
                      <td className="px-4 py-3 text-center"><input type="number" step="0.01" value={editData.productYield ?? ''} onChange={e => setEditData(d => ({...d, productYield: parseFloat(e.target.value)}))} className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-xs text-center bg-white focus:ring-2 focus:ring-orange-300 outline-none" /></td>
                      <td className="px-4 py-3 text-center"><input type="number" step="0.1" value={editData.productWeight ?? ''} onChange={e => setEditData(d => ({...d, productWeight: parseFloat(e.target.value)}))} className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-xs text-center bg-white focus:ring-2 focus:ring-orange-300 outline-none" /></td>
                      <td className="px-4 py-3 text-center"><input type="number" step="1" value={editData.productSpeed ?? ''} onChange={e => setEditData(d => ({...d, productSpeed: parseFloat(e.target.value)}))} className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-xs text-center bg-white focus:ring-2 focus:ring-orange-300 outline-none" /></td>
                      <td className="px-4 py-3 text-center"><input type="number" step="1" value={editData.productLead ?? ''} onChange={e => setEditData(d => ({...d, productLead: parseInt(e.target.value)}))} className="w-14 border border-gray-300 rounded-lg px-2 py-1 text-xs text-center bg-white focus:ring-2 focus:ring-orange-300 outline-none" /></td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => saveEdit(spec.id)} disabled={saving} className="p-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-colors"><Save className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-600 transition-colors"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </>) : (<>
                      <td className="px-4 py-3 text-center"><TypeBadge type={spec.productType} /></td>
                      <td className="px-4 py-3 text-center"><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">{spec.productSize}</span></td>
                      <td className="px-4 py-3 text-center font-medium text-gray-800">{Number(spec.productYield).toFixed(2)}</td>
                      <td className="px-4 py-3 text-center font-medium text-gray-800">{Number(spec.productWeight).toFixed(1)}</td>
                      <td className="px-4 py-3 text-center font-medium text-gray-800">{spec.productSpeed}</td>
                      <td className="px-4 py-3 text-center font-medium text-gray-800">{spec.productLead}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => startEdit(spec)} className="p-1.5 rounded-lg hover:bg-orange-100 text-orange-500 hover:text-orange-700 transition-colors" title="แก้ไข"><Edit3 className="w-4 h-4" /></button>
                      </td>
                    </>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ ADD MODAL ═══ */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-red-50 flex justify-between items-center shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">เพิ่ม Product Spec</h3>
                  <p className="text-xs text-gray-500 mt-0.5">เลือก Item จาก ERP แล้วกำหนด Spec</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-1.5 rounded-lg hover:bg-white/70 text-gray-500"><X className="w-5 h-5" /></button>
              </div>

              <div className="p-5 space-y-5 overflow-y-auto flex-1">
                {/* Step 1: Select ERP Item */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">1. เลือก Item จาก ERP</label>
                  {selectedItem ? (
                    <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                      <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-green-800">{selectedItem.erpItemCode}</span>
                        <span className="text-green-600 text-sm ml-2 truncate">{selectedItem.erpItemDesc}</span>
                      </div>
                      <button onClick={() => setSelectedItem(null)} className="text-green-500 hover:text-red-500 text-xs font-medium">เปลี่ยน</button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type="text" placeholder="ค้นหา Item Code..." value={itemSearch} onChange={e => setItemSearch(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none" />
                      </div>
                      <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
                        {availableItems.length === 0 ? (
                          <div className="p-4 text-center text-gray-400 text-sm">ไม่พบ Item / รายการทั้งหมดมี Spec แล้ว</div>
                        ) : availableItems.slice(0, 50).map(item => (
                          <button key={item.id} onClick={() => setSelectedItem(item)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-orange-50 text-left transition-colors">
                            <Package className="w-4 h-4 text-gray-400 shrink-0" />
                            <span className="font-medium text-blue-700 text-sm">{item.erpItemCode}</span>
                            <span className="text-gray-500 text-xs truncate flex-1">{item.erpItemDesc}</span>
                            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded">{item.erpItemType}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Step 2: Product Spec Form */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">2. กำหนด Product Specification</label>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Product Type */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Product Type</label>
                      <div className="flex gap-2">
                        {PRODUCT_TYPES.map(t => (
                          <button key={t} onClick={() => handleTypeChange(t)}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                              form.productType === t
                                ? t === 'chilled' ? 'border-green-500 bg-green-50 text-green-700' : 'border-cyan-500 bg-cyan-50 text-cyan-700'
                                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}>
                            {t === 'chilled' ? <Thermometer className="w-4 h-4" /> : <Snowflake className="w-4 h-4" />}
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Product Size */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Product Size</label>
                      <SizeBuilder pattern={formSizePattern} num1={formSizeNum1} num2={formSizeNum2} onChange={updateFormSize} />
                      {form.productSize && form.productSize !== 'unsize' && (
                        <p className="text-xs text-indigo-500 mt-1.5 font-medium">ผลลัพธ์: {form.productSize}</p>
                      )}
                    </div>

                    {/* Numeric fields */}
                    <FormField label="Product Yield" value={form.productYield} step="0.01" onChange={v => setForm(f => ({...f, productYield: v}))} />
                    <FormField label="Product Weight (kg)" value={form.productWeight} step="0.1" onChange={v => setForm(f => ({...f, productWeight: v}))} />
                    <FormField label="Product Speed" value={form.productSpeed} step="1" onChange={v => setForm(f => ({...f, productSpeed: v}))} />
                    <FormField label="Product Lead (days)" value={form.productLead} step="1" onChange={v => setForm(f => ({...f, productLead: v}))} hint={form.productType === 'chilled' ? 'Default: 1 (Chilled)' : 'Default: 5 (Freeze)'} />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 shrink-0">
                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50">ยกเลิก</button>
                <button onClick={handleSave} disabled={!selectedItem || saving}
                  className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl shadow-sm transition-all ${
                    selectedItem && !saving ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-orange-200' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} บันทึก
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 right-6 z-50 px-5 py-3 bg-gray-900 text-white rounded-xl shadow-2xl text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400" /> {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Sub Components ───
const TypeBadge = ({ type }: { type: string }) => {
  if (type === 'chilled') return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><Thermometer className="w-3 h-3" />Chilled</span>;
  if (type === 'freeze') return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-100 text-cyan-700"><Snowflake className="w-3 h-3" />Freeze</span>;
  return <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500">{type || '-'}</span>;
};

const StatCard = ({ label, value, icon: Icon, color }: { label: string; value: any; icon: any; color: string }) => {
  const colors: any = { blue: 'from-blue-500 to-blue-600', green: 'from-green-500 to-green-600', cyan: 'from-cyan-500 to-cyan-600', purple: 'from-purple-500 to-purple-600' };
  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
      <div className={`p-3 rounded-xl bg-gradient-to-br ${colors[color]} text-white shadow-lg`}><Icon className="w-5 h-5" /></div>
      <div><p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p><p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p></div>
    </div>
  );
};

const FormField = ({ label, value, step, onChange, hint }: { label: string; value: number; step: string; onChange: (v: number) => void; hint?: string }) => (
  <div>
    <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
    <input type="number" step={step} value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)}
      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none bg-white" />
    {hint && <p className="text-xs text-orange-500 mt-1">{hint}</p>}
  </div>
);

const SizeBuilder = ({ pattern, num1, num2, onChange, compact }: {
  pattern: SizePatternId; num1: string; num2: string;
  onChange: (pattern: SizePatternId, n1: string, n2: string) => void;
  compact?: boolean;
}) => {
  const inputCls = compact
    ? 'w-12 border border-gray-300 rounded px-1.5 py-0.5 text-xs text-center bg-white focus:ring-2 focus:ring-orange-300 outline-none'
    : 'w-16 border border-gray-300 rounded-lg px-2 py-2 text-sm text-center bg-white focus:ring-2 focus:ring-orange-300 outline-none';
  const btnCls = (active: boolean) => compact
    ? `px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${active ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'}`
    : `px-3 py-2 rounded-lg text-xs font-medium border-2 transition-all ${active ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`;

  return (
    <div className={`flex items-center gap-1.5 ${compact ? 'flex-wrap' : 'flex-wrap gap-2'}`}>
      {/* Pattern selector buttons */}
      {SIZE_PATTERNS.map(p => (
        <button key={p.id} onClick={() => onChange(p.id, p.id === 'unsize' ? '' : num1, p.id === 'range' ? num2 : '')} className={btnCls(pattern === p.id)}>
          {p.label}
        </button>
      ))}
      {/* Number inputs based on pattern */}
      {pattern === 'range' && (
        <div className="flex items-center gap-1">
          <input type="number" placeholder="XX" value={num1} onChange={e => onChange(pattern, e.target.value, num2)} className={inputCls} />
          <span className="text-gray-400 text-xs font-bold">-</span>
          <input type="number" placeholder="XX" value={num2} onChange={e => onChange(pattern, num1, e.target.value)} className={inputCls} />
        </div>
      )}
      {(pattern === 'down' || pattern === 'up') && (
        <div className="flex items-center gap-1">
          <input type="number" placeholder="XX" value={num1} onChange={e => onChange(pattern, e.target.value, '')} className={inputCls} />
          <span className="text-gray-400 text-xs">{pattern === 'down' ? 'Down' : 'Up'}</span>
        </div>
      )}
    </div>
  );
};

export default ProductSpec;
