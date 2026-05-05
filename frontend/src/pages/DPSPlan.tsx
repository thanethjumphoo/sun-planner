import React, { useState, useEffect } from 'react';
import { Layers, Activity, CheckCircle, Package, TrendingUp, Calendar, ArrowRight } from 'lucide-react';

const API = import.meta.env.VITE_API_URL;

interface Order {
  id: string;
  itemCode: string;
  itemDesc: string;
  qty: number;
  type: string;
  size: string;
  unfulfilledKg: number;
  fulfilledKg: number;
}

interface Allocation {
  orderId: string;
  itemDesc: string;
  size: string;
  qty: number;
}

interface Sublot {
  id: string;
  farmName: string;
  totalBirds: number;
  totalWeightKg: number;
  avgLiveWeight: number;
  
  initialBins: Record<string, number>; // Before allocation
  bins: Record<string, number>; // Remaining after allocation
  
  initialCoProductKg: number;
  coProductKg: number;
  
  shift: string;
  allocations: Allocation[];
  initialTotalFg: number;
}

const sizeLabelMap: Record<string, string> = {
  '1': '40 DOWN',
  '2': '40-45',
  '3': '45-50',
  '4': '50-55',
  '5': '55-60',
  '6': '60-65',
  '7': '65-70',
  '8': '70 UP',
};

const sizeColorMap: Record<string, string> = {
  '40 DOWN': 'bg-slate-500',
  '40-45': 'bg-blue-500',
  '45-50': 'bg-cyan-500',
  '50-55': 'bg-emerald-500',
  '55-60': 'bg-green-500',
  '60-65': 'bg-amber-500',
  '65-70': 'bg-orange-500',
  '70 UP': 'bg-red-500',
  'unsize': 'bg-gray-400',
  'Grade B': 'bg-orange-400'
};

const getSizeLabel = (sz: string) => sizeLabelMap[sz] || sz;
const getSizeColor = (sz: string) => sizeColorMap[getSizeLabel(sz)] || 'bg-gray-400';


