import React, { useState, useEffect } from 'react';
import { Layers, Activity, AlertCircle, CheckCircle } from 'lucide-react';

const API = import.meta.env.VITE_API_URL;

interface Order {
  id: string;
  itemCode: string;
  itemDesc: string;
  qty: number;
  type: string;
  size: string; // From spec
  unfulfilledKg: number;
  fulfilledKg: number;
}

interface Sublot {
  id: string;
  farmName: string;
  totalBirds: number;
  totalWeightKg: number;
  avgLiveWeight: number;
  bins: Record<string, number>; // Size label -> kg available
  coProductKg: number;
}

const DPSPlan: React.FC = () => {
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split('T')[0]);
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
        fetch(`${API}/api/erp/demand-orders`),
        fetch(`${API}/api/product-spec`),
        fetch(`${API}/api/weight-distribution`)
      ]);

      // 1. Load Weight Distribution Matrix
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

      // 3. Load & Process Sublots (Intake for targetDate)
      const newSublots: Sublot[] = [];
      if (intakeRes.ok) {
        const rawIntake = await intakeRes.json();
        const dailyIntakes = rawIntake.filter((r: any) => r.receivingDate?.split('T')[0] === targetDate);
        
        dailyIntakes.forEach((r: any, idx: number) => {
          const birds = Number(r.totalBirds || 0);
          const weight = Number(r.totalWeightKg || 0);
          if (birds === 0) return;
          
          const avgLiveWeight = weight / birds;
          const slaughteredWeight = weight * 0.957 * 0.95;
          const coProductKg = slaughteredWeight * 0.04 * 0.093; // 9.3% Grade B
          const baseYield = slaughteredWeight * 0.04 * 0.8; // Base piece yield

          // Find closest row in matrix for avgLiveWeight
          let matchRow = null;
          if (loadedMatrix && loadedMatrix.rows.length > 0) {
            matchRow = loadedMatrix.rows.reduce((prev: string, curr: string) => 
              Math.abs(Number(curr) - avgLiveWeight) < Math.abs(Number(prev) - avgLiveWeight) ? curr : prev
            );
          }

          const bins: Record<string, number> = {};
          if (matchRow && loadedMatrix) {
            loadedMatrix.cols.forEach((col: string) => {
              const pct = loadedMatrix.data[matchRow]?.[col] || 0;
              bins[col] = baseYield * pct;
            });
          } else {
             // Fallback if no matrix: put all in 'unsize'
             bins['unsize'] = baseYield * (1 - 0.093);
          }

          newSublots.push({
            id: `SL-${idx + 1}`,
            farmName: r.farmName || `Farm ${idx + 1}`,
            totalBirds: birds,
            totalWeightKg: weight,
            avgLiveWeight,
            bins,
            coProductKg
          });
        });
      }
      setSublots(newSublots);

      // 4. Load & Process Orders (Demand for targetDate)
      let initialOrders: Order[] = [];
      if (orderRes.ok) {
        const rawOrders = await orderRes.json();
        rawOrders.forEach((h: any) => {
          h.lines?.forEach((l: any) => {
            const shipDate = l.plannedProductionDate ? l.plannedProductionDate.split('T')[0] : (l.erpOrderShipDate ? l.erpOrderShipDate.split('T')[0] : '');
            if (shipDate === targetDate) {
              const spec = specMap[l.erpOrderItemCode];
              initialOrders.push({
                id: `L-${l.erpOrderLineId}`,
                itemCode: l.erpOrderItemCode,
                itemDesc: l.erpItemDesc || l.erpOrderItemCode,
                qty: Number(l.erpOrderItemQty),
                type: spec?.type || 'chilled',
                size: spec?.size || 'unsize',
                unfulfilledKg: Number(l.erpOrderItemQty),
                fulfilledKg: 0
              });
            }
          });
        });
      }

      // --- CASCADING WATERFALL ALLOCATION ---
      // Clone state for mutation
      const mutSublots = JSON.parse(JSON.stringify(newSublots));
      
      // We will allocate orders inline.
      // Pass 1: Exact Size Match
      initialOrders.forEach(order => {
        if (order.size !== 'unsize' && order.unfulfilledKg > 0) {
          mutSublots.forEach((sl: any) => {
            const avail = sl.bins[order.size] || 0;
            if (avail > 0 && order.unfulfilledKg > 0) {
              const take = Math.min(avail, order.unfulfilledKg);
              sl.bins[order.size] -= take;
              order.fulfilledKg += take;
              order.unfulfilledKg -= take;
            }
          });
        }
      });

      // Pass 2: Unsize Allocation
      initialOrders.forEach(order => {
        if (order.size === 'unsize' && order.unfulfilledKg > 0) {
          mutSublots.forEach((sl: any) => {
            Object.keys(sl.bins).forEach(binSize => {
              const avail = sl.bins[binSize] || 0;
              if (avail > 0 && order.unfulfilledKg > 0) {
                const take = Math.min(avail, order.unfulfilledKg);
                sl.bins[binSize] -= take;
                order.fulfilledKg += take;
                order.unfulfilledKg -= take;
              }
            });
          });
        }
      });

      // Pass 3: Co-Product Allocation (Grade B)
      // Assuming item desc contains "Grade B" or code = 111141106
      initialOrders.forEach(order => {
        if ((order.itemCode === '111141106' || order.itemDesc.includes('Grade B')) && order.unfulfilledKg > 0) {
           mutSublots.forEach((sl: any) => {
              const avail = sl.coProductKg || 0;
              if (avail > 0 && order.unfulfilledKg > 0) {
                const take = Math.min(avail, order.unfulfilledKg);
                sl.coProductKg -= take;
                order.fulfilledKg += take;
                order.unfulfilledKg -= take;
              }
           });
        }
      });

      setOrders(initialOrders);

    } catch (e) {
      console.error("Error loading DPS data:", e);
    } finally {
      setLoading(false);
    }
  };

  // --- Summary Metrics ---
  const totalDemand = orders.reduce((sum, o) => sum + o.qty, 0);
  const totalFulfilled = orders.reduce((sum, o) => sum + o.fulfilledKg, 0);
  const percentFulfilled = totalDemand > 0 ? (totalFulfilled / totalDemand) * 100 : 0;
  
  const totalSupplyFg = sublots.reduce((sum, sl) => sum + Object.values(sl.bins).reduce((a,b)=>a+b,0), 0);

  return (
    <div className="p-6 max-w-full mx-auto space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-end bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <Layers className="w-8 h-8 text-blue-500" />
            Daily Production Scheduling (DPS)
          </h1>
          <p className="text-gray-500 mt-2 text-sm">แผนการผลิตรายวัน (Cascade Waterfall Allocation)</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} 
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" />
          <button onClick={fetchData} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-200 transition-all flex items-center gap-2">
            <Activity className="w-4 h-4" /> Run Allocation
          </button>
        </div>
      </div>

      {/* Summary Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-center">
          <p className="text-xs font-bold text-gray-400 uppercase">Sublots</p>
          <p className="text-2xl font-black text-gray-800">{sublots.length}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-center">
          <p className="text-xs font-bold text-blue-400 uppercase">Est. Supply Available</p>
          <p className="text-2xl font-black text-blue-600">{Math.round(totalSupplyFg).toLocaleString()} <span className="text-sm">kg</span></p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-center">
          <p className="text-xs font-bold text-orange-400 uppercase">Total Demand</p>
          <p className="text-2xl font-black text-orange-600">{Math.round(totalDemand).toLocaleString()} <span className="text-sm">kg</span></p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-center">
          <p className="text-xs font-bold text-green-500 uppercase">Fulfillment Rate</p>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-black text-green-600">{percentFulfilled.toFixed(1)}%</p>
            {percentFulfilled >= 100 && <CheckCircle className="w-5 h-5 text-green-500 mb-1" />}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left: Orders (Demand) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="bg-gray-50 border-b border-gray-200 p-4 font-bold text-gray-700 flex items-center justify-between">
            <span>Daily Orders (Demand)</span>
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-lg">{orders.length} items</span>
          </div>
          <div className="p-4 space-y-3 overflow-y-auto max-h-[600px] custom-scrollbar">
            {loading ? <p className="text-center text-gray-400 py-10">Loading...</p> : orders.length === 0 ? <p className="text-center text-gray-400 py-10">No orders for this date</p> : null}
            {orders.map(o => {
              const isFull = o.unfulfilledKg <= 0;
              const pct = o.qty > 0 ? (o.fulfilledKg / o.qty) * 100 : 0;
              return (
                <div key={o.id} className={`p-4 rounded-xl border ${isFull ? 'bg-green-50/50 border-green-200' : 'bg-white border-gray-200'} shadow-sm relative overflow-hidden`}>
                  {/* Progress Bar BG */}
                  <div className="absolute top-0 left-0 bottom-0 bg-green-100/30 -z-10" style={{ width: `${Math.min(100, pct)}%` }}></div>
                  
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-gray-800">{o.itemDesc}</h4>
                      <p className="text-[10px] text-gray-500 font-mono mt-0.5">{o.itemCode} • Size: <span className="font-bold text-indigo-600">{o.size}</span></p>
                    </div>
                    <span className="text-sm font-black text-gray-700">{o.qty.toLocaleString()} kg</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-xs mt-3">
                    <span className="text-green-600 font-semibold flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Allocated: {Math.round(o.fulfilledKg).toLocaleString()} kg</span>
                    {o.unfulfilledKg > 0 ? (
                      <span className="text-red-500 font-bold flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Short: {Math.round(o.unfulfilledKg).toLocaleString()} kg</span>
                    ) : (
                      <span className="text-green-600 font-bold bg-green-100 px-2 py-0.5 rounded text-[10px] uppercase">Fulfilled</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Sublots (Supply) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="bg-gray-50 border-b border-gray-200 p-4 font-bold text-gray-700 flex items-center justify-between">
            <span>Intake Sublots (Supply)</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg">{sublots.length} lots</span>
          </div>
          <div className="p-4 space-y-4 overflow-y-auto max-h-[600px] custom-scrollbar">
            {loading ? <p className="text-center text-gray-400 py-10">Loading...</p> : sublots.length === 0 ? <p className="text-center text-gray-400 py-10">No intakes for this date</p> : null}
            {sublots.map(sl => {
               const totalAvail = Object.values(sl.bins).reduce((a,b)=>a+b,0);
               return (
                <div key={sl.id} className="p-4 rounded-xl border border-blue-100 bg-blue-50/20 shadow-sm">
                  <div className="flex justify-between items-start border-b border-blue-100 pb-2 mb-2">
                    <div>
                      <h4 className="font-bold text-blue-900">{sl.farmName} <span className="text-xs text-blue-500 ml-1">({sl.id})</span></h4>
                      <p className="text-[10px] text-gray-500 font-mono mt-0.5">Avg WT: <span className="font-bold text-gray-700">{sl.avgLiveWeight.toFixed(2)} kg</span></p>
                    </div>
                    <div className="text-right">
                       <span className="text-xs font-bold text-blue-700 block">Est. FG: {Math.round(totalAvail).toLocaleString()} kg</span>
                       <span className="text-[10px] text-orange-600 font-medium">Grade B: {Math.round(sl.coProductKg).toLocaleString()} kg</span>
                    </div>
                  </div>
                  {/* Bins View */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {Object.entries(sl.bins).filter(([_, qty]) => qty > 0).map(([size, qty]) => (
                      <div key={size} className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-center min-w-[60px]">
                        <p className="text-[9px] text-gray-400 font-bold uppercase">{size}</p>
                        <p className="text-xs font-black text-gray-700">{Math.round(qty)}</p>
                      </div>
                    ))}
                  </div>
                </div>
               );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};

export default DPSPlan;
