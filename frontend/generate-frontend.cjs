const fs = require('fs');
const path = require('path');

// Read the original MPSPlan.tsx to use it as a base template
const mpsPlanPath = path.join(__dirname, 'src', 'pages', 'MPSPlan.tsx');
let mpsPlanCode = fs.readFileSync(mpsPlanPath, 'utf8');

// Replace components and logic specifically for BL Plan
let blPlanCode = mpsPlanCode.replace(/MPSPlan/g, 'BLPlan');
blPlanCode = blPlanCode.replace(/fetchBilData/g, 'fetchBilDataForBl');

// Basically we will just create a simplified version of MPSPlan for BL, with 3 RM types instead of chicken.
const simplifiedBlPlanCode = `import React, { useState, useEffect } from 'react';
import { Calendar, Package, Users, Activity, Scale, Move, ChevronLeft, ChevronRight, Filter, FileText, Trash2, CalendarDays, ShoppingCart, X, Info, CheckCircle2, Lock, Unlock, ShieldCheck, Download, FileSpreadsheet, AlertTriangle, Database, BarChart3, Cpu, Layers, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API = import.meta.env.VITE_API_URL;

interface Spec {
  erpItemCode: string;
  productType: string;
  productYield: number;
  productSpeed: number;
  productSize: string;
  masterYieldIds?: string;
  erpItemDesc?: string;
}

const BLPlan: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 4, 1)); // May 2026
  const [loading, setLoading] = useState(true);
  const [loadingPhase, setLoadingPhase] = useState<{ mode: 'loading' | 'generating' | 'importing'; step: number; message: string }>({ mode: 'loading', step: 0, message: 'Initializing...' });
  const [mainPlans, setMainPlans] = useState<any[]>([]);
  const [selectedMainPlanId, setSelectedMainPlanId] = useState<string>('');
  
  const [currentPlan, setCurrentPlan] = useState<any>(null);
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [selectedSupply, setSelectedSupply] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');

  useEffect(() => {
    initData();
  }, [currentMonth]);

  const initData = async () => {
    setLoading(true);
    setLoadingPhase({ mode: 'loading', step: 1, message: 'Loading Main MPS Plans...' });
    
    try {
      const res = await fetch(\`\${API}/api/mps/plans?partType=bil\`);
      if (res.ok) {
        const plans = await res.json();
        setMainPlans(plans);
        const thisMonthPlan = plans.find((p: any) => p.targetMonth === \`\${currentMonth.getFullYear()}-\${(currentMonth.getMonth() + 1).toString().padStart(2, '0')}\`);
        if (thisMonthPlan) setSelectedMainPlanId(thisMonthPlan.id.toString());
      }
      
      await loadBlPlan();
    } catch (e) {
      console.error(e);
    }
    
    setLoading(false);
  };

  const loadBlPlan = async () => {
    try {
      const res = await fetch(\`\${API}/api/bl-mps-plans\`);
      if (res.ok) {
        const plans = await res.json();
        const monthStr = \`\${currentMonth.getFullYear()}-\${(currentMonth.getMonth() + 1).toString().padStart(2, '0')}\`;
        const plan = plans.find((p: any) => p.planMonth === monthStr);
        if (plan) {
          const detailRes = await fetch(\`\${API}/api/bl-mps-plans/\${plan.id}\`);
          if (detailRes.ok) setCurrentPlan(await detailRes.json());
        } else {
          setCurrentPlan(null);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const executeGeneratePlan = async () => {
    if (!selectedMainPlanId) return alert('Please select a Main MPS Plan to sync from');
    
    setLoading(true);
    setLoadingPhase({ mode: 'generating', step: 1, message: 'Syncing and generating from Main MPS Plan...' });
    
    try {
      const res = await fetch(\`\${API}/api/bl-mps-plans/sync/\${selectedMainPlanId}\`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentPlan(data);
      } else {
        const err = await res.json();
        alert('Error: ' + err.message);
      }
    } catch (e) {
      console.error(e);
      alert('Error generating plan');
    }
    
    setLoading(false);
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const daysInMonth = getDaysInMonth(currentMonth);
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i + 1);
    const dateStr = d.toISOString().split('T')[0];
    const dailyData = currentPlan?.dailyPlans?.find((p: any) => p.planDate.startsWith(dateStr));
    return {
      date: d,
      dateStr,
      dailyData
    };
  });

  const handleDayClick = (day: any) => {
    if (!day.dailyData) return;
    setSelectedDate(day.dateStr);
    setSelectedSupply(day.dailyData);
    setShowSupplyModal(true);
  };

  const renderSupplyModal = () => {
    if (!showSupplyModal || !selectedSupply) return null;
    
    let breakdown = { "BL": { kg: 0, sizes: {} }, "BL-TH": { kg: 0 }, "BL-DR": { kg: 0 } };
    try {
      if (selectedSupply.rmBreakdownJson) {
        breakdown = JSON.parse(selectedSupply.rmBreakdownJson);
      }
    } catch (e) {}

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-blue-500" />
                BL Supply Breakdown - {selectedDate}
              </h2>
            </div>
            <button onClick={() => setShowSupplyModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-6 overflow-y-auto flex-1">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
               <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                 <div className="text-blue-600 text-sm font-medium mb-1">RM BL (Debone)</div>
                 <div className="text-2xl font-bold text-gray-900">{breakdown['BL']?.kg?.toLocaleString(undefined, {maximumFractionDigits:0}) || 0} kg</div>
               </div>
               <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl">
                 <div className="text-orange-600 text-sm font-medium mb-1">RM BL-TH (สะโพก)</div>
                 <div className="text-2xl font-bold text-gray-900">{breakdown['BL-TH']?.kg?.toLocaleString(undefined, {maximumFractionDigits:0}) || 0} kg</div>
               </div>
               <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
                 <div className="text-emerald-600 text-sm font-medium mb-1">RM BL-DR (น่อง)</div>
                 <div className="text-2xl font-bold text-gray-900">{breakdown['BL-DR']?.kg?.toLocaleString(undefined, {maximumFractionDigits:0}) || 0} kg</div>
               </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900 leading-none">BL MPS Plan</h1>
                  <div className="text-xs text-gray-500 mt-1 font-medium">Bone-in Leg</div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
               <select 
                  className="px-3 py-2 border rounded-lg"
                  value={selectedMainPlanId}
                  onChange={e => setSelectedMainPlanId(e.target.value)}
               >
                  <option value="">-- Select Main BIL Plan to Sync --</option>
                  {mainPlans.map(p => (
                     <option key={p.id} value={p.id}>{p.planName || p.targetMonth}</option>
                  ))}
               </select>
               <button 
                  onClick={executeGeneratePlan}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
               >
                  <Database className="w-4 h-4" />
                  Sync & Generate
               </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
         <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
               <div className="text-sm font-medium text-gray-500 mb-2">Total RM BL</div>
               <div className="text-3xl font-bold text-gray-900">{currentPlan?.totalRmBlKg?.toLocaleString() || 0} <span className="text-lg text-gray-500">kg</span></div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
               <div className="text-sm font-medium text-gray-500 mb-2">Total RM BL-TH</div>
               <div className="text-3xl font-bold text-gray-900">{currentPlan?.totalRmBlThKg?.toLocaleString() || 0} <span className="text-lg text-gray-500">kg</span></div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
               <div className="text-sm font-medium text-gray-500 mb-2">Total RM BL-DR</div>
               <div className="text-3xl font-bold text-gray-900">{currentPlan?.totalRmBlDrKg?.toLocaleString() || 0} <span className="text-lg text-gray-500">kg</span></div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
               <div className="text-sm font-medium text-gray-500 mb-2">Total Demand</div>
               <div className="text-3xl font-bold text-gray-900">{currentPlan?.totalDemandKg?.toLocaleString() || 0} <span className="text-lg text-gray-500">kg</span></div>
            </div>
         </div>

         {/* Calendar Grid */}
         <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
               {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                 <div key={day} className="p-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                   {day}
                 </div>
               ))}
            </div>
            <div className="grid grid-cols-7 auto-rows-fr">
               {calendarDays.map((day, i) => {
                  const hasData = !!day.dailyData;
                  return (
                     <div 
                        key={i} 
                        onClick={() => handleDayClick(day)}
                        className={\`min-h-[120px] p-2 border-b border-r border-gray-100 relative group \${hasData ? 'cursor-pointer hover:bg-blue-50/30' : ''}\`}
                     >
                        <div className="font-medium text-sm text-gray-500 mb-2">{day.date.getDate()}</div>
                        {hasData && (
                           <div className="space-y-1">
                              <div className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                 RM: {day.dailyData.rmBlKg?.toLocaleString(undefined, {maximumFractionDigits:0})} kg
                              </div>
                              <div className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded">
                                 Demand: {day.dailyData.demandKg?.toLocaleString(undefined, {maximumFractionDigits:0})} kg
                              </div>
                           </div>
                        )}
                     </div>
                  );
               })}
            </div>
         </div>
      </div>
      
      {renderSupplyModal()}

      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
           <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-bold text-gray-900">{loadingPhase.message}</h3>
           </div>
        </div>
      )}
    </div>
  );
};

export default BLPlan;
`;

fs.writeFileSync(path.join(__dirname, 'src', 'pages', 'BLPlan.tsx'), simplifiedBlPlanCode);
console.log('BLPlan.tsx generated');