const DPSPlan: React.FC = () => {
  // Use local date to avoid UTC timezone shift
  const formatLocalDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const [targetDate, setTargetDate] = useState(formatLocalDate(new Date()));
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [sublots, setSublots] = useState<Sublot[]>([]);

  useEffect(() => {
    fetchData();
  }, [targetDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [intakeRes, orderRes, specRes, wdRes] = await Promise.all([
        fetch(`${API}/api/chicken-receiving/daily`), 
        fetch(`${API}/api/mps/approved-orders/${targetDate}`),
        fetch(`${API}/api/product-spec`),
        fetch(`${API}/api/weight-distribution`)
      ]);

      // 1. Load Matrix
      let loadedMatrix = null;
      if (wdRes.ok) {
        const d = await wdRes.json();
        loadedMatrix = { rows: d.rowLabels, cols: d.colLabels, data: d.matrix };
      }

      // 2. Load Specs
      const specMap: Record<string, any> = {};
      if (specRes.ok) {
        const rawSpecs = await specRes.json();
        rawSpecs.forEach((s: any) => {
          specMap[s.erpItemCode] = { type: s.productType, size: s.productSize };
        });
      }

      // 3. Load Sublots
      const loadedSublots: Sublot[] = [];
      if (intakeRes.ok) {
        const rawIntake = await intakeRes.json();
        const dailyIntakes = rawIntake.filter((r: any) => {
          const rDate = r.receive_date ? (typeof r.receive_date === 'string' ? r.receive_date.split('T')[0] : formatLocalDate(new Date(r.receive_date))) : '';
          return rDate === targetDate;
        });
        
        const groupedBySublot: Record<string, any> = {};
        dailyIntakes.forEach((r: any, idx: number) => {
          // Normalize sublotId: trim whitespace and ensure string
          const rawSublot = r.sublot !== null && r.sublot !== undefined ? String(r.sublot).trim() : '';
          const sublotId = rawSublot || `SL-${idx + 1}`;
          
          if (!groupedBySublot[sublotId]) {
            groupedBySublot[sublotId] = {
              id: sublotId,
              farmName: r.farm_name || `Unknown Farm`,
              shift: r.shift || 'Unassigned',
              totalBirds: 0,
              totalWeightKg: 0
            };
          }
          groupedBySublot[sublotId].totalBirds += Number(r.chicken_count || 0);
          groupedBySublot[sublotId].totalWeightKg += Number(r.chicken_weight || 0);
        });

        Object.values(groupedBySublot).forEach((grp: any) => {
          if (grp.totalBirds === 0) return;
          
          const avgLiveWeight = grp.totalWeightKg / grp.totalBirds;
          const slaughteredWeight = grp.totalWeightKg * 0.957 * 0.95;
          const rmFlTotal = slaughteredWeight * 0.04;
          const rmFlGradeB = rmFlTotal * 0.093;
          const netFillet = rmFlTotal - rmFlGradeB;

          let matchRow = null;
          if (loadedMatrix && loadedMatrix.rows.length > 0) {
            matchRow = loadedMatrix.rows.reduce((prev: string, curr: string) => 
              Math.abs(Number(curr) - avgLiveWeight) < Math.abs(Number(prev) - avgLiveWeight) ? curr : prev
            );
          }

          const bins: Record<string, number> = {};
          if (matchRow && loadedMatrix) {
            loadedMatrix.cols.forEach((col: string) => {
              // ONLY allow sizes that are defined in our mapping
              if (!sizeLabelMap[col]) return; 
              
              const pct = loadedMatrix.data[matchRow]?.[col] || 0;
              bins[col] = netFillet * (pct / 100);
            });
          } else {
             bins['unsize'] = netFillet;
          }

          const initialTotalFg = Object.values(bins).reduce((a,b)=>a+b,0);

          loadedSublots.push({
            id: grp.id,
            farmName: grp.farmName,
            totalBirds: grp.totalBirds,
            totalWeightKg: grp.totalWeightKg,
            avgLiveWeight,
            initialBins: { ...bins },
            bins: { ...bins },
            initialCoProductKg: rmFlGradeB,
            coProductKg: rmFlGradeB,
            shift: grp.shift,
            allocations: [],
            initialTotalFg
          });
        });
      }

      // 4. Load Orders
      let initialOrders: Order[] = [];
      if (orderRes.ok) {
        const rawOrders = await orderRes.json();
        rawOrders.forEach((l: any) => {
          const spec = specMap[l.itemCode];
          initialOrders.push({
            id: `L-${l.erpOrderLineId}`,
            itemCode: l.itemCode,
            itemDesc: l.itemDesc,
            qty: Number(l.quantityKg),
            type: spec?.type || l.productType || 'chilled',
            size: spec?.size || 'unsize',
            unfulfilledKg: Number(l.quantityKg),
            fulfilledKg: 0
          });
        });
      }

      // 5. CASCADE WATERFALL ALLOCATION (Mutates loadedSublots and initialOrders inline)
      
      // Pass 1: Exact Size Match
      initialOrders.forEach(order => {
        if (order.size !== 'unsize' && order.unfulfilledKg > 0) {
          loadedSublots.forEach(sl => {
            const avail = sl.bins[order.size] || 0;
            if (avail > 0 && order.unfulfilledKg > 0) {
              const take = Math.min(avail, order.unfulfilledKg);
              sl.bins[order.size] -= take;
              order.fulfilledKg += take;
              order.unfulfilledKg -= take;
              sl.allocations.push({ orderId: order.id, itemDesc: order.itemDesc, size: order.size, qty: take });
            }
          });
        }
      });

      // Pass 2: Unsize Allocation
      initialOrders.forEach(order => {
        if (order.size === 'unsize' && order.unfulfilledKg > 0) {
          loadedSublots.forEach(sl => {
            Object.keys(sl.bins).forEach(binSize => {
              const avail = sl.bins[binSize] || 0;
              if (avail > 0 && order.unfulfilledKg > 0) {
                const take = Math.min(avail, order.unfulfilledKg);
                sl.bins[binSize] -= take;
                order.fulfilledKg += take;
                order.unfulfilledKg -= take;
                sl.allocations.push({ orderId: order.id, itemDesc: order.itemDesc, size: binSize, qty: take });
              }
            });
          });
        }
      });

      // Pass 3: Co-Product (Grade B)
      initialOrders.forEach(order => {
        if ((order.itemCode === '111141106' || order.itemDesc.includes('Grade B')) && order.unfulfilledKg > 0) {
           loadedSublots.forEach(sl => {
              const avail = sl.coProductKg || 0;
              if (avail > 0 && order.unfulfilledKg > 0) {
                const take = Math.min(avail, order.unfulfilledKg);
                sl.coProductKg -= take;
                order.fulfilledKg += take;
                order.unfulfilledKg -= take;
                sl.allocations.push({ orderId: order.id, itemDesc: order.itemDesc, size: 'Grade B', qty: take });
              }
           });
        }
      });

      setSublots(loadedSublots);
      setOrders(initialOrders);

    } catch (e) {
      console.error("Error loading DPS data:", e);
    } finally {
      setLoading(false);
    }
  };

  const totalDemand = orders.reduce((sum, o) => sum + o.qty, 0);
  const totalFulfilled = orders.reduce((sum, o) => sum + o.fulfilledKg, 0);
  const percentFulfilled = totalDemand > 0 ? (totalFulfilled / totalDemand) * 100 : 0;
  const totalSublots = sublots.length;

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6 bg-[#f8fafc] min-h-screen font-sans">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end bg-white p-6 rounded-3xl shadow-sm border border-gray-100 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Layers className="w-7 h-7" />
            </div>
            Daily Production Scheduling
          </h1>
          <p className="text-gray-500 mt-2 text-sm max-w-xl">
            Cascade Waterfall Allocation at the Sublot Level. Analyzes each incoming sublot and allocates RM sizes to fulfill the approved Master Production Schedule (MPS) demand sequentially.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-2xl border border-gray-100">
          <div className="flex items-center gap-2 px-3">
            <Calendar className="w-5 h-5 text-gray-400" />
            <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} 
              className="bg-transparent border-none text-sm font-bold text-gray-700 focus:ring-0 outline-none cursor-pointer" />
          </div>
          <button onClick={fetchData} className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-bold shadow-md transition-all flex items-center gap-2">
            <Activity className="w-4 h-4" /> Run Schedule
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* STEP 1: DEMAND */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
               <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                 <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                   <TrendingUp size={16} />
                 </div>
                 Step 1: Daily Orders (Demand)
               </h2>
               <div className="flex items-center gap-4 text-sm">
                 <div className="flex items-center gap-2">
                   <span className="text-gray-500">Target Demand:</span>
                   <span className="font-black text-gray-900">{totalDemand.toLocaleString()} kg</span>
                 </div>
                 <div className="flex items-center gap-2">
                   <span className="text-gray-500">Fulfilled:</span>
                   <span className={`font-black ${percentFulfilled >= 100 ? 'text-green-600' : 'text-orange-500'}`}>
                     {totalFulfilled.toLocaleString()} kg ({percentFulfilled.toFixed(1)}%)
                   </span>
                 </div>
               </div>
            </div>
            
            <div className="p-6 bg-gray-50">
              {orders.length === 0 ? (
                <p className="text-center text-gray-400 py-10 font-medium">No approved MPS orders found for this date.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {orders.map(o => {
                    const pct = o.qty > 0 ? (o.fulfilledKg / o.qty) * 100 : 0;
                    const isFull = o.unfulfilledKg <= 0;
                    return (
                      <div key={o.id} className={`relative overflow-hidden rounded-2xl border ${isFull ? 'border-green-200 bg-white' : 'border-gray-200 bg-white'} shadow-sm p-5 transition-all hover:shadow-md`}>
                        {/* Progress Bar Background */}
                        <div className="absolute top-0 left-0 bottom-0 bg-green-50 z-0 transition-all duration-1000" style={{ width: `${Math.min(100, pct)}%`}}></div>
                        
                        <div className="relative z-10 flex flex-col h-full justify-between">
                          <div>
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{o.itemCode}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isFull ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                {isFull ? 'COMPLETED' : 'PENDING'}
                              </span>
                            </div>
                            <h3 className="font-bold text-gray-900 leading-tight mb-1">{o.itemDesc}</h3>
                            <p className="text-xs text-indigo-600 font-semibold mb-4">Required Size: {o.size}</p>
                          </div>
                          
                          <div>
                            <div className="flex justify-between items-end mb-1">
                              <span className="text-2xl font-black text-gray-900">{o.fulfilledKg.toLocaleString()} <span className="text-sm text-gray-400 font-medium">/ {o.qty.toLocaleString()} kg</span></span>
                            </div>
                            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full ${isFull ? 'bg-green-500' : 'bg-orange-400'}`} style={{ width: `${Math.min(100, pct)}%`}}></div>
                            </div>
                            {o.unfulfilledKg > 0 && <p className="text-[10px] text-red-500 font-bold mt-2 text-right">Short: {o.unfulfilledKg.toLocaleString()} kg</p>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* STEP 2: SUBLOTS ALLOCATION */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white/80 backdrop-blur-md z-20">
               <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                 <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                   <Package size={16} />
                 </div>
                 Step 2: Sublot-by-Sublot Fulfillment (Supply)
               </h2>
               <div className="text-sm font-bold text-gray-500">
                  {totalSublots} Sublots Total
               </div>
            </div>

            <div className="p-6 space-y-6 bg-gray-50/50">
              {sublots.length === 0 ? (
                <p className="text-center text-gray-400 py-10 font-medium">No chicken receiving sublots found for this date.</p>
              ) : (
                sublots.map((sl, index) => {
                  const totalAllocated = sl.allocations.reduce((sum, a) => sum + a.qty, 0);
                  const totalRemaining = Object.values(sl.bins).reduce((a,b)=>a+b,0) + sl.coProductKg;
                  const utilPct = sl.initialTotalFg > 0 ? (totalAllocated / sl.initialTotalFg) * 100 : 0;

                  return (
                    <div key={sl.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col xl:flex-row">
                      
                      {/* Left: Sublot Info */}
                      <div className="w-full xl:w-1/3 bg-gray-50 border-r border-gray-200 p-6 flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                          <Package size={100} />
                        </div>
                        <div className="relative z-10">
                          <div className="flex items-center gap-2 mb-4">
                            <span className="bg-gray-900 text-white text-xs font-black px-2 py-1 rounded-md">#{index + 1}</span>
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{sl.shift}</span>
                          </div>
                          <h3 className="text-xl font-black text-gray-900 mb-6">Sublot {sl.id}</h3>
                          
                          <div className="grid grid-cols-2 gap-4 mb-6">
                            <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase">Intake Birds</p>
                              <p className="text-lg font-bold text-gray-800">{sl.totalBirds.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase">Avg Live WT</p>
                              <p className="text-lg font-bold text-blue-600">{sl.avgLiveWeight.toFixed(2)} <span className="text-xs">kg</span></p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase">Total Weight</p>
                              <p className="text-lg font-bold text-gray-800">{Math.round(sl.totalWeightKg).toLocaleString()} <span className="text-xs">kg</span></p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase">Est. FG Yield</p>
                              <p className="text-lg font-bold text-gray-800">{Math.round(sl.initialTotalFg).toLocaleString()} <span className="text-xs">kg</span></p>
                            </div>
                          </div>
                        </div>

                        <div className="relative z-10 pt-4 border-t border-gray-200">
                          <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Sublot Utilization</p>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500" style={{ width: `${utilPct}%` }}></div>
                            </div>
                            <span className="text-xs font-bold text-gray-700">{utilPct.toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Fulfillment & Remaining */}
                      <div className="w-full xl:w-2/3 flex flex-col md:flex-row">
                        
                        {/* Center: Allocations made */}
                        <div className="w-full md:w-1/2 p-6 border-r border-gray-100 border-dashed">
                          <h4 className="text-xs font-bold text-green-600 uppercase tracking-wider flex items-center gap-2 mb-4">
                            <CheckCircle size={14} /> Fulfilling Orders
                          </h4>
                          
                          {sl.allocations.length === 0 ? (
                            <div className="h-32 flex items-center justify-center border-2 border-dashed border-gray-100 rounded-xl">
                              <p className="text-xs text-gray-400 font-medium">No orders fulfilled by this sublot</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {sl.allocations.map((a, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-green-50/50 border border-green-100 rounded-xl">
                                  <div className="flex-1">
                                    <p className="text-sm font-bold text-gray-800 truncate pr-2">{a.itemDesc}</p>
                                    <p className="text-[10px] text-gray-500 mt-0.5">Matched Size: <span className="font-bold text-indigo-600">{getSizeLabel(a.size)}</span></p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <ArrowRight size={14} className="text-gray-300" />
                                    <span className="font-black text-green-600 bg-white px-2 py-1 rounded-md shadow-sm border border-green-50">
                                      +{a.qty.toLocaleString()} <span className="text-[10px]">kg</span>
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Far Right: Remaining Yields */}
                        <div className="w-full md:w-1/2 p-6 bg-gray-50/30">
                          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 mb-4">
                            <Package size={14} /> Remaining Yields (Pass to Next/Stock)
                          </h4>
                          
                          <div className="space-y-4">
                            {/* Remaining Bins Grid */}
                            <div className="grid grid-cols-2 gap-3">
                              {Object.entries(sl.bins).map(([sz, q]) => {
                                const label = getSizeLabel(sz);
                                const color = getSizeColor(sz);
                                const total = Object.values(sl.bins).reduce((a, b) => a + b, 0);
                                const pct = total > 0 ? (q / total) * 100 : 0;
                                
                                return (
                                  <div key={sz} className="bg-white border border-gray-100 p-3 rounded-2xl shadow-sm hover:border-blue-200 transition-all">
                                    <p className="text-[9px] font-bold text-gray-400 uppercase mb-1 tracking-wider">{label}</p>
                                    <div className="flex items-baseline gap-1">
                                      <span className="text-base font-black text-gray-800">{q.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                                      <span className="text-[9px] font-bold text-gray-400">kg</span>
                                    </div>
                                    <div className="mt-2 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                                      <div className={`h-full ${color} opacity-80`} style={{ width: `${pct}%` }}></div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            
                            {/* Remaining Co-Product */}
                            {sl.coProductKg > 0 && (
                              <div className="p-3 bg-orange-50 border border-orange-100 rounded-2xl shadow-sm flex justify-between items-center">
                                <div>
                                  <p className="text-[9px] text-orange-400 font-bold uppercase tracking-wider">Grade B (Co-Product)</p>
                                  <p className="text-base font-black text-orange-800">{Math.round(sl.coProductKg).toLocaleString()} <span className="text-xs font-medium opacity-60">kg</span></p>
                                </div>
                                <div className="w-12 h-1 bg-orange-200 rounded-full overflow-hidden">
                                  <div className="h-full bg-orange-500 w-full"></div>
                                </div>
                              </div>
                            )}

                            {totalRemaining <= 0 && (
                              <div className="p-4 bg-gray-100 rounded-xl text-center">
                                <p className="text-xs font-bold text-gray-500">100% Fully Utilized</p>
                              </div>
                            )}
                          </div>
                        </div>

                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default DPSPlan;
