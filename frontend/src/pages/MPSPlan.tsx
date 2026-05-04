import React, { useState } from 'react';
import { Calendar, Package, Users, Activity, Scale, Move, ChevronLeft, ChevronRight, Filter, FileText, Trash2, CalendarDays, ShoppingCart } from 'lucide-react';
import { motion } from 'framer-motion';

const API = import.meta.env.VITE_API_URL;





interface Spec {
  erpItemCode: string;
  productType: string;
  productYield: number;
  productSpeed: number;
}

const MPSPlan: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 4, 1)); // May 2026
  const [specs, setSpecs] = useState<Record<string, Spec>>({});
  const [loading, setLoading] = useState(true);
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'calendar' | 'drafts' | 'demand'>('calendar');
  const [plans, setPlans] = useState<any[]>([]);
  const [currentPlan, setCurrentPlan] = useState<any>(null);
  const [demandOrders, setDemandOrders] = useState<any[]>([]);

  React.useEffect(() => {
    initData();
  }, [currentMonth]);

  const initData = async () => {
    setLoading(true);
    await Promise.all([
      fetchSpecs(),
      fetchDemandOrders()
    ]);
    const allPlans = await fetchPlans();
    await loadPlanForMonth(allPlans);
    setLoading(false);
  };

  const fetchDemandOrders = async () => {
    try {
      const res = await fetch(`${API}/api/erp/demand-orders`);
      if (res.ok) {
        setDemandOrders(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPlans = async () => {
    try {
      const res = await fetch(`${API}/api/mps/plans`);
      if (res.ok) {
        const data = await res.json();
        setPlans(data);
        return data;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  };

  const fetchSpecs = async () => {
    try {
      const specRes = await fetch(`${API}/api/product-spec`);
      if (specRes.ok) {
        const rawSpecs = await specRes.json();
        const specMap: Record<string, Spec> = {};
        rawSpecs.forEach((s: any) => {
          specMap[s.erpItemCode] = {
            erpItemCode: s.erpItemCode,
            productType: s.productType,
            productYield: Number(s.productYield || 0),
            productSpeed: Number(s.productSpeed || 1)
          };
        });
        setSpecs(specMap);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadPlanForMonth = async (allPlans: any[]) => {
    const monthStr = `${currentMonth.getFullYear()}-${(currentMonth.getMonth() + 1).toString().padStart(2, '0')}`;
    const planForMonth = allPlans.find(p => p.targetMonth === monthStr);

    if (planForMonth) {
      try {
        const res = await fetch(`${API}/api/mps/plans/${planForMonth.id}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            setCurrentPlan(json.data);
            return;
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
    setCurrentPlan(null);
  };

  const handleDeletePlan = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this plan?')) return;
    try {
      const res = await fetch(`${API}/api/mps/plans/${id}/delete`, { method: 'POST' });
      if (res.ok) {
        initData();
      }
    } catch (e) {
      console.error(e);
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
    if (draggedOrderId && currentPlan) {
      // Optimistic update
      setCurrentPlan((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          orders: prev.orders.map((o: any) => String(o.id) === draggedOrderId
            ? { ...o, plannedProductionDate: date }
            : o)
        };
      });
      setDraggedOrderId(null);

      const mpsOrderId = parseInt(draggedOrderId);
      if (mpsOrderId) {
        try {
          await fetch(`${API}/api/mps/update-date`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId: currentPlan.id, mpsOrderId, date })
          });
        } catch (err) {
          console.error("Failed to update date", err);
          initData(); // rollback
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
      await initData();
    } catch (e) {
      console.error("Failed to generate plan", e);
    } finally {
      setLoading(false);
    }
  };

  // --- Calculations ---
  const calculateDailyMetrics = (date: string) => {
    if (!currentPlan) {
      return { intake: 0, intakeKg: 0, rmFlAvailable: 0, totalOrderQty: 0, manpower: 0, dailyOrders: [] };
    }

    const dailySummary = currentPlan.dailySummaries?.find((d: any) => d.productionDate.split('T')[0] === date);
    const dailyOrdersRaw = currentPlan.orders?.filter((o: any) => o.plannedProductionDate.split('T')[0] === date) || [];

    const dailyOrders = dailyOrdersRaw.map((o: any) => ({
      id: String(o.id), // Use the unique MpsPlanOrder primary key
      lineId: o.erpOrderLineId,
      itemCode: o.itemCode,
      itemDesc: o.itemDesc,
      type: o.productType,
      qty: Number(o.quantityKg)
    }));

    const totalOrderQty = dailyOrders.reduce((sum: number, o: any) => sum + o.qty, 0);

    // Dynamically calculate manpower
    let requiredCuttingWorkers = 0;
    dailyOrders.forEach((o: any) => {
      const spec = specs[o.itemCode];
      const speed = spec?.productSpeed || 45; // default 45 if not set
      requiredCuttingWorkers += (o.qty / speed);
    });
    requiredCuttingWorkers = requiredCuttingWorkers / 10;
    const supportWorkers = 28 * 1.0; 
    const totalManpower = Math.ceil(requiredCuttingWorkers + supportWorkers);

    return {
      intake: dailySummary ? Number(dailySummary.intakeBirds) : 0,
      intakeKg: dailySummary ? Number(dailySummary.rmFlAvailKg) : 0,
      rmFlAvailable: dailySummary ? Number(dailySummary.rmFlAvailKg) : 0,
      totalOrderQty, // Now dynamically calculated
      manpower: dailyOrders.length > 0 ? totalManpower : 0, // Only show manpower if there are orders
      dailyOrders
    };
  };

  // --- Calculate Summary Stats ---
  const totalIntakeBirds = currentPlan?.totalIntakeBirds || 0;
  const totalRmFlAvail = currentPlan?.totalRmFlKg || 0;
  const totalOrdersQty = currentPlan?.totalDemandKg || 0;

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

  // --- Derived State for Demand Plan Tab ---
  const currentMonthDemand = demandOrders.reduce((acc: any[], header: any) => {
    if (!header.lines) return acc;
    
    const filteredLines = header.lines.filter((line: any) => {
      if (!line.erpOrderShipDate) return false;
      if (!specs[line.erpOrderItemCode]) return false; // Filter only items in Product Spec
      const shipDate = new Date(line.erpOrderShipDate);
      return shipDate.getFullYear() === currentMonth.getFullYear() && 
             shipDate.getMonth() === currentMonth.getMonth();
    });

    if (filteredLines.length > 0) {
      acc.push({ ...header, lines: filteredLines });
    }
    return acc;
  }, []);

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

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-1 inline-flex w-full sm:w-auto overflow-x-auto">
        <button
          onClick={() => setActiveTab('calendar')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'calendar'
              ? 'bg-orange-50 text-orange-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}
        >
          <CalendarDays size={16} />
          Calendar View
        </button>
        <button
          onClick={() => setActiveTab('drafts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'drafts'
              ? 'bg-orange-50 text-orange-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}
        >
          <FileText size={16} />
          Plan Drafts
          {plans.length > 0 && (
            <span className="bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full text-xs font-bold">{plans.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('demand')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'demand'
              ? 'bg-orange-50 text-orange-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}
        >
          <ShoppingCart size={16} />
          Demand Plan
          {currentMonthDemand.length > 0 && (
            <span className="bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full text-xs font-bold">{currentMonthDemand.reduce((sum: number, h: any) => sum + h.lines.length, 0)}</span>
          )}
        </button>
      </div>

      {activeTab === 'calendar' ? (
        <>
          {currentPlan ? (
            <>
              {/* Overview Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Total Monthly Intake" value={totalIntakeBirds.toLocaleString()} unit="Birds" icon={Activity} color="blue" />
                <StatCard label="Total Orders" value={totalOrdersQty.toLocaleString()} unit="kg" icon={Package} color="orange" />
                <StatCard label="Estimated Total Yield" value={Math.round(totalRmFlAvail).toLocaleString()} unit="kg" icon={Scale} color="green" />
                <StatCard label="Avg. Daily Manpower" value={avgManpower.toString()} unit="People" icon={Users} color="purple" />
              </div>

              {/* Exceptions Alert */}
              {currentPlan.exceptions && currentPlan.exceptions.length > 0 && (
                <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 shadow-sm flex items-start gap-3">
                  <Activity className="text-red-500 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-bold">Unfulfilled Exceptions Detected</h4>
                    <p className="text-sm opacity-80 mb-2">There are {currentPlan.exceptions.length} items that could not be scheduled due to insufficient supply.</p>
                    <div className="max-h-32 overflow-y-auto text-xs bg-white rounded-lg border border-red-100 p-2 shadow-inner">
                      {currentPlan.exceptions.map((e: any) => (
                        <div key={e.id} className="py-1 border-b border-red-50 last:border-0 flex gap-4">
                          <span className="font-bold w-20 truncate">{e.itemCode}</span>
                          <span>{e.reason}</span>
                          <span className="font-bold text-red-600 w-20 text-right">Short: {Math.round(e.shortageKg)}kg</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

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
                              <span className="flex items-center gap-1"><Scale className="w-3 h-3" /> RM FL Total</span>
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
                          {metrics.dailyOrders.map((order: any) => (
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
            </>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center min-h-[400px] flex flex-col items-center justify-center">
              <CalendarDays size={48} className="text-gray-300 mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">No Plan Generated</h3>
              <p className="text-gray-500 mb-6">There is no production plan generated for {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })} yet.</p>
              <button onClick={handleGeneratePlan} className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-md transition-colors">
                Generate Plan Now
              </button>
            </div>
          )}
        </>
      ) : activeTab === 'drafts' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 min-h-[500px]">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <FileText className="text-orange-500" />
            Generated Plans & Drafts
          </h2>
          {plans.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <FileText size={48} className="mx-auto mb-4 opacity-30" />
              <p>No plans generated yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 border-b">ID</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 border-b">Plan Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 border-b">Target Month</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 border-b">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 border-b">Created</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600 border-b">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors border-b last:border-0">
                      <td className="px-4 py-3 font-mono text-gray-500">{p.id}</td>
                      <td className="px-4 py-3 font-semibold text-gray-800">{p.planName}</td>
                      <td className="px-4 py-3 text-gray-600">{p.targetMonth}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-xs font-bold">
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeletePlan(p.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Plan"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 min-h-[500px]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="text-orange-500" />
              Demand Plan (Sales Orders)
            </h2>
            <div className="text-sm text-gray-500">
              Showing demands for: <span className="font-bold text-gray-800">{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
            </div>
          </div>
          
          {currentMonthDemand.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <ShoppingCart size={48} className="mx-auto mb-4 opacity-30" />
              <p>No demand orders found for this month.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {currentMonthDemand.map((header: any) => (
                <div key={header.erpOrderHeaderId} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  {/* SO Header */}
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex gap-4">
                      <div>
                        <span className="text-xs text-gray-500 uppercase font-bold block">SO Number</span>
                        <span className="font-bold text-gray-800">{header.erpOrderHeaderId}</span>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 uppercase font-bold block">Customer</span>
                        <span className="font-medium text-gray-700">{header.customerName || '-'}</span>
                      </div>
                    </div>
                    <div className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold">
                      {header.lines.length} Lines
                    </div>
                  </div>
                  
                  {/* SO Lines */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-white">
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold text-gray-600 border-b w-24">Line ID</th>
                          <th className="px-4 py-2 text-left font-semibold text-gray-600 border-b">Item Code</th>
                          <th className="px-4 py-2 text-left font-semibold text-gray-600 border-b">Description</th>
                          <th className="px-4 py-2 text-right font-semibold text-gray-600 border-b w-32">Qty (kg)</th>
                          <th className="px-4 py-2 text-center font-semibold text-gray-600 border-b w-32">Ship Date</th>
                          <th className="px-4 py-2 text-center font-semibold text-gray-600 border-b w-24">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {header.lines.map((line: any) => (
                          <tr key={line.erpOrderLineId} className="hover:bg-gray-50 transition-colors border-b last:border-0 border-gray-100">
                            <td className="px-4 py-2 font-mono text-xs text-gray-500">{line.erpOrderLineId}</td>
                            <td className="px-4 py-2 font-medium text-gray-800">{line.erpOrderItemCode}</td>
                            <td className="px-4 py-2 text-gray-600 truncate max-w-[200px]" title={line.erpItemDesc}>{line.erpItemDesc || '-'}</td>
                            <td className="px-4 py-2 text-right font-bold text-blue-700">{Number(line.erpOrderItemQty).toLocaleString()}</td>
                            <td className="px-4 py-2 text-center text-gray-600">
                              {new Date(line.erpOrderShipDate).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-2 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${line.erpOrderStatus === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                {line.erpOrderStatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
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
