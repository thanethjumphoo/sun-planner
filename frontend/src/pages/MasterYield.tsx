import React, { useState } from 'react';
import { 
  Leaf, Package, Layers, List, Percent, GitMerge, Table, Calculator, 
  ChevronDown, ChevronUp, Search, Plus, X, Box, Heart, Bone, Feather, Drumstick 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Mock Data
const initialProducts = [
  { name: 'ขนไก่', cat: 'ซาก', yieldPct: 0.075, amount: 7.5, modes: null },
  { name: 'หัวไก่', cat: 'ซาก', yieldPct: 0.023, amount: 2.3, modes: null },
  { name: 'เลือด', cat: 'ซาก', yieldPct: 0.05, amount: 5, modes: null },
  { name: 'ขาไก่', cat: 'ซาก', yieldPct: 0.023, amount: 2.3, modes: null },
  { name: 'สันใน', cat: 'เนื้อ', yieldPct: 0.04, amount: 4, modes: [
    { id: 1, label: 'สันใน Unsize', items: [{n:'สันใน unsize',p:0.98,a:3.92},{n:'ลูกสันใน',p:0.008,a:0.032},{n:'เศษสันใน',p:0.012,a:0.048}] },
    { id: 2, label: 'สันใน T/C', items: [{n:'สันใน T/C',p:0.92,a:3.68},{n:'เศษสันในติดเอ็น',p:0.08,a:0.32}] },
    { id: 3, label: 'W/O Tendon', items: [{n:'สันใน W/O tendon',p:0.85,a:3.4},{n:'เศษสันในติดเอ็น',p:0.1,a:0.4},{n:'เศษสันใน',p:0.05,a:0.2}] }
  ]},
  { name: 'BIL L/C', cat: 'เนื้อ', yieldPct: 0.25, amount: 25, modes: [
    { id: 1, label: 'BIL S/C', items: [{n:'BIL S/C',p:0.96,a:24},{n:'ข้อสั้น',p:0.04,a:1}] },
    { id: 2, label: 'น่อง+สะโพก', items: [{n:'น่อง',p:0.4,a:10},{n:'สะโพก',p:0.55,a:13.75},{n:'ข้อสั้น',p:0.04,a:1},{n:'หนังติดมันเกรด A',p:0.01,a:0.25}] },
    { id: 3, label: 'BL แผ่น', items: [{n:'BL แผ่น',p:0.745,a:18.625},{n:'หนังติดมันเกรด A',p:0.028,a:0.7},{n:'กระดูกน่องสะโพก',p:0.206,a:5.15},{n:'knee tendon',p:0.008,a:0.2}] }
  ]},
  { name: 'BB (อก)', cat: 'เนื้อ', yieldPct: 0.225, amount: 22.5, modes: [
    { id: 1, label: 'BB อกคู่ตัดติ่ง', items: [{n:'BB อกคู่ตัดติ่ง',p:0.93,a:20.925},{n:'เศษ BB',p:0.02,a:0.45},{n:'ติ่ง BB',p:0.045,a:1.0125}] },
    { id: 2, label: 'BB อกคู่ไม่ตัดติ่ง', items: [{n:'BB อกคู่ไม่ตัดติ่ง',p:0.975,a:21.9375},{n:'เศษ BB',p:0.02,a:0.45}] },
    { id: 3, label: 'SBB อกคู่', items: [{n:'SBB อกคู่',p:0.83,a:18.675},{n:'SKIN BB',p:0.1,a:2.25},{n:'ติ่ง BB',p:0.045,a:1.0125}] },
    { id: 4, label: 'SBB อกเดี่ยว', items: [{n:'SBB อกเดี่ยว',p:0.8,a:18},{n:'SKIN BB',p:0.1,a:2.25},{n:'ติ่ง BB',p:0.045,a:1.0125}] }
  ]},
  { name: '3JW (ปีก)', cat: 'ปีก', yieldPct: 0.076, amount: 7.6, modes: [
    { id: 1, label: '2JW + WS', items: [{n:'2JW',p:0.48,a:3.648},{n:'WS',p:0.52,a:3.952}] },
    { id: 2, label: 'MW + WING TIP + WS', items: [{n:'MW',p:0.36,a:2.736},{n:'WING TIP',p:0.12,a:0.912},{n:'WS',p:0.52,a:3.952}] }
  ]},
  { name: 'เครื่องในไก่', cat: 'พลอยได้', yieldPct: 0.058, amount: 5.8, modes: [
    { id: 0, label: 'รายการ', items: [{n:'ตับไก่',p:0.27,a:1.566},{n:'หัวใจไก่',p:0.07,a:0.406},{n:'กึ๋นไก่',p:0.13,a:0.754},{n:'ดีไก่',p:0.02,a:0.116},{n:'ไส้ไก่',p:0.42,a:2.436},{n:'ม้ามไก่',p:0.0171,a:0.09918}] }
  ]},
  { name: 'โครงไก่', cat: 'โครง', yieldPct: 0.18, amount: 18, modes: [
    { id: 0, label: 'รายการ', items: [{n:'เนื้อคอ',p:0.026,a:0.468},{n:'หนังคอ',p:0.1,a:1.8},{n:'เนื้อช่องท้อง',p:0.05,a:0.9},{n:'กระดูกอ่อน',p:0.0078,a:0.1404},{n:'บั้นท้าย',p:0.04,a:0.72},{n:'มันช่องท้อง',p:0.0014,a:0.0252},{n:'โครงเลาะ→CCM st.1',p:0.5,a:6.84},{n:'CCM st.2',p:0.25,a:3.42}] }
  ]}
];

const catColors: Record<string, string> = { 'ซาก':'bg-blue-50 text-blue-700','เนื้อ':'bg-green-50 text-green-700','ปีก':'bg-amber-50 text-amber-700','พลอยได้':'bg-pink-50 text-pink-700','โครง':'bg-gray-100 text-gray-700' };
const catIcons: Record<string, React.FC<any>> = { 'ซาก': Feather, 'เนื้อ': Drumstick, 'ปีก': Box, 'พลอยได้': Heart, 'โครง': Bone };

export default function MasterYield() {
  const [products, setProducts] = useState(initialProducts);
  const [activeTab, setActiveTab] = useState<'tree'|'table'|'calc'>('tree');
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({});
  const [activeModes, setActiveModes] = useState<Record<number, number>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [calcInput, setCalcInput] = useState<number>(1000);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPIdx, setCurrentPIdx] = useState<number | null>(null);
  const [currentMIdx, setCurrentMIdx] = useState<number | null>(null);
  const [specSelect, setSpecSelect] = useState('สันในตัดแต่งพิเศษ');
  const [yieldInput, setYieldInput] = useState<string>('');

  const toggleCard = (i: number) => {
    setExpandedCards(prev => ({ ...prev, [i]: !prev[i] }));
  };

  const switchMode = (pIdx: number, mIdx: number) => {
    setActiveModes(prev => ({ ...prev, [pIdx]: mIdx }));
  };

  const openAddModal = (pIdx: number, mIdx: number) => {
    setCurrentPIdx(pIdx);
    setCurrentMIdx(mIdx);
    setYieldInput('');
    setIsModalOpen(true);
  };

  const saveNewItem = () => {
    const yieldPct = parseFloat(yieldInput) || 0;
    if (currentPIdx !== null && currentMIdx !== null && yieldPct > 0) {
      const newProducts = [...products];
      const p = newProducts[currentPIdx];
      const mode = p.modes![currentMIdx];
      const newAmt = p.amount * (yieldPct / 100);
      
      mode.items.push({
        n: specSelect,
        p: yieldPct / 100,
        a: newAmt
      });
      
      setProducts(newProducts);
    }
    setIsModalOpen(false);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.cat.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end border-b border-gray-200 pb-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center shadow-sm">
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Master Yield</h1>
            <p className="text-gray-500 text-sm mt-1">ระบบจัดการ Yield ผลิตภัณฑ์ไก่</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-full border border-green-200">อัปเดตล่าสุด</span>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="text-xs text-gray-500 mb-2 flex items-center gap-2 uppercase tracking-wider font-semibold"><Package className="w-4 h-4"/> วัตถุดิบหลัก</div>
          <div className="text-2xl font-bold text-gray-900">ไก่เป็น</div>
          <div className="text-xs text-gray-400 mt-1">100 กก. (ฐาน)</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="text-xs text-gray-500 mb-2 flex items-center gap-2 uppercase tracking-wider font-semibold"><Layers className="w-4 h-4"/> กลุ่มผลิตภัณฑ์</div>
          <div className="text-2xl font-bold text-gray-900">10</div>
          <div className="text-xs text-gray-400 mt-1">กลุ่มหลัก</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="text-xs text-gray-500 mb-2 flex items-center gap-2 uppercase tracking-wider font-semibold"><List className="w-4 h-4"/> รายการทั้งหมด</div>
          <div className="text-2xl font-bold text-gray-900">55+</div>
          <div className="text-xs text-gray-400 mt-1">ผลิตภัณฑ์ย่อย</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="text-xs text-gray-500 mb-2 flex items-center gap-2 uppercase tracking-wider font-semibold"><Percent className="w-4 h-4"/> Yield รวม</div>
          <div className="text-2xl font-bold text-gray-900">~98%</div>
          <div className="text-xs text-gray-400 mt-1">ใช้ประโยชน์จากซาก</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        <button onClick={() => setActiveTab('tree')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'tree' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><GitMerge className="w-4 h-4"/> Yield Tree</button>
        <button onClick={() => setActiveTab('table')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'table' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Table className="w-4 h-4"/> ตารางข้อมูล</button>
        <button onClick={() => setActiveTab('calc')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'calc' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Calculator className="w-4 h-4"/> คำนวณ</button>
      </div>

      {/* Tab Content: Tree */}
      {activeTab === 'tree' && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-5 py-4 mb-6">
            <div>
              <div className="text-lg font-bold text-green-900">🐔 ไก่เป็น (Live Chicken)</div>
              <div className="text-xs text-green-700 mt-1 font-medium">วัตถุดิบตั้งต้น — Yield = 100%</div>
            </div>
            <div className="text-2xl font-bold text-green-800">100 กก.</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {products.map((p, i) => {
              const hasModes = p.modes && p.modes.length > 0;
              const isExpanded = expandedCards[i];
              const currentModeIdx = activeModes[i] || 0;
              const currentMode = hasModes ? p.modes![currentModeIdx] : null;
              const Icon = catIcons[p.cat] || Package;

              return (
                <div key={i} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <div onClick={() => toggleCard(i)} className="flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors select-none">
                    <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
                      <Icon className="w-4 h-4 text-green-600" /> {p.name}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-semibold">{(p.yieldPct * 100).toFixed(1)}%</span>
                      <span className="text-sm font-bold text-gray-700">{p.amount} กก.</span>
                      {hasModes && (isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />)}
                    </div>
                  </div>
                  
                  {hasModes && isExpanded && (
                    <div className="p-3 border-t border-gray-200 bg-white">
                      {p.modes!.length > 1 && (
                        <div className="flex gap-2 mb-3">
                          {p.modes!.map((m, mIdx) => (
                            <button key={mIdx} onClick={() => switchMode(i, mIdx)} className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${currentModeIdx === mIdx ? 'bg-green-50 border-green-400 text-green-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                              {m.label}
                            </button>
                          ))}
                        </div>
                      )}
                      
                      <div className="space-y-0">
                        {currentMode?.items.map((it, idx) => (
                          <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                            <span className="text-xs text-gray-700 w-1/3 truncate">{it.n}</span>
                            <div className="flex-1 px-3">
                              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.round(it.p * 100)}%` }}></div>
                              </div>
                            </div>
                            <span className="text-xs text-gray-500 w-12 text-right">{(it.p * 100).toFixed(1)}%</span>
                            <span className="text-xs font-semibold text-gray-800 w-16 text-right">{it.a.toFixed(3).replace(/\.?0+$/, '')} กก.</span>
                          </div>
                        ))}
                      </div>

                      <button onClick={() => openAddModal(i, currentModeIdx)} className="mt-3 w-full flex items-center justify-center gap-2 py-2 border border-dashed border-gray-300 rounded-lg text-xs font-medium text-green-600 hover:bg-green-50 hover:border-green-400 transition-colors">
                        <Plus className="w-3.5 h-3.5" /> เพิ่ม Item จาก Product Spec
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab Content: Table */}
      {activeTab === 'table' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm">
            <Search className="w-4 h-4 text-gray-400" />
            <input type="text" placeholder="ค้นหาผลิตภัณฑ์..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="flex-1 text-sm outline-none bg-transparent" />
          </div>
          
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-3">ผลิตภัณฑ์</th>
                    <th className="px-5 py-3">กลุ่ม</th>
                    <th className="px-5 py-3">% Yield (เทียบไก่เป็น)</th>
                    <th className="px-5 py-3 text-right">ปริมาณ (กก.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredProducts.map((p, i) => (
                    <React.Fragment key={i}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-semibold text-gray-800">{p.name}</td>
                        <td className="px-5 py-3"><span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${catColors[p.cat] || 'bg-gray-100 text-gray-600'}`}>{p.cat}</span></td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-green-500" style={{ width: `${Math.min(100, p.yieldPct * 100 * 4)}%` }}></div></div>
                            <span className="text-gray-700">{(p.yieldPct * 100).toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right font-medium text-gray-800">{p.amount.toFixed(2)}</td>
                      </tr>
                      {p.modes && p.modes[0].items.map((it, idx) => (
                        <tr key={`${i}-${idx}`} className="bg-gray-50/50">
                          <td className="px-5 py-2 pl-10 text-xs text-gray-500">↳ {it.n}</td>
                          <td className="px-5 py-2"><span className={`px-2 py-0.5 rounded text-[10px] opacity-70 ${catColors[p.cat] || 'bg-gray-100 text-gray-600'}`}>{p.cat}</span></td>
                          <td className="px-5 py-2 text-xs text-gray-500">{(it.p * 100).toFixed(1)}% <span className="text-gray-400">(เทียบหลัก)</span></td>
                          <td className="px-5 py-2 text-right text-xs text-gray-600">{it.a.toFixed(3)}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Calc */}
      {activeTab === 'calc' && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">ป้อนน้ำหนักไก่เป็น</div>
          <div className="flex items-center gap-3 mb-8">
            <input type="number" value={calcInput} onChange={e => setCalcInput(parseFloat(e.target.value) || 0)} min="1" className="w-40 px-4 py-2.5 text-lg font-bold border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-400 outline-none" />
            <span className="text-gray-500 font-medium">กิโลกรัม</span>
          </div>

          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">ผลลัพธ์ที่คาดการณ์</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {products.map((p, i) => {
              const Icon = catIcons[p.cat] || Package;
              return (
                <div key={i} className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                  <div className="flex items-center gap-2 text-xs text-gray-500 font-medium mb-2"><Icon className="w-3.5 h-3.5" /> {p.name}</div>
                  <div className="text-xl font-bold text-gray-900">{(calcInput * p.yieldPct).toFixed(1)}</div>
                  <div className="text-xs text-gray-400 mt-1">กก. ({(p.yieldPct * 100).toFixed(1)}%)</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden">
              <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-900">เพิ่ม Item จาก Product Spec</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">เลือก Product Spec</label>
                  <select value={specSelect} onChange={e => setSpecSelect(e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-400 bg-white">
                    <option value="สันในตัดแต่งพิเศษ">สันในตัดแต่งพิเศษ</option>
                    <option value="โครงไก่บด">โครงไก่บด</option>
                    <option value="หนังไก่กรอบ">หนังไก่กรอบ</option>
                    <option value="เศษเนื้อ">เศษเนื้อ</option>
                    <option value="ชิ้นส่วนพิเศษ (ตามสั่ง)">ชิ้นส่วนพิเศษ (ตามสั่ง)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">% Yield (เทียบกับหมวดหลัก)</label>
                  <input type="number" step="0.1" placeholder="เช่น 5.5" value={yieldInput} onChange={e => setYieldInput(e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-400 bg-white" />
                </div>
              </div>
              <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-xl hover:bg-gray-50">ยกเลิก</button>
                <button onClick={saveNewItem} disabled={!yieldInput || parseFloat(yieldInput) <= 0} className="px-5 py-2 text-sm font-semibold text-white bg-green-500 rounded-xl hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">เพิ่มรายการ</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
