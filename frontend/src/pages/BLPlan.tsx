import React, { useState, useEffect } from 'react';
import { Calendar, Package, Users, Activity, Scale, ChevronLeft, ChevronRight, FileText, CalendarDays, ShoppingCart, Info, AlertTriangle, Database, RefreshCw, Scissors } from 'lucide-react';

const API = import.meta.env.VITE_API_URL;

const BLPlan: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 4, 1)); // May 2026
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'calendar' | 'drafts' | 'demand'>('calendar');
  const [expandedDaily, setExpandedDaily] = useState<number | null>(null);
  
  const [, setPlans] = useState<any[]>([]);
  const [currentPlan, setCurrentPlan] = useState<any>(null);
  const [mainPlans, setMainPlans] = useState<any[]>([]);
  const [selectedMainPlanId, setSelectedMainPlanId] = useState<string>('');
  const [syncing, setSyncing] = useState(false);
  
  const [blColLabelsMap, setBlColLabelsMap] = useState<Record<string, string>>({});
  const [demandOrders, setDemandOrders] = useState<any[]>([]);
  const [masterYield, setMasterYield] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, [currentMonth]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch bil mapping first
      try {
        const resBil = await fetch(`${API}/api/bil-weight-distribution`);
        if (resBil.ok) {
          const d = await resBil.json();
          setBlColLabelsMap(d.blColLabelsMap || {});
        }
      } catch (e) {
        console.error('Error fetching bil data:', e);
      }

      // Fetch master yield
      try {
        const resYield = await fetch(`${API}/api/master-yield`);
        if (resYield.ok) {
          const d = await resYield.json();
          setMasterYield(d);
        }
      } catch (e) {
        console.error('Error fetching master yield:', e);
      }

      // Fetch demand orders
      try {
        const resDemand = await fetch(`${API}/api/erp/demand-orders`);
        if (resDemand.ok) {
          const d = await resDemand.json();
          // Map ERP orders to flat structure expected by BL plan
          const mappedOrders = d.flatMap((header: any) => 
            (header.lines || []).map((line: any) => {
              // Try to extract size from description (e.g., "110-120", "180 Down")
              const sizeMatch = line.erpItemDesc?.match(/(\d+-\d+|\d+\s*Up|\d+\s*Down)/i);
              const specSize = sizeMatch ? sizeMatch[0] : 'Unsized';
              
              return {
                 orderDate: line.erpOrderShipDate || header.erpOrderDate,
                 orderNumber: header.erpOrderNumber,
                 partName: line.erpItemDesc || '',
                 specSize: specSize,
                 status: line.erpOrderStatus,
                 totalWeightKg: line.erpOrderItemQty || 0
              };
            })
          );
          setDemandOrders(mappedOrders);
        }
      } catch (e) {
        console.error('Error fetching demand:', e);
      }

      const monthStr = `${currentMonth.getFullYear()}-${(currentMonth.getMonth() + 1).toString().padStart(2, '0')}`;
      
      const resBl = await fetch(`${API}/api/bl-mps-plans`);
      if (resBl.ok) {
        const data = await resBl.json();
        const filtered = data.filter((p: any) => p.planMonth === monthStr);
        setPlans(filtered);
        if (filtered.length > 0) fetchPlanDetails(filtered[0].id);
        else setCurrentPlan(null);
      }

      const resMain = await fetch(`${API}/api/mps/plans?partType=bil`);
      if (resMain.ok) {
        const dataMain = await resMain.json();
        const filteredMain = dataMain.filter((p: any) => p.targetMonth === monthStr);
        setMainPlans(filteredMain);
        if (filteredMain.length > 0) setSelectedMainPlanId(filteredMain[0].id.toString());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlanDetails = async (id: number) => {
    try {
      const res = await fetch(`${API}/api/bl-mps-plans/${id}`);
      if (res.ok) setCurrentPlan(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleSync = async () => {
    if (!selectedMainPlanId) return;
    setSyncing(true);
    try {
      const res = await fetch(`${API}/api/bl-mps-plans/sync/${selectedMainPlanId}`, { method: 'POST' });
      if (res.ok) {
        const syncedPlan = await res.json();
        setCurrentPlan(syncedPlan);
        fetchData();
      } else {
        alert('Failed to sync. Make sure the selected plan is a valid BIL plan.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSyncing(false);
    }
  };

  const handlePrevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  const renderOverviewCard = (label: string, value: string | number, unit: string, color: string, Icon: any) => {
    const colors: Record<string, string> = {
      blue: 'bg-blue-50 border-blue-200 text-blue-900',
      orange: 'bg-orange-50 border-orange-200 text-orange-900',
      green: 'bg-emerald-50 border-emerald-200 text-emerald-900',
      purple: 'bg-purple-50 border-purple-200 text-purple-900',
      amber: 'bg-amber-50 border-amber-200 text-amber-900',
    };

    const iconColors: Record<string, string> = {
      blue: 'text-blue-500', orange: 'text-orange-500', green: 'text-green-500', purple: 'text-purple-500', amber: 'text-amber-500'
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-screen flex flex-col gap-6">
      
      {/* ─── HEADER ─── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-blue-600 font-bold text-sm bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">Sub-MPS</span>
            <span className="text-gray-400 font-medium text-sm">Bone in Leg &gt; BL</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
            BL MPS Plan
          </h1>
          <p className="text-gray-500 mt-2 font-medium">Manage Debone, Belt Gate Allocation, and I-CUT processing.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
          {/* Month Selector */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1.5 flex items-center gap-2">
            <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-900 transition-colors">
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-2 px-2 min-w-[140px] justify-center">
              <CalendarDays size={16} className="text-orange-500" />
              <span className="font-bold text-gray-800">
                {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </span>
            </div>
            <button onClick={handleNextMonth} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-900 transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Sync Button */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1.5 flex items-center gap-2 pl-4">
            <select
              value={selectedMainPlanId}
              onChange={(e) => setSelectedMainPlanId(e.target.value)}
              className="bg-transparent text-sm font-bold text-gray-700 outline-none pr-4"
            >
              {mainPlans.map(p => (
                <option key={p.id} value={p.id}>{p.planName || `Plan ${p.id}`}</option>
              ))}
              {mainPlans.length === 0 && <option value="">No Main Plans found</option>}
            </select>
            <button
              onClick={handleSync}
              disabled={syncing || !selectedMainPlanId}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-5 py-2.5 rounded-lg font-bold transition-all shadow-sm disabled:opacity-50"
            >
              <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
              <span>{syncing ? 'Syncing...' : 'Sync Data'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── OVERVIEW CARDS ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {renderOverviewCard('RM BL Received', Math.round(currentPlan?.totalRmBlKg || 0).toLocaleString(), 'kg', 'blue', Activity)}
        {renderOverviewCard('🟢 Internal BL', Math.round(currentPlan?.totalInternalRmBlKg || 0).toLocaleString(), 'kg', 'green', Database)}
        {renderOverviewCard('🟠 External BL', Math.round(currentPlan?.totalExternalRmBlKg || 0).toLocaleString(), 'kg', 'amber', Package)}
        {renderOverviewCard('Allocated to Orders', Math.round(currentPlan?.totalDemandBlKg || 0).toLocaleString(), 'kg', 'orange', ShoppingCart)}
        {renderOverviewCard('Remaining (to I-CUT)', Math.round((currentPlan?.totalRmBlKg || 0) - (currentPlan?.totalDemandBlKg || 0)).toLocaleString(), 'kg', 'purple', Scissors)}
      </div>

      {/* ─── TABS ─── */}
      <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-gray-200 w-fit">
        {[
          { id: 'calendar', label: 'Calendar View', icon: Calendar },
          { id: 'drafts', label: 'Draft Plans', icon: FileText },
          { id: 'demand', label: 'Demand Orders', icon: ShoppingCart },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200
              ${activeTab === tab.id
                ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── MAIN CONTENT ─── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 min-h-[500px] flex flex-col">
        {loading ? (
          <div className="flex flex-col items-center gap-4 text-gray-400">
            <RefreshCw size={40} className="animate-spin text-blue-500" />
            <p className="font-bold">Loading Data...</p>
          </div>
        ) : !currentPlan ? (
          <div className="text-center text-gray-400">
            <Package size={64} className="mx-auto mb-4 opacity-50" />
            <p className="text-xl font-bold text-gray-700">No BL Plan Found</p>
            <p className="mt-2">Please select a Main MPS plan and click Sync Data to generate a Sub-MPS plan.</p>
          </div>
        ) : (
          <div className="w-full flex-1 overflow-auto bg-gray-50 p-6">
            {activeTab === 'calendar' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-100/80 border-b border-gray-200 text-gray-700 font-bold uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="px-4 py-3 border-r border-gray-200">Date</th>
                      <th className="px-4 py-3 border-r border-gray-200 text-right bg-blue-50/50">RM BL Received</th>
                      <th className="px-4 py-3 border-r border-gray-200 text-right bg-green-50/50">Allocated to Size</th>
                      <th className="px-4 py-3 border-r border-gray-200 text-right bg-purple-50/50">Sent to I-CUT</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentPlan.dailyPlans?.map((daily: any) => {
                      const isExpanded = expandedDaily === daily.id;
                      
                      // Parse the BIL Sizes used
                      let bilSizes: Record<string, number> = {};
                      try {
                        if (daily.rmBlSizingJson) bilSizes = JSON.parse(daily.rmBlSizingJson);
                      } catch(e){}

                      // Map BIL sizes to BL sizes
                      const blSizes: Record<string, number> = {};
                      Object.entries(bilSizes).forEach(([bilSize, qty]) => {
                        const targetBlSize = blColLabelsMap[bilSize] || 'Unsized';
                        blSizes[targetBlSize] = (blSizes[targetBlSize] || 0) + qty;
                      });

                      // Since RM BL is ~20% of BIL (from coproduct rules), 
                      // the raw quantity in bilSizes is actually the BIL weight, NOT the BL weight!
                      // Wait, earlier I saved the EXACT BIL weight into rmBlSizingJson.
                      // Let's proportionally scale it down to match the daily.rmBlKg
                      const totalBilKg = Object.values(bilSizes).reduce((a, b) => a + b, 0);
                      const scalingFactor = totalBilKg > 0 ? daily.rmBlKg / totalBilKg : 0;
                      
                      const scaledBlSizes: Record<string, number> = {};
                      Object.entries(blSizes).forEach(([size, qty]) => {
                        scaledBlSizes[size] = qty * scalingFactor;
                      });

                      // Calculate Belt Gate Match (Exact Match)
                      const planDateStr = daily.planDate.split('T')[0];
                      const dayOrders = demandOrders.filter(o => o.orderDate?.startsWith(planDateStr) && o.partName?.includes('BL'));
                      
                      let totalAllocatedKg = 0;
                      const sizeMatches: Record<string, { orderIds: string[], allocatedKg: number }> = {};
                      
                      // For each size available in RM BL, try to fulfill matching orders
                      Object.entries(scaledBlSizes).forEach(([size, qty]) => {
                        let remainingQty = qty;
                        const matchingOrders = dayOrders.filter(o => o.specSize === size && o.status !== 'CANCELLED');
                        
                        matchingOrders.forEach(order => {
                          if (remainingQty > 0) {
                            const orderNeeded = order.totalWeightKg; // Simplified logic, ideally subtract fulfilled
                            const allocateAmt = Math.min(orderNeeded, remainingQty);
                            if (allocateAmt > 0) {
                              if (!sizeMatches[size]) sizeMatches[size] = { orderIds: [], allocatedKg: 0 };
                              sizeMatches[size].orderIds.push(order.orderNumber);
                              sizeMatches[size].allocatedKg += allocateAmt;
                              remainingQty -= allocateAmt;
                              totalAllocatedKg += allocateAmt;
                            }
                          }
                        });
                      });

                      const icutInputKg = daily.rmBlKg - totalAllocatedKg;
                      // const icutBlockKg = icutInputKg * 0.20; // 20% Co-product rule
                      // const icutSpecKg = icutInputKg * 0.80;

                      return (
                      <React.Fragment key={daily.id}>
                        <tr className={`border-b border-gray-100 hover:bg-gray-50/80 cursor-pointer ${isExpanded ? 'bg-blue-50/30' : ''}`}
                            onClick={() => setExpandedDaily(isExpanded ? null : daily.id)}>
                          <td className="px-4 py-3 border-r border-gray-100 font-bold text-gray-800">
                            {new Date(daily.planDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                          </td>
                          <td className="px-4 py-3 border-r border-gray-100 text-right bg-blue-50/30">
                            <span className="font-bold text-blue-800">{Math.round(daily.rmBlKg).toLocaleString()} kg</span>
                            <div className="flex justify-end gap-2 mt-0.5">
                              <span className="text-[10px] font-semibold text-green-700 bg-green-50 px-1.5 py-0.5 rounded">🟢 {Math.round(daily.internalRmBlKg || 0).toLocaleString()}</span>
                              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">🟠 {Math.round(daily.externalRmBlKg || 0).toLocaleString()}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 border-r border-gray-100 text-right text-green-800 font-bold bg-green-50/30">
                            {Math.round(totalAllocatedKg).toLocaleString()} kg
                          </td>
                          <td className="px-4 py-3 border-r border-gray-100 text-right text-purple-800 font-bold bg-purple-50/30">
                            {Math.round(icutInputKg).toLocaleString()} kg
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg font-bold transition-colors">
                              {isExpanded ? 'Close' : 'Manage'}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-gray-50/50 shadow-inner">
                            <td colSpan={5} className="p-6">
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                
                                {/* Panel 1: Debone Input (Mapped Sizes) */}
                                <div className="bg-white rounded-xl shadow-sm border border-blue-200 overflow-hidden">
                                  <div className="bg-blue-50 border-b border-blue-100 px-4 py-3 flex items-center justify-between">
                                    <h4 className="font-bold text-blue-900 flex items-center gap-2"><Activity size={16}/> 1. RM BL by Size</h4>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">🟢 Int: {Math.round(daily.internalRmBlKg || 0).toLocaleString()}</span>
                                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">🟠 Ext: {Math.round(daily.externalRmBlKg || 0).toLocaleString()}</span>
                                      <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">{Math.round(daily.rmBlKg).toLocaleString()} kg</span>
                                    </div>
                                  </div>
                                  <div className="p-4">
                                    <div className="space-y-2">
                                      {Object.entries(scaledBlSizes).map(([size, qty]) => (
                                        <div key={size} className="flex justify-between items-center text-sm border-b border-gray-50 pb-1">
                                          <span className="font-medium text-gray-600">{size}</span>
                                          <span className="font-bold text-blue-800">{Math.round(qty).toLocaleString()} kg</span>
                                        </div>
                                      ))}
                                      {Object.keys(scaledBlSizes).length === 0 && (
                                        <p className="text-gray-400 text-center py-4 text-xs">No sizing data found.</p>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Panel 2: Belt Gate Size Match */}
                                <div className="bg-white rounded-xl shadow-sm border border-green-200 overflow-hidden">
                                  <div className="bg-green-50 border-b border-green-100 px-4 py-3 flex items-center justify-between">
                                    <h4 className="font-bold text-green-900 flex items-center gap-2"><Scale size={16}/> 2. Belt Gate Allocation</h4>
                                    <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">{Math.round(totalAllocatedKg).toLocaleString()} kg</span>
                                  </div>
                                  <div className="p-4">
                                    <p className="text-xs text-gray-500 mb-4">Auto-allocates RM BL to specific orders that require an exact size match.</p>
                                    <div className="space-y-2">
                                      {Object.entries(sizeMatches).map(([size, match]) => (
                                        <div key={size} className="text-sm border border-green-100 rounded-lg p-2 bg-green-50/30">
                                          <div className="flex justify-between font-bold text-green-800 mb-1">
                                            <span>Size: {size}</span>
                                            <span>{Math.round(match.allocatedKg).toLocaleString()} kg</span>
                                          </div>
                                          <div className="text-xs text-gray-500 flex flex-wrap gap-1">
                                            {match.orderIds.map(oid => (
                                              <span key={oid} className="bg-white border border-gray-200 px-1 rounded">{oid}</span>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                      {Object.keys(sizeMatches).length === 0 && (
                                        <p className="text-gray-400 text-center py-4 text-xs italic">No exact matches found. All RM BL goes to I-CUT.</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* ─── ROW 2: I-CUT + Manual Trimming ─── */}
                              {(() => {
                                const ICUT_CAP_KG_PER_HR = 1200;
                                const ICUT_WORKING_HRS = 8;
                                const ICUT_DAILY_CAP = ICUT_CAP_KG_PER_HR * ICUT_WORKING_HRS;
                                const icutUtilPct = ICUT_DAILY_CAP > 0 ? (icutInputKg / ICUT_DAILY_CAP) * 100 : 0;
                                const isOverCap = icutUtilPct > 100;

                                // Dynamically lookup I-CUT yield from Master Yield Tree
                                let icutProductPct = 0.80; // Default fallback
                                let icutCoProductPct = 0.20; // Default fallback

                                if (masterYield && masterYield.length > 0) {
                                  const blRoot = masterYield.find(n => n.name.includes('BL Processing') || n.name.includes('BL'));
                                  if (blRoot && blRoot.children) {
                                    const blCat = blRoot.children.find((c: any) => c.name.includes('BL ('));
                                    if (blCat && blCat.children) {
                                      const prod = blCat.children.find((c: any) => c.type === 'PRODUCT');
                                      const coprod = blCat.children.find((c: any) => c.type === 'CO-PRODUCT');
                                      if (prod) icutProductPct = prod.yieldPercentage;
                                      if (coprod) icutCoProductPct = coprod.yieldPercentage;
                                    }
                                  }
                                }

                                const icutBlockKg = icutInputKg * icutCoProductPct; 
                                const icutSpecKg = icutInputKg * icutProductPct;

                                // Parse BL sizes to generate BLK trimming options (1 size down)
                                const blkTrimmingOptions: { fromSize: string; toSize: string; availableKg: number }[] = [];
                                const sortedSizes = Object.entries(scaledBlSizes)
                                  .map(([size, qty]) => {
                                    const rangeMatch = size.match(/(\d+)-(\d+)/);
                                    const lo = rangeMatch ? parseInt(rangeMatch[1]) : 0;
                                    const hi = rangeMatch ? parseInt(rangeMatch[2]) : 0;
                                    return { size, qty: qty as number, lo, hi };
                                  })
                                  .filter(s => s.lo > 0)
                                  .sort((a, b) => a.lo - b.lo);
                                
                                for (let i = 1; i < sortedSizes.length; i++) {
                                  const from = sortedSizes[i];
                                  const to = sortedSizes[i - 1];
                                  const blockQty = (from.qty * icutCoProductPct); // Dynamic % from Master Yield
                                  if (blockQty > 0) {
                                    blkTrimmingOptions.push({
                                      fromSize: from.size,
                                      toSize: to.size,
                                      availableKg: blockQty
                                    });
                                  }
                                }

                                return (
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                                {/* Panel 3: I-CUT Processing + Capacity Alert */}
                                <div className="bg-white rounded-xl shadow-sm border border-purple-200 overflow-hidden flex flex-col">
                                  <div className="bg-purple-50 border-b border-purple-100 px-4 py-3 flex items-center justify-between">
                                    <h4 className="font-bold text-purple-900 flex items-center gap-2"><Scissors size={16}/> 3. I-CUT Processing</h4>
                                    <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">{Math.round(icutInputKg).toLocaleString()} kg</span>
                                  </div>
                                  <div className="p-4 flex-1 flex flex-col">
                                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 mb-4 space-y-2">
                                      <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-600 font-medium">Input to I-CUT:</span>
                                        <span className="font-bold text-purple-800">{Math.round(icutInputKg).toLocaleString()} kg</span>
                                      </div>
                                      <div className="flex justify-between items-center text-sm border-t border-gray-200 pt-2">
                                        <span className="text-gray-600 font-medium">Est. Main Product (80%):</span>
                                        <span className="font-bold text-green-600">{Math.round(icutSpecKg).toLocaleString()} kg</span>
                                      </div>
                                      <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-600 font-medium">Est. BL Block (20%):</span>
                                        <span className="font-bold text-amber-600">{Math.round(icutBlockKg).toLocaleString()} kg</span>
                                      </div>
                                    </div>

                                    {/* ─── Capacity Gauge ─── */}
                                    <div className={`rounded-lg p-3 border mb-4 ${isOverCap ? 'bg-red-50 border-red-300' : 'bg-emerald-50 border-emerald-200'}`}>
                                      <div className="flex justify-between items-center mb-2">
                                        <span className={`text-xs font-bold uppercase tracking-wider ${isOverCap ? 'text-red-700' : 'text-emerald-700'}`}>
                                          {isOverCap ? '🔴 OVER CAPACITY' : '🟢 Within Capacity'}
                                        </span>
                                        <span className={`text-sm font-black ${isOverCap ? 'text-red-800' : 'text-emerald-800'}`}>
                                          {icutUtilPct.toFixed(0)}%
                                        </span>
                                      </div>
                                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                        <div
                                          className={`h-3 rounded-full transition-all duration-700 ${isOverCap ? 'bg-gradient-to-r from-red-500 to-red-600' : 'bg-gradient-to-r from-emerald-400 to-emerald-600'}`}
                                          style={{ width: `${Math.min(icutUtilPct, 100)}%` }}
                                        />
                                      </div>
                                      <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                                        <span>0 kg</span>
                                        <span>Cap: {ICUT_DAILY_CAP.toLocaleString()} kg/day ({ICUT_WORKING_HRS}h × {ICUT_CAP_KG_PER_HR.toLocaleString()} kg/hr)</span>
                                      </div>
                                      {isOverCap && (
                                        <div className="mt-2 flex items-center gap-2 text-xs text-red-700 font-bold bg-red-100 p-2 rounded-md">
                                          <AlertTriangle size={14} />
                                          <span>Over by {Math.round(icutInputKg - ICUT_DAILY_CAP).toLocaleString()} kg — consider diverting to Manual Trimming.</span>
                                        </div>
                                      )}
                                    </div>
                                    
                                    <div className="mt-auto pt-4 border-t border-gray-100">
                                       <div className="flex items-center gap-2">
                                          <div className="flex-1 bg-purple-50 p-2 rounded border border-purple-100 text-center">
                                            <span className="block text-[10px] uppercase text-purple-600 font-bold">Est. Hrs</span>
                                            <span className="font-black text-purple-900">{(icutInputKg / ICUT_CAP_KG_PER_HR).toFixed(1)} h</span>
                                          </div>
                                          <div className="flex-1 bg-blue-50 p-2 rounded border border-blue-100 text-center">
                                            <span className="block text-[10px] uppercase text-blue-600 font-bold">Machines</span>
                                            <span className="font-black text-blue-900">{Math.ceil((icutInputKg / ICUT_CAP_KG_PER_HR) / ICUT_WORKING_HRS)}</span>
                                          </div>
                                          <div className="flex-1 bg-orange-50 p-2 rounded border border-orange-100 text-center">
                                            <span className="block text-[10px] uppercase text-orange-600 font-bold">Staff</span>
                                            <span className="font-black text-orange-900">{Math.ceil((icutInputKg / ICUT_CAP_KG_PER_HR) / ICUT_WORKING_HRS) * 30}</span>
                                          </div>
                                       </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Panel 4: Manual Trimming (BL Block → BLK) */}
                                <div className="bg-white rounded-xl shadow-sm border border-amber-200 overflow-hidden flex flex-col">
                                  <div className="bg-amber-50 border-b border-amber-100 px-4 py-3 flex items-center justify-between">
                                    <h4 className="font-bold text-amber-900 flex items-center gap-2"><Users size={16}/> 4. Manual Trimming (CO-PD)</h4>
                                    <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">{Math.round(icutBlockKg).toLocaleString()} kg block</span>
                                  </div>
                                  <div className="p-4 flex-1 flex flex-col">
                                    <p className="text-xs text-gray-500 mb-3">BL Block (20% from I-CUT) can be manually trimmed into BLK products at 1 size down.</p>
                                    
                                    <div className="bg-amber-50/50 rounded-lg p-3 border border-amber-100 mb-4">
                                      <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-600 font-medium">Available BL Block:</span>
                                        <span className="font-bold text-amber-800">{Math.round(icutBlockKg).toLocaleString()} kg</span>
                                      </div>
                                    </div>

                                    <div className="space-y-2 flex-1">
                                      <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Trimming Options (Block → 1 Size Down)</p>
                                      {blkTrimmingOptions.length > 0 ? blkTrimmingOptions.map((opt, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-sm border border-amber-100 rounded-lg p-2 bg-amber-50/20">
                                          <span className="font-bold text-amber-800 min-w-[70px]">{opt.fromSize}</span>
                                          <span className="text-gray-400">→</span>
                                          <span className="font-bold text-green-700 min-w-[70px]">{opt.toSize}</span>
                                          <span className="ml-auto text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                            ~{Math.round(opt.availableKg).toLocaleString()} kg
                                          </span>
                                        </div>
                                      )) : (
                                        <p className="text-gray-400 text-center py-4 text-xs italic">No trimming options available (need range-based sizes).</p>
                                      )}
                                    </div>

                                    <div className="mt-auto pt-4 border-t border-gray-100">
                                      <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <Info size={12} />
                                        <span>Manual trimming requires additional staff. Block is trimmed from higher size to produce lower size BLK product.</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                                );
                              })()}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                      );
                    })}
                    {(!currentPlan.dailyPlans || currentPlan.dailyPlans.length === 0) && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                          No daily data found. Try syncing again.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {activeTab === 'drafts' && <div className="p-8 text-center text-gray-400 font-bold">Draft Plans (Coming Soon)</div>}
            {activeTab === 'demand' && <div className="p-8 text-center text-gray-400 font-bold">Demand Orders (Coming Soon)</div>}
          </div>
        )}
      </div>

    </div>
  );
};

export default BLPlan;
