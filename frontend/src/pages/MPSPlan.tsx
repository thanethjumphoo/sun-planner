import React, { useState } from 'react';
import { Calendar, Package, Users, Activity, Scale, Move, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { motion } from 'framer-motion';

const API = import.meta.env.VITE_API_URL;

interface Order {
  id: string; // use line id or generated
  headerId: number;
  lineId: number;
  date: string; // schedule ship date
  itemCode: string;
  itemDesc: string;
  qty: number;
  type: string; // chill/freeze from spec
  shipDate?: string;
  status: string;
}

interface Intake {
  date: string;
  totalBirds: number;
  totalWeightKg: number;
}

interface Spec {
  erpItemCode: string;
  productType: string;
  productYield: number;
  productSpeed: number;
}

const MPSPlan: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 4, 1)); // May 2026
  const [orders, setOrders] = useState<Order[]>([]);
  const [intakes, setIntakes] = useState<Record<string, Intake>>({});
  const [specs, setSpecs] = useState<Record<string, Spec>>({});
  const [loading, setLoading] = useState(true);
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);

  React.useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [intakeRes, orderRes, specRes] = await Promise.all([
        fetch(`${API}/api/chicken-receiving/daily`), // Assuming this exists or similar
        fetch(`${API}/api/erp/demand-orders`),
        fetch(`${API}/api/product-spec`)
      ]);
      
      let intakeData = {};
      if (intakeRes.ok) {
        const rawIntake = await intakeRes.json();
        // aggregate by date
        const agg: Record<string, Intake> = {};
        if (Array.isArray(rawIntake)) {
          rawIntake.forEach((r: any) => {
            const d = r.receivingDate ? r.receivingDate.split('T')[0] : null;
            if (d) {
              if (!agg[d]) agg[d] = { date: d, totalBirds: 0, totalWeightKg: 0 };
              agg[d].totalBirds += Number(r.totalBirds || 0);
              agg[d].totalWeightKg += Number(r.totalWeightKg || 0);
            }
          });
        }
        intakeData = agg;
      }
      setIntakes(intakeData);

      let specMap: Record<string, Spec> = {};
      if (specRes.ok) {
        const rawSpecs = await specRes.json();
        rawSpecs.forEach((s: any) => {
          specMap[s.erpItemCode] = {
            erpItemCode: s.erpItemCode,
            productType: s.productType,
            productYield: Number(s.productYield || 0),
            productSpeed: Number(s.productSpeed || 1)
          };
        });
      }
      setSpecs(specMap);

      if (orderRes.ok) {
        const rawOrders = await orderRes.json();
        const parsedOrders: Order[] = [];
        rawOrders.forEach((h: any) => {
          h.lines?.forEach((l: any) => {
             const spec = specMap[l.erpOrderItemCode];
             
             // Only show orders that have a Product Spec defined!
             if (!spec) return;
             
             parsedOrders.push({
               id: `L-${l.erpOrderLineId}`,
               headerId: h.erpOrderHeaderId,
               lineId: l.erpOrderLineId,
               date: l.plannedProductionDate ? l.plannedProductionDate.split('T')[0] : (l.erpOrderShipDate ? l.erpOrderShipDate.split('T')[0] : ''),
               shipDate: l.erpOrderShipDate ? l.erpOrderShipDate.split('T')[0] : '',
               itemCode: l.erpOrderItemCode,
               itemDesc: l.erpItemDesc || l.erpOrderItemCode,
               qty: Number(l.erpOrderItemQty),
               type: spec?.productType || 'chilled', // default to chilled
               status: l.erpOrderStatus
             });
          });
        });
        setOrders(parsedOrders);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // --- Calendar Helpers ---
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i + 1);
    return d.toISOString().split('T')[0];
  });

  // --- Drag and Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, orderId: string) => {
    setDraggedOrderId(orderId);
    e.dataTransfer.setData('text/plain', orderId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, date: string) => {
    e.preventDefault();
    if (draggedOrderId) {
      // Optimistic UI update
      setOrders(prev => prev.map(o => o.id === draggedOrderId ? { ...o, date } : o));
      
      const order = orders.find(o => o.id === draggedOrderId);
      setDraggedOrderId(null);

      // Save to backend
      if (order && order.lineId) {
        try {
          await fetch(`${API}/api/mps/update-date`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lineId: order.lineId, date })
          });
        } catch (err) {
          console.error("Failed to update date", err);
          fetchData(); // rollback
        }
      }
    }
  };

  const handleGeneratePlan = async () => {
    setLoading(true);
    try {
      const monthStr = `${currentMonth.getFullYear()}-${(currentMonth.getMonth() + 1).toString().padStart(2, '0')}`;
      const res = await fetch(`${API}/api/mps/generate`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetMonth: monthStr })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Plan generated successfully! Plan ID: ${data.planId}`);
      }
      await fetchData();
    } catch (e) {
      console.error("Failed to generate plan", e);
    } finally {
      setLoading(false);
    }
  };

  // --- Calculations ---
  const calculateDailyMetrics = (date: string) => {
    // 1. Demand for this date
    const dailyOrders = orders.filter(o => o.date === date);
    const totalOrderQty = dailyOrders.reduce((sum, o) => sum + o.qty, 0);
    
    // 2. Supply for this date
    const intake = intakes[date] || { totalBirds: 0, totalWeightKg: 0 };
    
    // 3. RM FL Available
    // RM FL Available (kg) = total_weight_kg × 0.957 × 0.95 × 0.04 × (1 - 0.093)
    const rmFlAvailable = intake.totalWeightKg * 0.957 * 0.95 * 0.04 * (1 - 0.093);

    // 4. Manpower Calculation
    // Cutting Workers = Sum(น้ำหนักสินค้าในวันนั้น / item_speed) / 10
    let requiredCuttingWorkers = 0;
    dailyOrders.forEach(o => {
      const spec = specs[o.itemCode];
      const speed = spec?.productSpeed || 45; // default 45 if not set
      requiredCuttingWorkers += (o.qty / speed);
    });
    requiredCuttingWorkers = requiredCuttingWorkers / 10;
    
    // Support Workers = Base (28) * Shift Factor (Assume 1.0 for now)
    const supportWorkers = 28 * 1.0; 
    const totalManpower = Math.ceil(requiredCuttingWorkers + supportWorkers);

    return { 
      intake: intake.totalBirds, 
      intakeKg: intake.totalWeightKg,
      totalOrderQty, 
      rmFlAvailable, 
      requiredYield: totalOrderQty, // simplified
      manpower: totalManpower, 
      dailyOrders 
    };
  };

  // --- Calculate Summary Stats ---
  const totalIntakeBirds = Object.values(intakes).reduce((sum, intk) => sum + intk.totalBirds, 0);
  const totalRmFlAvail = Object.values(intakes).reduce((sum, intk) => sum + (intk.totalWeightKg * 0.957 * 0.95 * 0.04 * (1 - 0.093)), 0);
  const totalOrdersQty = orders.reduce((sum, o) => sum + o.qty, 0);
  
  // Calculate average manpower only for active days
  let totalManpowerSum = 0;
  let activeDaysCount = 0;
  days.forEach(d => {
    const metrics = calculateDailyMetrics(d);
    if (metrics.intake > 0 || metrics.totalOrderQty > 0) {
      totalManpowerSum += metrics.manpower;
      activeDaysCount++;
    }
  });
  const avgManpower = activeDaysCount > 0 ? Math.round(totalManpowerSum / activeDaysCount) : 0;

  return (
    <div className="p-6 max-w-full mx-auto space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-end bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <Calendar className="w-8 h-8 text-orange-500" />
            Master Production Schedule (MPS)
          </h1>
          <p className="text-gray-500 mt-2 text-sm">วางแผนการผลิตรายเดือน, ดูปริมาณไก่เข้า, คำนวณ Yield และ Manpower</p>
        </div>
        <div className="flex gap-3">
          <button disabled={loading} onClick={handleGeneratePlan} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white shadow-md transition-all ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 shadow-orange-200'}`}>
            <Activity className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> 
            {loading ? 'Generating...' : 'Generate & Save Plan'}
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-sm font-medium text-gray-700 shadow-sm transition-all">
            <Filter className="w-4 h-4" /> Filter
          </button>
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
            <button 
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
              className="p-1.5 hover:bg-white rounded-lg transition-colors text-gray-600">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="px-4 text-sm font-bold text-gray-800">
              {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </span>
            <button 
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
              className="p-1.5 hover:bg-white rounded-lg transition-colors text-gray-600">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Monthly Intake" value={totalIntakeBirds.toLocaleString()} unit="Birds" icon={Activity} color="blue" />
        <StatCard label="Total Orders" value={totalOrdersQty.toLocaleString()} unit="kg" icon={Package} color="orange" />
        <StatCard label="Estimated Total Yield" value={Math.round(totalRmFlAvail).toLocaleString()} unit="kg" icon={Scale} color="green" />
        <StatCard label="Avg. Daily Manpower" value={avgManpower.toString()} unit="People" icon={Users} color="purple" />
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 auto-rows-fr">
          {/* Empty slots for first week */}
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[160px] border-r border-b border-gray-100 bg-gray-50/50"></div>
          ))}

          {/* Actual Days */}
          {days.map((date, i) => {
            const metrics = calculateDailyMetrics(date);
            const dayNum = i + 1;
            const isToday = false; // Mock

            return (
              <div 
                key={date}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, date)}
                className={`min-h-[180px] border-r border-b border-gray-100 p-2 flex flex-col gap-2 transition-colors
                  ${isToday ? 'bg-orange-50/30' : 'bg-white hover:bg-gray-50'}
                `}
              >
                {/* Day Header */}
                <div className="flex justify-between items-start mb-1">
                  <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold
                    ${isToday ? 'bg-orange-500 text-white shadow-md' : 'text-gray-700'}`}>
                    {dayNum}
                  </span>
                  {metrics.intake > 0 && (
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                      🐔 {metrics.intake.toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Metrics Summary (if activity exists) */}
                {(metrics.intake > 0 || metrics.totalOrderQty > 0) && (
                  <div className="bg-gray-50 rounded-lg p-2 text-[10px] space-y-1.5 border border-gray-100 shadow-inner">
                    <div className="flex justify-between items-center text-gray-600">
                      <span className="flex items-center gap-1"><Scale className="w-3 h-3" /> RM FL Avail</span>
                      <span className="font-semibold">{Math.round(metrics.rmFlAvailable).toLocaleString()} kg</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-600">
                      <span className="flex items-center gap-1"><Package className="w-3 h-3" /> Demand</span>
                      <span className={`font-semibold ${metrics.totalOrderQty > metrics.rmFlAvailable ? 'text-red-500' : 'text-green-600'}`}>
                        {Math.round(metrics.totalOrderQty).toLocaleString()} kg
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-gray-600 pt-1 border-t border-gray-200">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" /> Staff</span>
                      <span className="font-semibold text-indigo-600">{metrics.manpower} pax</span>
                    </div>
                  </div>
                )}

                {/* Orders Dropzone */}
                <div className="flex-1 space-y-1.5 overflow-y-auto pr-1 custom-scrollbar">
                  {metrics.dailyOrders.map(order => (
                    <motion.div
                      layoutId={order.id}
                      draggable
                      onDragStart={(e: any) => handleDragStart(e, order.id)}
                      key={order.id}
                      className={`p-2 rounded-lg text-xs cursor-grab active:cursor-grabbing border shadow-sm
                        ${order.type === 'chilled' ? 'bg-green-50 border-green-200' : 'bg-cyan-50 border-cyan-200'}
                      `}
                    >
                      <div className="flex justify-between font-bold mb-1">
                        <span className="truncate pr-2 text-gray-800" title={order.itemDesc}>{order.itemDesc}</span>
                        <Move className="w-3 h-3 text-gray-400 opacity-50" />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-gray-500 font-medium">{order.itemCode}</span>
                        <span className={`font-bold ${order.type === 'chilled' ? 'text-green-700' : 'text-cyan-700'}`}>
                          {order.qty.toLocaleString()}kg
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// --- Sub Components ---
const StatCard = ({ label, value, unit, icon: Icon, color }: any) => {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100'
  };

  const iconColors: Record<string, string> = {
    blue: 'text-blue-500', orange: 'text-orange-500', green: 'text-green-500', purple: 'text-purple-500'
  };

  return (
    <div className={`p-5 rounded-2xl border ${colors[color]} shadow-sm flex items-center justify-between`}>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider opacity-70 mb-1">{label}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-black">{value}</span>
          <span className="text-sm font-semibold opacity-80">{unit}</span>
        </div>
      </div>
      <div className="bg-white p-3 rounded-xl shadow-sm">
        <Icon className={`w-6 h-6 ${iconColors[color]}`} />
      </div>
    </div>
  );
};

export default MPSPlan;
