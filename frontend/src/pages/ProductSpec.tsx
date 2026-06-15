import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Plus, Save, X, Loader2, Package, Edit3, Snowflake, 
  Thermometer, CheckCircle2, Upload, ChevronLeft, ChevronRight 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ImportSpecModal from '../components/ImportSpecModal';

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
  productSpeed: number; icutSpeed: number; minProductLead: number; maxProductLead: number; isExternalRmAllowed: boolean; createdAt: string; updatedAt: string;
}

const ProductSpec: React.FC = () => {
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [erpItems, setErpItems] = useState<ErpItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<Spec>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Pagination states
  const [page, setPage] = useState(1);
  const limit = 10;

  // New spec form
  const [selectedItem, setSelectedItem] = useState<ErpItem | null>(null);
  const [form, setForm] = useState({ productType: 'chilled', productSize: 'unsize', productYield: 0.84, productWeight: 2, productSpeed: 45, icutSpeed: 0, minProductLead: 1, maxProductLead: 3, isExternalRmAllowed: false });
  const [formSizePattern, setFormSizePattern] = useState<SizePatternId>('unsize');
  const [formSizeNum1, setFormSizeNum1] = useState('');
  const [formSizeNum2, setFormSizeNum2] = useState('');
  const [editSizePattern, setEditSizePattern] = useState<SizePatternId>('unsize');
  const [editSizeNum1, setEditSizeNum1] = useState('');
  const [editSizeNum2, setEditSizeNum2] = useState('');
  const [itemSearch, setItemSearch] = useState('');

  useEffect(() => { fetchSpecs(); }, []);

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  const fetchSpecs = async () => {
    try { const r = await fetch(`${API}/api/product-spec`); if (r.ok) setSpecs(await r.json()); } catch (e) { console.error(e); }
  };
  const fetchErpItems = async () => {
    try { const r = await fetch(`${API}/api/product-spec/erp-items`); if (r.ok) setErpItems(await r.json()); } catch (e) { console.error(e); }
  };

  const openAddModal = () => { fetchErpItems(); setSelectedItem(null); setForm({ productType: 'chilled', productSize: 'unsize', productYield: 0.84, productWeight: 2, productSpeed: 45, icutSpeed: 0, minProductLead: 1, maxProductLead: 3, isExternalRmAllowed: false }); setFormSizePattern('unsize'); setFormSizeNum1(''); setFormSizeNum2(''); setItemSearch(''); setIsModalOpen(true); };

  const updateFormSize = (pattern: SizePatternId, n1: string, n2: string) => {
    setFormSizePattern(pattern); setFormSizeNum1(n1); setFormSizeNum2(n2);
    setForm(f => ({ ...f, productSize: buildSizeString(pattern, n1, n2) }));
  };

  const handleTypeChange = (type: string) => {
    const minLead = type === 'chilled' ? 1 : 5;
    const maxLead = type === 'chilled' ? 3 : 30;
    setForm(f => ({ ...f, productType: type, minProductLead: minLead, maxProductLead: maxLead }));
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
    setEditData(spec);
    const parsed = parseSizePattern(spec.productSize);
    setEditSizePattern(parsed.pattern);
    setEditSizeNum1(parsed.num1);
    setEditSizeNum2(parsed.num2);
  };

  const updateEditSize = (pattern: SizePatternId, n1: string, n2: string) => {
    setEditSizePattern(pattern); setEditSizeNum1(n1); setEditSizeNum2(n2);
    setEditData(d => ({ ...d, productSize: buildSizeString(pattern, n1, n2) }));
  };

  const handleEditTypeChange = (type: string) => {
    const minLead = type === 'chilled' ? 1 : 5;
    const maxLead = type === 'chilled' ? 3 : 30;
    setEditData(d => ({ ...d, productType: type, minProductLead: minLead, maxProductLead: maxLead }));
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const r = await fetch(`${API}/api/product-spec/${editingId}/update`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      });
      const d = await r.json();
      if (d.success) { showToast('อัพเดทสำเร็จ'); setEditingId(null); fetchSpecs(); }
    } catch { showToast('เกิดข้อผิดพลาด'); } finally { setSaving(false); }
  };

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const filteredSpecs = useMemo(() => {
    return specs.filter(s =>
      s.erpItemCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.erpItemDesc || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [specs, searchTerm]);

  const totalPages = Math.ceil(filteredSpecs.length / limit);

  const paginatedSpecs = useMemo(() => {
    const startIndex = (page - 1) * limit;
    return filteredSpecs.slice(startIndex, startIndex + limit);
  }, [filteredSpecs, page, limit]);

  const filteredErpItems = useMemo(() => {
    return erpItems.filter(i =>
      i.erpItemCode.toLowerCase().includes(itemSearch.toLowerCase()) ||
      (i.erpItemDesc || '').toLowerCase().includes(itemSearch.toLowerCase())
    );
  }, [erpItems, itemSearch]);

  // Exclude items that already have specs
  const availableItems = useMemo(() => {
    return filteredErpItems.filter(i => !specs.some(s => s.erpItemCode === i.erpItemCode));
  }, [filteredErpItems, specs]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end bg-gradient-to-r from-orange-500 to-amber-500 p-8 text-white rounded-[32px] shadow-2xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center w-full gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">
              <Package className="w-9 h-9" /> Product Specification
            </h1>
            <p className="text-orange-100 font-medium mt-2 max-w-xl">
              กำหนดคุณลักษณะเฉพาะของสินค้า (Yield, Line Speed, และ Lead Time) เพื่อใช้อ้างอิงการจัดสรรในระบบวางแผนผลิต
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <button onClick={() => setIsImportOpen(true)} className="px-5 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-sm font-bold shadow-md transition-all flex items-center gap-2">
              <Upload className="w-4 h-4" /> Import Excel
            </button>
            <button onClick={openAddModal} className="px-5 py-3 bg-white hover:bg-orange-50 text-orange-600 rounded-xl text-sm font-bold shadow-xl transition-all flex items-center gap-2">
              <Plus className="w-4 h-4" /> เพิ่ม Product Spec
            </button>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total Configurations" value={specs.length} icon={Package} color="blue" />
        <StatCard label="Chilled Specs" value={specs.filter(s => s.productType === 'chilled').length} icon={Thermometer} color="green" />
        <StatCard label="Avg Yield" value={specs.length > 0 ? (specs.reduce((a, s) => a + Number(s.productYield || 0), 0) / specs.length * 100).toFixed(1) + '%' : '-'} icon={CheckCircle2} color="purple" />
      </div>

      {/* Search & Table */}
      <div className="bg-white rounded-[24px] border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="ค้นหา Item Code หรือ Description..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none font-semibold" />
          </div>
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">พบ {filteredSpecs.length} รายการ</span>
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
                <th className="px-4 py-3 text-center bg-blue-50/50 text-blue-800">I-Cut Speed (kg/h)</th>
                <th className="px-4 py-3 text-center">Lead Range (days)</th>
                <th className="px-4 py-3 text-center">Ext. RM</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedSpecs.length === 0 ? (
                <tr><td colSpan={12} className="px-4 py-16 text-center text-gray-400">
                  <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">ยังไม่มีข้อมูล Product Spec</p>
                  <p className="text-xs mt-1">คลิก "เพิ่ม Product Spec" เพื่อเริ่มต้น</p>
                </td></tr>
              ) : paginatedSpecs.map(spec => {
                return (
                  <tr key={spec.id} className="border-b border-gray-100 hover:bg-orange-50/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-blue-700">{spec.erpItemCode}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-[220px] truncate" title={spec.erpItemDesc}>{spec.erpItemDesc || '-'}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">{spec.erpItemType || '-'}</span></td>
                    <td className="px-4 py-3 text-center"><TypeBadge type={spec.productType} /></td>
                    <td className="px-4 py-3 text-center"><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">{spec.productSize}</span></td>
                    <td className="px-4 py-3 text-center font-medium text-gray-800">{Number(spec.productYield).toFixed(2)}</td>
                    <td className="px-4 py-3 text-center font-medium text-gray-800">{Number(spec.productWeight).toFixed(1)}</td>
                    <td className="px-4 py-3 text-center font-medium text-gray-800">{spec.productSpeed}</td>
                    <td className="px-4 py-3 text-center font-medium text-blue-600 bg-blue-50/50">{spec.icutSpeed > 0 ? spec.icutSpeed : '-'}</td>
                    <td className="px-4 py-3 text-center font-medium text-gray-800">{spec.minProductLead} - {spec.maxProductLead}</td>
                    <td className="px-4 py-3 text-center"><input type="checkbox" checked={!!spec.isExternalRmAllowed} readOnly className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500 opacity-80" /></td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => startEdit(spec)} className="p-1.5 rounded-lg hover:bg-orange-100 text-orange-500 hover:text-orange-700 transition-colors" title="แก้ไข"><Edit3 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls - Demand Management Style */}
        {totalPages > 1 && (
          <div className="bg-white px-6 py-4 border-t border-gray-100 flex items-center justify-between rounded-b-[24px]">
            <div className="text-sm text-gray-500">
              แสดง <span className="font-semibold text-gray-900">{((page - 1) * limit) + 1}</span> ถึง{' '}
              <span className="font-semibold text-gray-900">{Math.min(page * limit, filteredSpecs.length)}</span> จาก{' '}
              <span className="font-semibold text-gray-900">{filteredSpecs.length}</span> รายการ
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage(1)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white text-xs font-semibold transition-colors"
              >
                First
              </button>
              <button
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white text-xs font-semibold transition-colors flex items-center gap-1"
              >
                <ChevronLeft size={14} /> ก่อนหน้า
              </button>
              
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = page;
                if (page <= 3) pageNum = i + 1;
                else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = page - 2 + i;
                
                if (pageNum < 1 || pageNum > totalPages) return null;
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                      page === pageNum
                        ? 'bg-orange-500 text-white shadow-md shadow-orange-100'
                        : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white text-xs font-semibold transition-colors flex items-center gap-1"
              >
                ถัดไป <ChevronRight size={14} />
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(totalPages)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white text-xs font-semibold transition-colors"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ ADD MODAL ═══ */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
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
                    <FormField label="Product Yield" value={form.productYield} step="0.01" onChange={(v: any) => setForm(f => ({...f, productYield: v}))} />
                    <FormField label="Product Weight (kg)" value={form.productWeight} step="0.1" onChange={(v: any) => setForm(f => ({...f, productWeight: v}))} />
                    <FormField label="Line Speed" value={form.productSpeed} step="1" onChange={(v: any) => setForm(f => ({...f, productSpeed: v}))} />
                    <FormField label="I-Cut Speed (kg/h)" value={form.icutSpeed} step="1" onChange={(v: any) => setForm(f => ({...f, icutSpeed: v}))} hint="ใส่ 0 ถ้าไม่ได้ใช้ I-Cut" />
                    <FormField label="Min Lead (days)" value={form.minProductLead} step="1" onChange={(v: any) => setForm(f => ({...f, minProductLead: v}))} hint={form.productType === 'chilled' ? 'Default: 1 (Chilled)' : 'Default: 5 (Freeze)'} />
                    <FormField label="Max Lead (days)" value={form.maxProductLead} step="1" onChange={(v: any) => setForm(f => ({...f, maxProductLead: v}))} hint={form.productType === 'chilled' ? 'Default: 3 (Chilled)' : 'Default: 30 (Freeze)'} />
                    <div className="flex items-center gap-2 mt-4 ml-1 col-span-2 bg-orange-50 p-3 rounded-xl border border-orange-100">
                      <input type="checkbox" id="extRm" checked={form.isExternalRmAllowed} onChange={e => setForm(f => ({...f, isExternalRmAllowed: e.target.checked}))} className="w-4 h-4 text-orange-500 border-orange-300 rounded focus:ring-orange-500" />
                      <label htmlFor="extRm" className="text-sm font-semibold text-orange-800 cursor-pointer select-none">Allow usage of External RM Supply</label>
                    </div>
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

      {/* ═══ EDIT MODAL ═══ */}
      <AnimatePresence>
        {editingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm" onClick={() => setEditingId(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
              {/* Modal Header */}
              <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-red-50 flex justify-between items-center shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">แก้ไข Product Spec</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Item: {specs.find(s => s.id === editingId)?.erpItemCode}</p>
                </div>
                <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg hover:bg-white/70 text-gray-500"><X className="w-5 h-5" /></button>
              </div>

              <div className="p-5 space-y-5 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-4">
                  {/* Product Type */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Product Type</label>
                    <div className="flex gap-2">
                      {PRODUCT_TYPES.map(t => (
                        <button key={t} onClick={() => handleEditTypeChange(t)}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                            editData.productType === t
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
                    <SizeBuilder pattern={editSizePattern} num1={editSizeNum1} num2={editSizeNum2} onChange={updateEditSize} />
                    {editData.productSize && editData.productSize !== 'unsize' && (
                      <p className="text-xs text-indigo-500 mt-1.5 font-medium">ผลลัพธ์: {editData.productSize}</p>
                    )}
                  </div>

                  {/* Numeric fields */}
                  <FormField label="Product Yield" value={editData.productYield} step="0.01" onChange={(v: any) => setEditData(d => ({...d, productYield: v}))} />
                  <FormField label="Product Weight (kg)" value={editData.productWeight} step="0.1" onChange={(v: any) => setEditData(d => ({...d, productWeight: v}))} />
                  <FormField label="Line Speed" value={editData.productSpeed} step="1" onChange={(v: any) => setEditData(d => ({...d, productSpeed: v}))} />
                  <FormField label="I-Cut Speed (kg/h)" value={editData.icutSpeed} step="1" onChange={(v: any) => setEditData(d => ({...d, icutSpeed: v}))} hint="ใส่ 0 ถ้าไม่ได้ใช้ I-Cut" />
                  <FormField label="Min Lead (days)" value={editData.minProductLead} step="1" onChange={(v: any) => setEditData(d => ({...d, minProductLead: v}))} />
                  <FormField label="Max Lead (days)" value={editData.maxProductLead} step="1" onChange={(v: any) => setEditData(d => ({...d, maxProductLead: v}))} />
                  <div className="flex items-center gap-2 mt-4 ml-1 col-span-2 bg-orange-50 p-3 rounded-xl border border-orange-100">
                    <input type="checkbox" id="editExtRm" checked={!!editData.isExternalRmAllowed} onChange={e => setEditData(d => ({...d, isExternalRmAllowed: e.target.checked}))} className="w-4 h-4 text-orange-500 border-orange-300 rounded focus:ring-orange-500" />
                    <label htmlFor="editExtRm" className="text-sm font-semibold text-orange-800 cursor-pointer select-none">Allow usage of External RM Supply</label>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 shrink-0">
                <button onClick={() => setEditingId(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50">ยกเลิก</button>
                <button onClick={handleUpdate} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 rounded-xl shadow-md shadow-orange-100 transition-all">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} อัพเดท
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ImportSpecModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} onImportDone={fetchSpecs} />

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-5 right-5 bg-gray-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-50">
            <CheckCircle2 className="text-green-400 w-5 h-5" />
            <span className="text-sm font-semibold">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Sub Components ───

const StatCard = ({ label, value, icon: Icon, color }: any) => {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100'
  };
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm flex items-center justify-between">
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-3xl font-black text-gray-900 mt-2">{value}</p>
      </div>
      <div className={`p-4 rounded-xl border ${colors[color]}`}><Icon className="w-6 h-6" /></div>
    </div>
  );
};

const TypeBadge = ({ type }: { type: string }) => {
  return type === 'chilled' ? (
    <span className="px-2.5 py-1 bg-green-50 text-green-700 border border-green-100 rounded-lg text-xs font-bold flex items-center gap-1 w-fit mx-auto">
      <Thermometer className="w-3.5 h-3.5" /> chilled
    </span>
  ) : (
    <span className="px-2.5 py-1 bg-cyan-50 text-cyan-700 border border-cyan-100 rounded-lg text-xs font-bold flex items-center gap-1 w-fit mx-auto">
      <Snowflake className="w-3.5 h-3.5" /> freeze
    </span>
  );
};

const FormField = ({ label, value, step, onChange, hint }: { label: string; value: any; step: string; onChange: (v: number) => void; hint?: string }) => (
  <div>
    <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
    <input type="number" step={step} value={value ?? ''} onChange={e => onChange(Number(e.target.value))}
      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold outline-none focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 transition-all" />
    {hint && <p className="text-[10px] text-gray-400 mt-1 font-medium">{hint}</p>}
  </div>
);

const SizeBuilder = ({ pattern, num1, num2, onChange }: { pattern: SizePatternId; num1: string; num2: string; onChange: (p: SizePatternId, n1: string, n2: string) => void }) => {
  const selected = SIZE_PATTERNS.find(p => p.id === pattern) || SIZE_PATTERNS[0];
  return (
    <div className="space-y-2">
      <select value={pattern} onChange={e => onChange(e.target.value as SizePatternId, '', '')}
        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-500 transition-all font-semibold bg-white">
        {SIZE_PATTERNS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      {selected.fields > 0 && (
        <div className="flex gap-2">
          <input type="number" placeholder="Min / Size" value={num1} onChange={e => onChange(pattern, e.target.value, num2)}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold outline-none focus:bg-white focus:border-orange-500" />
          {selected.fields === 2 && (
            <input type="number" placeholder="Max" value={num2} onChange={e => onChange(pattern, num1, e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold outline-none focus:bg-white focus:border-orange-500" />
          )}
        </div>
      )}
    </div>
  );
};

export default ProductSpec;
