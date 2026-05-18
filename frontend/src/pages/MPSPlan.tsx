import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
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
}

// ─── Part Configuration: Controls all part-specific text, labels and calculations ───
const PART_CONFIGS: Record<string, {
  title: string;
  rmPrefix: string;      // e.g. "RM FL" or "RM BIL"
  yieldLabel: string;    // e.g. "Fillet Yield" or "BIL Yield"
  sizeBreakdownTitle: string;
  netLabel: string;      // e.g. "Net Fillet Available" or "Net BIL Available"
}> = {
  fillet: {
    title: 'Fillet',
    rmPrefix: 'RM FL',
    yieldLabel: 'Fillet Yield',
    sizeBreakdownTitle: 'Fillet Size Breakdown',
    netLabel: 'Net Fillet Available',
  },
  bil: {
    title: 'Bone in Leg',
    rmPrefix: 'RM BIL',
    yieldLabel: 'BIL Yield',
    sizeBreakdownTitle: 'BIL Size Breakdown',
    netLabel: 'Net BIL Available',
  },
};

const MPSPlan: React.FC = () => {
  const { partId } = useParams<{ partId: string }>();
  const pc = PART_CONFIGS[partId || 'fillet'] || PART_CONFIGS['fillet'];
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 4, 1)); // May 2026
  const [specs, setSpecs] = useState<Record<string, Spec>>({});
  const [loading, setLoading] = useState(true);
  const [loadingPhase, setLoadingPhase] = useState<{ mode: 'loading' | 'generating' | 'importing'; step: number; message: string }>({ mode: 'loading', step: 0, message: 'Initializing...' });
  const [loadingStartTime, setLoadingStartTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Elapsed time tracker
  useEffect(() => {
    if (!loading) { setElapsedTime(0); return; }
    const interval = setInterval(() => {
      setElapsedTime(loadingStartTime > 0 ? Math.floor((Date.now() - loadingStartTime) / 1000) : 0);
    }, 200);
    return () => clearInterval(interval);
  }, [loading, loadingStartTime]);
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'calendar' | 'drafts' | 'demand'>('calendar');
  const [plans, setPlans] = useState<any[]>([]);
  const [currentPlan, setCurrentPlan] = useState<any>(null);
  const [demandOrders, setDemandOrders] = useState<any[]>([]);
  const [manpowerData, setManpowerData] = useState<any[]>([]);
  const [selectedSupply, setSelectedSupply] = useState<any>(null);
  const [selectedManpower, setSelectedManpower] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedDailyOrders, setSelectedDailyOrders] = useState<any[]>([]);
  const [expandedSizeBins, setExpandedSizeBins] = useState<Record<string, boolean>>({});
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [highlightedSoNumber, setHighlightedSoNumber] = useState<string | null>(null);
  const [priorityMap, setPriorityMap] = useState<Record<number, number | null>>({});
  const [priorityDirty, setPriorityDirty] = useState(false);
  const [savingPriority, setSavingPriority] = useState(false);
  const [allowedItemCodes, setAllowedItemCodes] = useState<string[]>([]);

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const getDefaultStartDate = () => {
    const y = currentMonth.getFullYear();
    const m = (currentMonth.getMonth() + 1).toString().padStart(2, '0');
    return `${y}-${m}-01`;
  };
  const getDefaultEndDate = () => {
    const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const y = currentMonth.getFullYear();
    const m = (currentMonth.getMonth() + 1).toString().padStart(2, '0');
    return `${y}-${m}-${lastDay.toString().padStart(2, '0')}`;
  };
  const [generateRange, setGenerateRange] = useState({ startDate: getDefaultStartDate(), endDate: getDefaultEndDate() });

  const [splitModal, setSplitModal] = useState<{
    isOpen: boolean;
    orderId: string | null;
    targetDate: string;
    maxQty: number;
    qtyToMove: string;
    orderDesc?: string;
    soNumber?: string;
  }>({ isOpen: false, orderId: null, targetDate: '', maxQty: 0, qtyToMove: '' });

  React.useEffect(() => {
    initData();
  }, [currentMonth, partId]);

  const fetchManpowerData = async () => {
    try {
      const monthStr = `${currentMonth.getFullYear()}-${(currentMonth.getMonth() + 1).toString().padStart(2, '0')}`;
      const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
      const startDate = `${monthStr}-01`;
      const endDate = `${monthStr}-${lastDay.toString().padStart(2, '0')}`;

      const res = await fetch(`${API}/api/manual-operation?startDate=${startDate}&endDate=${endDate}&partType=${partId || 'fillet'}`);
      if (res.ok) {
        setManpowerData(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const initData = async () => {
    setLoading(true);
    setLoadingStartTime(Date.now());
    setLoadingPhase({ mode: 'loading', step: 0, message: 'Connecting to server...' });

    setLoadingPhase({ mode: 'loading', step: 1, message: 'Loading product specs & demand orders...' });
    await Promise.all([
      fetchSpecs(),
      fetchDemandOrders(),
      fetchManpowerData(),
      fetchAllowedItems()
    ]);

    setLoadingPhase({ mode: 'loading', step: 2, message: 'Loading plan drafts...' });
    const allPlans = await fetchPlans();

    setLoadingPhase({ mode: 'loading', step: 3, message: 'Loading plan details & supply data...' });
    await loadPlanForMonth(allPlans);

    setLoadingPhase({ mode: 'loading', step: 4, message: 'Complete!' });
    setTimeout(() => setLoading(false), 300);
  };

  const fetchAllowedItems = async () => {
    try {
      const res = await fetch(`${API}/api/mps/allowed-items?partType=${partId || 'fillet'}`);
      if (res.ok) {
        const data = await res.json();
        setAllowedItemCodes(data.itemCodes || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDemandOrders = async () => {
    try {
      const res = await fetch(`${API}/api/erp/demand-orders`);
      if (res.ok) {
        const data = await res.json();
        setDemandOrders(data);
        // Build initial priority map from fetched data
        const pMap: Record<number, number | null> = {};
        data.forEach((header: any) => {
          header.lines?.forEach((line: any) => {
            if (line.priority !== null && line.priority !== undefined) {
              pMap[line.erpOrderLineId] = line.priority;
            }
          });
        });
        setPriorityMap(pMap);
        setPriorityDirty(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePriorityChange = (lineId: number, value: string) => {
    const num = value === '' ? null : parseInt(value);
    setPriorityMap(prev => ({ ...prev, [lineId]: num }));
    setPriorityDirty(true);
  };

  const savePriorities = async () => {
    setSavingPriority(true);
    try {
      const priorities = Object.entries(priorityMap).map(([lineId, priority]) => ({
        lineId: parseInt(lineId),
        priority
      }));
      const res = await fetch(`${API}/api/mps/update-priorities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priorities })
      });
      if (res.ok) {
        setPriorityDirty(false);
        // Automatically trigger re-generation to apply priorities
        await executeGeneratePlan();
      }
    } catch (e) {
      console.error(e);
      alert('Failed to save priorities');
    } finally {
      setSavingPriority(false);
    }
  };

  const cancelPriorities = async () => {
    // Re-fetch to reset
    await fetchDemandOrders();
  };

  const fetchPlans = async () => {
    try {
      const res = await fetch(`${API}/api/mps/plans?partType=${partId || 'fillet'}`);
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
            productSpeed: Number(s.productSpeed || 1),
            productSize: s.productSize || 'unsize'
          };
        });
        setSpecs(specMap);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const [weeklySizes, setWeeklySizes] = useState<any[]>([]);

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
            // Fetch weekly sizes as well
            const weekRes = await fetch(`${API}/api/mps/plans/${planForMonth.id}/weekly-sizes`);
            if (weekRes.ok) {
              const weekJson = await weekRes.json();
              setWeeklySizes(weekJson.success ? weekJson.data : []);
            }
            return;
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
    setCurrentPlan(null);
    setWeeklySizes([]);
  };

  const handleDeletePlan = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this plan?')) return;
    try {
      const res = await fetch(`${API}/api/mps/plans/${id}/delete`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        initData();
      } else {
        alert(data.message || 'Failed to delete plan');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleApprovePlan = async (id: number) => {
    if (!window.confirm('Approve this plan? Once approved, the plan will be locked and cannot be modified.')) return;
    try {
      const res = await fetch(`${API}/api/mps/plans/${id}/approve`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert('\u2705 Plan approved and locked successfully!');
        initData();
      } else {
        alert(data.message || 'Failed to approve plan');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRejectPlan = async (id: number) => {
    if (!window.confirm('Reject this plan? It will be reverted back to DRAFT status.')) return;
    try {
      const res = await fetch(`${API}/api/mps/plans/${id}/reject`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert('Plan reverted to DRAFT.');
        initData();
      } else {
        alert(data.message || 'Failed to reject plan');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportExcel = (id: number) => {
    window.open(`${API}/api/mps/plans/${id}/export`, '_blank');
  };

  // --- Calendar Helpers ---
  // Use local date to avoid UTC timezone shift (toISOString shifts +7 timezone back by 1 day)
  const formatLocalDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const getTodayStr = () => formatLocalDate(new Date());

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i + 1);
    return formatLocalDate(d);
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
    // Lock guard: prevent drag-drop on approved plans
    if (currentPlan?.status === 'APPROVED') {
      alert('This plan is approved and locked. Cannot modify.');
      return;
    }

    if (draggedOrderId && currentPlan) {
      const orderIds = draggedOrderId.split(',');
      const mpsOrderId = parseInt(orderIds[0]);

      if (mpsOrderId) {
        // Find the order to get its current qty
        const orderToMove = currentPlan.orders.find((o: any) => o.id === mpsOrderId);
        if (orderToMove) {
          // The backend returns quantityKg for orders, but metric mapping might have mapped it to qty
          // Let's use the raw quantityKg if available, or qty
          const currentQty = orderToMove.quantityKg || orderToMove.qty || 0;

          setSplitModal({
            isOpen: true,
            orderId: draggedOrderId,
            targetDate: date,
            maxQty: currentQty,
            qtyToMove: String(currentQty),
            orderDesc: orderToMove.itemDesc,
            soNumber: orderToMove.soNumber
          });
        }
      }
      setDraggedOrderId(null);
    }
  };

  const handleConfirmSplitMove = async () => {
    if (!splitModal.orderId) return;

    const qtyNum = parseFloat(splitModal.qtyToMove);
    if (isNaN(qtyNum) || qtyNum <= 0 || qtyNum > splitModal.maxQty) {
      alert("Invalid quantity. Must be greater than 0 and less than or equal to the maximum available quantity.");
      return;
    }

    const mpsOrderId = parseInt(splitModal.orderId);

    setSplitModal({ ...splitModal, isOpen: false });
    setLoading(true);

    try {
      await fetch(`${API}/api/mps/update-date`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: currentPlan.id,
          mpsOrderId,
          date: splitModal.targetDate,
          splitQty: qtyNum
        })
      });
      // reload data after saving
      initData();
    } catch (err) {
      console.error("Failed to update date", err);
      initData();
    }
  };

  const handleGeneratePlan = () => {
    // Lock guard: prevent regenerating if current plan is approved
    if (currentPlan?.status === 'APPROVED') {
      alert('This plan is approved and locked. Reject it first to regenerate.');
      return;
    }
    setGenerateRange({ startDate: getDefaultStartDate(), endDate: getDefaultEndDate() });
    setShowGenerateModal(true);
  };

  // Compute which months a date range covers (for UI display)
  const getMonthsInRange = (startDate: string, endDate: string): string[] => {
    if (!startDate || !endDate || startDate > endDate) return [];
    const months: string[] = [];
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T23:59:59`);
    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    while (current <= end) {
      const label = current.toLocaleString('default', { month: 'long', year: 'numeric' });
      months.push(label);
      current.setMonth(current.getMonth() + 1);
    }
    return months;
  };

  const executeGeneratePlan = async () => {
    setShowGenerateModal(false);
    setLoading(true);
    setLoadingStartTime(Date.now());
    setLoadingPhase({ mode: 'generating', step: 0, message: 'Preparing generation engine...' });

    try {
      setLoadingPhase({ mode: 'generating', step: 1, message: 'Fetching demand orders & supply data...' });

      // Small delay so user sees the animation start
      await new Promise(r => setTimeout(r, 400));
      setLoadingPhase({ mode: 'generating', step: 2, message: 'Running allocation algorithm...' });

      const res = await fetch(`${API}/api/mps/generate-range`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderStartDate: generateRange.startDate,
          orderEndDate: generateRange.endDate,
          partType: partId || 'fillet'
        })
      });

      setLoadingPhase({ mode: 'generating', step: 3, message: 'Processing results...' });
      const data = await res.json();

      if (data.success) {
        const results = data.results || [];
        const successMonths = results.filter((r: any) => r.success).map((r: any) => r.targetMonth);
        const failedMonths = results.filter((r: any) => !r.success).map((r: any) => `${r.targetMonth}: ${r.message}`);
        let msg = `✅ Plans generated for: ${successMonths.join(', ')}`;
        if (failedMonths.length > 0) {
          msg += `\n\n⚠️ Skipped:\n${failedMonths.join('\n')}`;
        }
        setLoadingPhase({ mode: 'generating', step: 4, message: 'Plan generated! Reloading data...' });
        alert(msg);
      } else {
        alert(data.message || 'Failed to generate plans');
      }

      setLoadingPhase({ mode: 'loading', step: 3, message: 'Reloading plan data...' });
      await initData();
    } catch (e) {
      console.error("Failed to generate plan", e);
    } finally {
      setLoading(false);
    }
  };

  const handleImportWeekly = async () => {
    if (!currentPlan) return;
    if (currentPlan.status === 'APPROVED') {
      alert('Plan is locked.');
      return;
    }
    setLoading(true);
    setLoadingStartTime(Date.now());
    setLoadingPhase({ mode: 'importing', step: 1, message: 'Importing weekly size data...' });
    try {
      const res = await fetch(`${API}/api/mps/plans/${currentPlan.id}/import-weekly`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setLoadingPhase({ mode: 'importing', step: 2, message: `Imported ${data.count} records! Reloading...` });
        alert(`✅ Imported ${data.count} weekly size records.`);
        await initData(); // reload
      } else {
        alert(data.message || 'Failed to import weekly plan');
      }
    } catch (e) {
      console.error(e);
      alert('Error importing weekly plan');
    } finally {
      setLoading(false);
    }
  };

  // --- Calculations ---
  const calculateDailyMetrics = (date: string) => {
    if (!currentPlan) {
      return { intake: 0, intakeKg: 0, rmFlAvailable: 0, totalOrderQty: 0, manpower: 0, dailyOrders: [] };
    }

    const formatDBDate = (dateVal: any) => {
      if (!dateVal) return null;
      if (typeof dateVal === 'string') return dateVal.split('T')[0];
      if (dateVal instanceof Date) return formatLocalDate(dateVal);
      return String(dateVal).split('T')[0];
    };

    const dailySummary = currentPlan.dailySummaries?.find((d: any) => formatDBDate(d.productionDate) === date);
    const dailyOrdersRaw = currentPlan.orders?.filter((o: any) => formatDBDate(o.plannedProductionDate) === date) || [];

    const grouped = new Map();
    dailyOrdersRaw.forEach((o: any) => {
      const key = `${o.soNumber || 'NO_SO'}_${o.itemCode}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          id: String(o.id),
          ids: [String(o.id)],
          lineId: o.erpOrderLineId,
          soNumber: o.soNumber || '-',
          itemCode: o.itemCode,
          itemDesc: o.itemDesc,
          type: o.productType,
          qty: Number(o.quantityKg),
          shipDate: o.shipDate ? formatDBDate(o.shipDate) : '-'
        });
      } else {
        const existing = grouped.get(key);
        existing.ids.push(String(o.id));
        existing.id = existing.ids.join(',');
        existing.qty += Number(o.quantityKg);
      }
    });

    const dailyOrders = Array.from(grouped.values());

    const totalOrderQty = dailyOrders.reduce((sum: number, o: any) => sum + o.qty, 0);

    const dailyManpower = manpowerData.find((m: any) => formatDBDate(m.productionDate) === date) || {};

    let requiredCuttingWorkers = 0;
    dailyOrders.forEach((o: any) => {
      const spec = specs[o.itemCode];
      const speed = spec?.productSpeed || 45;
      requiredCuttingWorkers += (o.qty / speed);
    });
    requiredCuttingWorkers = Math.ceil(requiredCuttingWorkers / 10);

    const plannedStationWorkers = dailyManpower.plannedStationWorkers || 28;
    const actualStationWorkers = dailyManpower.actualStationWorkers || 0;
    const actualCuttingWorkers = dailyManpower.actualCuttingWorkers || 0;

    const totalManpowerPlan = plannedStationWorkers + requiredCuttingWorkers;

    return {
      intake: dailySummary ? Number(dailySummary.intakeBirds) : 0,
      intakeKg: dailySummary ? Number(dailySummary.rmFlAvailKg) : 0,
      rmFlAvailable: dailySummary ? Number(dailySummary.rmFlAvailKg) : 0,
      totalOrderQty,
      manpower: dailyOrders.length > 0 ? totalManpowerPlan : 0,
      manpowerBreakdown: {
        plannedStationWorkers,
        plannedCuttingWorkers: requiredCuttingWorkers,
        actualStationWorkers,
        actualCuttingWorkers
      },
      dailyOrders,
      supplyBreakdown: currentPlan.supplyBreakdown?.find((s: any) => formatDBDate(s.productionDate) === date)
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
  const processedDemand = demandOrders.reduce((acc: any[], header: any) => {
    if (!header.lines) return acc;

    const filteredLines = header.lines.filter((line: any) => {
      if (!line.erpOrderShipDate) return false;
      if (!specs[line.erpOrderItemCode]) return false;
      // Filter by allowed item codes from Master Yield Tree
      if (allowedItemCodes.length > 0 && !allowedItemCodes.includes(line.erpOrderItemCode)) return false;
      const shipDate = new Date(line.erpOrderShipDate);
      return shipDate.getFullYear() === currentMonth.getFullYear() &&
        shipDate.getMonth() === currentMonth.getMonth();
    });

    if (filteredLines.length > 0) {
      const plannedOrders = currentPlan?.orders || [];
      const linesWithStatus = filteredLines.map((line: any) => {
        const planned = plannedOrders.filter((o: any) => o.erpOrderLineId === line.erpOrderLineId);
        const totalPlanned = planned.reduce((s: number, o: any) => s + Number(o.quantityKg || 0), 0);
        const qty = Number(line.erpOrderItemQty || 0);
        const isFull = totalPlanned >= qty * 0.99;
        const isNotPlanned = totalPlanned === 0;
        return { ...line, totalPlanned, isFull, isNotPlanned, planned };
      });

      const plannedLines = linesWithStatus.filter((l: any) => !l.isNotPlanned);
      const unfulfilledLines = linesWithStatus.filter((l: any) => l.isNotPlanned);

      acc.push({ ...header, plannedLines, unfulfilledLines });
    }
    return acc;
  }, []);

  const section1Planned = processedDemand
    .filter((h: any) => h.plannedLines.length > 0)
    .sort((a: any, b: any) => {
      const aCompleteCount = a.plannedLines.filter((l: any) => l.isFull).length;
      const bCompleteCount = b.plannedLines.filter((l: any) => l.isFull).length;
      const aTotal = a.plannedLines.length;
      const bTotal = b.plannedLines.length;

      // Sort by completion ratio
      return (bCompleteCount / bTotal) - (aCompleteCount / aTotal);
    });

  const section2Unfulfilled = processedDemand
    .filter((h: any) => h.unfulfilledLines.length > 0);

  // --- Loading Phase Steps Config ---
  const LOADING_STEPS = {
    loading: [
      { icon: Database, label: 'Connecting to server' },
      { icon: Package, label: 'Loading specs & orders' },
      { icon: FileText, label: 'Loading plan drafts' },
      { icon: BarChart3, label: 'Loading supply data' },
      { icon: CheckCircle2, label: 'Complete' },
    ],
    generating: [
      { icon: Cpu, label: 'Preparing engine' },
      { icon: Database, label: 'Fetching demand & supply' },
      { icon: Zap, label: 'Running allocation' },
      { icon: Layers, label: 'Processing results' },
      { icon: CheckCircle2, label: 'Done!' },
    ],
    importing: [
      { icon: Database, label: 'Connecting' },
      { icon: Download, label: 'Importing weekly data' },
      { icon: CheckCircle2, label: 'Complete' },
    ],
  };

  return (
    <div className="p-6 max-w-full mx-auto space-y-6 bg-gray-50 min-h-screen">
      {/* ═══ PREMIUM LOADING OVERLAY ═══ */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center"
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900/70 via-slate-800/60 to-orange-900/40 backdrop-blur-md" />

            {/* Animated background particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full bg-orange-400/10"
                  style={{
                    width: 80 + i * 40,
                    height: 80 + i * 40,
                    left: `${10 + i * 15}%`,
                    top: `${20 + (i % 3) * 25}%`,
                  }}
                  animate={{
                    y: [0, -30, 0],
                    x: [0, 15, 0],
                    scale: [1, 1.1, 1],
                    opacity: [0.3, 0.6, 0.3],
                  }}
                  transition={{
                    duration: 3 + i * 0.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: i * 0.3,
                  }}
                />
              ))}
            </div>

            {/* Main loading card */}
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/40 w-full max-w-md mx-4 overflow-hidden"
            >
              {/* Top gradient bar - animated */}
              <div className="h-1.5 w-full bg-gray-100 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-orange-400 via-red-500 to-orange-400"
                  initial={{ width: '0%' }}
                  animate={{
                    width: `${Math.min(((loadingPhase.step + 1) / (LOADING_STEPS[loadingPhase.mode]?.length || 5)) * 100, 100)}%`,
                  }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>

              <div className="p-8">
                {/* Header */}
                <div className="flex items-center gap-4 mb-7">
                  <div className="relative">
                    <motion.div
                      className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-300/50"
                      animate={{ rotate: [0, 5, -5, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      {loadingPhase.mode === 'generating' ? (
                        <Zap className="w-7 h-7 text-white" />
                      ) : loadingPhase.mode === 'importing' ? (
                        <Download className="w-7 h-7 text-white" />
                      ) : (
                        <Calendar className="w-7 h-7 text-white" />
                      )}
                    </motion.div>
                    {/* Pulse ring */}
                    <motion.div
                      className="absolute inset-0 rounded-2xl border-2 border-orange-400"
                      animate={{ scale: [1, 1.3, 1.3], opacity: [0.6, 0, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-black text-gray-900">
                      {loadingPhase.mode === 'generating' ? 'Generating MPS Plan' : loadingPhase.mode === 'importing' ? 'Importing Weekly Data' : 'Loading MPS Data'}
                    </h3>
                    <p className="text-xs text-gray-400 font-medium mt-0.5">
                      {pc.title} • {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  {/* Timer */}
                  <div className="text-right">
                    <motion.span
                      className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-500 tabular-nums"
                      key={elapsedTime}
                      initial={{ y: -5, opacity: 0.5 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      {elapsedTime}s
                    </motion.span>
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">elapsed</p>
                  </div>
                </div>

                {/* Step indicators */}
                <div className="space-y-2.5 mb-6">
                  {(LOADING_STEPS[loadingPhase.mode] || LOADING_STEPS.loading).map((step, i) => {
                    const StepIcon = step.icon;
                    const isComplete = i < loadingPhase.step;
                    const isCurrent = i === loadingPhase.step;

                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08, duration: 0.3 }}
                        className={`flex items-center gap-3 py-2 px-3 rounded-xl transition-all duration-300 ${isCurrent ? 'bg-orange-50 border border-orange-200 shadow-sm' :
                            isComplete ? 'bg-emerald-50/50' : 'opacity-40'
                          }`}
                      >
                        {/* Step circle */}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300 ${isComplete ? 'bg-emerald-500 shadow-md shadow-emerald-200' :
                            isCurrent ? 'bg-gradient-to-br from-orange-500 to-red-500 shadow-md shadow-orange-200' :
                              'bg-gray-200'
                          }`}>
                          {isComplete ? (
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 15 }}>
                              <CheckCircle2 className="w-4 h-4 text-white" />
                            </motion.div>
                          ) : isCurrent ? (
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                              <StepIcon className="w-4 h-4 text-white" />
                            </motion.div>
                          ) : (
                            <StepIcon className="w-4 h-4 text-gray-400" />
                          )}
                        </div>

                        {/* Step label */}
                        <span className={`text-sm font-semibold transition-colors duration-300 ${isComplete ? 'text-emerald-700' :
                            isCurrent ? 'text-orange-700' : 'text-gray-400'
                          }`}>
                          {step.label}
                        </span>

                        {/* Active dot */}
                        {isCurrent && (
                          <motion.div
                            className="ml-auto flex gap-1"
                            animate={{ opacity: [1, 0.3, 1] }}
                            transition={{ duration: 1.2, repeat: Infinity }}
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                            <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                            <div className="w-1.5 h-1.5 rounded-full bg-orange-300" />
                          </motion.div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                {/* Current message */}
                <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                  <div className="flex items-center gap-2">
                    <motion.div
                      animate={{ opacity: [1, 0.4, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0"
                    />
                    <motion.p
                      key={loadingPhase.message}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs font-medium text-gray-600 truncate"
                    >
                      {loadingPhase.message}
                    </motion.p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Header */}
      <div className="flex justify-between items-end bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="relative">
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-orange-200/20 blur-3xl rounded-full"></div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4 relative z-10">
            <div className="p-3 bg-orange-500 rounded-2xl shadow-lg shadow-orange-200">
              <Calendar className="w-8 h-8 text-white" />
            </div>
            <span>Master Production Schedule <span className="text-orange-500">({pc.title} MPS)</span></span>
          </h1>
          <p className="text-slate-500 mt-3 text-lg font-medium">Monthly Strategic Planning & Yield Optimization Engine</p>
        </div>
        <div className="flex gap-3">
          {currentPlan && (
            <button disabled={loading || currentPlan?.status === 'APPROVED'} onClick={handleImportWeekly} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white shadow-md transition-all ${loading || currentPlan?.status === 'APPROVED' ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 shadow-blue-200'}`}>
              <Download className={`w-4 h-4 ${loading ? 'animate-pulse' : ''}`} />
              Import Week Plan
            </button>
          )}
          <button disabled={loading || currentPlan?.status === 'APPROVED'} onClick={handleGeneratePlan} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white shadow-md transition-all ${loading || currentPlan?.status === 'APPROVED' ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 shadow-orange-200'}`}>
            <Activity className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {currentPlan?.status === 'APPROVED' ? '🔒 Plan Locked' : loading ? 'Generating...' : 'Generate & Save Plan'}
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
          {processedDemand.length > 0 && (
            <span className="bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full text-xs font-bold">{processedDemand.reduce((sum: number, h: any) => sum + (h.plannedLines.length + h.unfulfilledLines.length), 0)}</span>
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

              <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600">
                    <FileSpreadsheet size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{currentPlan.planName}</h3>
                    <p className="text-xs text-gray-500">Plan Status: <span className={`font-bold ${currentPlan.status === 'APPROVED' ? 'text-emerald-600' : 'text-amber-600'}`}>{currentPlan.status}</span></p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExportExcel(currentPlan.id)}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm shadow-emerald-200"
                  >
                    <Download size={16} />
                    Export MPS Report (Excel)
                  </button>
                  {currentPlan.status === 'DRAFT' && (
                    <button
                      onClick={() => handleApprovePlan(currentPlan.id)}
                      className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm shadow-orange-200"
                    >
                      <CheckCircle2 size={16} />
                      Approve & Lock Plan
                    </button>
                  )}
                </div>
              </div>

              {currentPlan?.status === 'APPROVED' && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                  <Lock className="text-emerald-500 flex-shrink-0" />
                  <div>
                    <h4 className="font-bold">Plan Approved & Locked</h4>
                    <p className="text-sm opacity-80">This plan has been approved. Orders cannot be moved or modified. To make changes, reject the plan first from the Plan Drafts tab.</p>
                  </div>
                </div>
              )}

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
                    const todayDateStr = getTodayStr();
                    const isToday = date === todayDateStr;
                    const hasWeekly = weeklySizes.some((sz: any) => typeof sz.receiveDate === 'string' ? sz.receiveDate.split('T')[0] === date : false);

                    return (
                      <div
                        key={date}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, date)}
                        className={`min-h-[180px] border-r border-b border-gray-100 p-2 flex flex-col gap-2 transition-colors
                      ${isToday ? 'bg-orange-50/30' : (Math.round(metrics.rmFlAvailable - metrics.totalOrderQty) !== 0 ? 'bg-red-100' : 'bg-white hover:bg-gray-50')}
                      ${metrics.supplyBreakdown ? 'cursor-pointer hover:shadow-md' : ''}
                    `}
                        onClick={() => {
                          if (metrics.supplyBreakdown) {
                            setSelectedSupply(metrics.supplyBreakdown);
                            setSelectedManpower(metrics.manpowerBreakdown);
                            setSelectedDate(date);
                            setSelectedDailyOrders(metrics.dailyOrders || []);
                            setExpandedSizeBins({});
                            setShowSupplyModal(true);
                          }
                        }}
                      >
                        {/* Day Header */}
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center gap-2">
                            <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold ${isToday ? 'bg-orange-500 text-white shadow-md' : 'text-gray-700'}`}>
                              {dayNum}
                            </span>
                            {hasWeekly && (
                              <span className="bg-blue-100 text-blue-700 text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider shadow-sm border border-blue-200">
                                Week
                              </span>
                            )}
                          </div>
                          {metrics.intake > 0 && (
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                🐔 {metrics.intake.toLocaleString()}
                              </span>
                              {metrics.intake > 0 && (
                                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase ${Math.round(metrics.rmFlAvailable - metrics.totalOrderQty) !== 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                  {Math.round(metrics.rmFlAvailable - metrics.totalOrderQty) < 0 ? <AlertTriangle size={10} /> : (Math.round(metrics.rmFlAvailable - metrics.totalOrderQty) > 0 ? <Info size={10} /> : <CheckCircle2 size={10} />)}
                                  {Math.abs(Math.round(metrics.rmFlAvailable - metrics.totalOrderQty)).toLocaleString()}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Metrics Summary (if activity exists) */}
                        {(metrics.intake > 0 || metrics.totalOrderQty > 0) && (
                          <div className="bg-slate-50/50 backdrop-blur-sm rounded-xl p-2.5 text-[10px] space-y-2 border border-slate-100 shadow-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 font-bold uppercase tracking-tighter">RM Available</span>
                              <span className="font-black text-slate-800 bg-white px-1.5 py-0.5 rounded shadow-sm">
                                {Math.round(metrics.rmFlAvailable).toLocaleString()} <span className="opacity-50">kg</span>
                              </span>
                            </div>

                            {/* RM Size Progress Indicators */}
                            {metrics.supplyBreakdown && (
                              <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden flex gap-0.5">
                                {(() => {
                                  const s = metrics.supplyBreakdown;
                                  const getSz = (g: string) => (s.sizes || []).filter((sz: any) => sz.groupSize === g).reduce((sum: number, sz: any) => sum + Number(sz.quantityKg || 0), 0);
                                  const total = getSz('40 Down') + getSz('40-45') + getSz('45-50') +
                                    getSz('50-55') + getSz('55-60') + getSz('60-65') +
                                    getSz('65-70') + getSz('70 Up');
                                  if (total === 0) return null;

                                  const sizes = [
                                    { val: getSz('40 Down'), color: 'bg-slate-400' },
                                    { val: getSz('40-45'), color: 'bg-blue-400' },
                                    { val: getSz('45-50'), color: 'bg-cyan-400' },
                                    { val: getSz('50-55') + getSz('55-60'), color: 'bg-emerald-400' },
                                    { val: getSz('60-65') + getSz('65-70') + getSz('70 Up'), color: 'bg-red-400' },
                                  ];

                                  return sizes.map((item, i) => (
                                    <div key={i} style={{ width: `${(Number(item.val || 0) / total) * 100}%` }} className={`h-full ${item.color}`}></div>
                                  ));
                                })()}
                              </div>
                            )}

                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 font-bold uppercase tracking-tighter">Demand Plan</span>
                              <span className={`font-black px-1.5 py-0.5 rounded shadow-sm ${Math.round(metrics.totalOrderQty) > Math.round(metrics.rmFlAvailable) ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                {Math.round(metrics.totalOrderQty).toLocaleString()} <span className="opacity-50">kg</span>
                              </span>
                            </div>

                            <div className="flex justify-between items-center pt-1 mt-1 border-t border-slate-200/50">
                              <span className="text-slate-400 font-bold uppercase tracking-tighter text-[9px]">RM Balance</span>
                              <span className={`font-black px-1.5 py-0.5 rounded shadow-sm ${Math.round(metrics.rmFlAvailable - metrics.totalOrderQty) !== 0 ? 'bg-red-500 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                                {(Math.round(metrics.rmFlAvailable - metrics.totalOrderQty) + 0).toLocaleString()} <span className="opacity-50">kg</span>
                              </span>
                            </div>
                            <div className="flex justify-between items-center pt-1.5 border-t border-slate-200/50">
                              <span className="text-indigo-500 font-bold uppercase tracking-tighter">Allocated Staff</span>
                              <span className="font-black text-indigo-700">{metrics.manpower} <span className="opacity-50 text-[8px]">PAX</span></span>
                            </div>
                          </div>
                        )}

                        {/* Orders Dropzone */}
                        <div className="flex-1 space-y-1.5 overflow-y-auto pr-1 custom-scrollbar">
                          {metrics.dailyOrders.map((order: any) => (
                            <motion.div
                              layoutId={order.id}
                              draggable={currentPlan?.status !== 'APPROVED'}
                              onDragStart={currentPlan?.status !== 'APPROVED' ? (e: any) => handleDragStart(e, order.id) : undefined}
                              onClick={() => setHighlightedSoNumber(highlightedSoNumber === order.soNumber ? null : order.soNumber)}
                              key={order.id}
                              className={`p-2 rounded-lg text-xs border shadow-sm transition-all
                            ${currentPlan?.status === 'APPROVED' ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}
                            ${order.type === 'chilled' ? 'bg-orange-50 border-orange-200' : 'bg-cyan-50 border-cyan-200'}
                            ${highlightedSoNumber && highlightedSoNumber !== order.soNumber ? 'opacity-40 grayscale-[50%]' : ''}
                            ${highlightedSoNumber === order.soNumber ? 'ring-2 ring-orange-500 shadow-orange-500/50 shadow-lg scale-[1.02] z-10' : ''}
                          `}
                            >
                              <div className="flex justify-between font-bold mb-1">
                                <span className="truncate pr-2 text-gray-800" title={order.itemDesc}>{order.itemDesc}</span>
                                <Move className="w-3 h-3 text-gray-400 opacity-50" />
                              </div>
                              <div className="flex justify-between items-center mb-0.5">
                                <span className="text-[9px] font-bold text-gray-500 uppercase">SO: <span className="text-gray-800">{order.soNumber}</span></span>
                                <span className="text-[9px] font-bold text-gray-500 uppercase">Ship: <span className="text-gray-800">{order.shipDate}</span></span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] text-gray-500 font-medium">{order.itemCode}</span>
                                <span className={`font-bold ${order.type === 'chilled' ? 'text-orange-700' : 'text-cyan-700'}`}>
                                  {Math.round(order.qty).toLocaleString()}kg
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
                    <tr key={p.id} className={`hover:bg-gray-50 transition-colors border-b last:border-0 ${p.status === 'APPROVED' ? 'bg-emerald-50/30' : ''}`}>
                      <td className="px-4 py-3 font-mono text-gray-500">{p.id}</td>
                      <td className="px-4 py-3 font-semibold text-gray-800">{p.planName}</td>
                      <td className="px-4 py-3 text-gray-600">{p.targetMonth}</td>
                      <td className="px-4 py-3">
                        {p.status === 'APPROVED' ? (
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-xs font-bold inline-flex items-center gap-1">
                            <ShieldCheck size={12} />
                            APPROVED
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-xs font-bold">
                            {p.status}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-1.5 justify-end">
                          {p.status === 'DRAFT' ? (
                            <>
                              <button
                                onClick={() => handleApprovePlan(p.id)}
                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Approve Plan"
                              >
                                <CheckCircle2 size={16} />
                              </button>
                              <button
                                onClick={() => handleExportExcel(p.id)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Export to Excel"
                              >
                                <Download size={16} />
                              </button>
                              <button
                                onClick={() => handleDeletePlan(p.id)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Plan"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          ) : p.status === 'APPROVED' ? (
                            <div className="flex items-center gap-1 justify-end">
                              <button
                                onClick={() => handleExportExcel(p.id)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Export to Excel"
                              >
                                <Download size={16} />
                              </button>
                              <button
                                onClick={() => handleRejectPlan(p.id)}
                                className="px-3 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors inline-flex items-center gap-1"
                                title="Reject Plan (revert to DRAFT)"
                              >
                                <Unlock size={12} />
                                Reject
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleDeletePlan(p.id)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Plan"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Priority Changed Banner */}
          {priorityDirty && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-full">
                  <Activity className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h4 className="font-bold text-amber-900">Priority Modified</h4>
                  <p className="text-sm text-amber-700">Order priorities have been changed. Save and Re-Generate the plan to apply.</p>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={cancelPriorities}
                  className="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={savePriorities}
                  disabled={savingPriority}
                  className="px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all shadow-md disabled:opacity-50"
                >
                  {savingPriority ? 'Saving...' : 'Save & Re-Generate'}
                </button>
              </div>
            </div>
          )}

          {/* Section 1: Planned Demand Orders */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <ShoppingCart className="text-orange-500" />
                Planned Demand (Sales Orders)
              </h2>
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-500">
                  Showing planned demands for: <span className="font-bold text-gray-800">{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                </div>
                <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200">
                  {section1Planned.reduce((sum: number, h: any) => sum + h.plannedLines.length, 0)} Lines
                </div>
              </div>
            </div>

            {section1Planned.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <ShoppingCart size={48} className="mx-auto mb-4 opacity-30" />
                <p>No planned demand orders found for this month.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {section1Planned.map((header: any) => (
                  <div key={header.erpOrderHeaderId} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    {/* SO Header */}
                    <div className="bg-gradient-to-r from-gray-50 to-slate-50 px-4 py-3 border-b border-gray-200 flex flex-wrap gap-4 items-center justify-between">
                      <div className="flex gap-6 items-center">
                        <div className="w-44">
                          <span className="text-[10px] text-gray-400 uppercase font-bold block tracking-wider">SO Number</span>
                          <span className="font-black text-gray-900 text-lg">{header.erpOrderNumber || header.erpOrderHeaderId}</span>
                        </div>
                        <div className="h-8 w-px bg-gray-200" />
                        <div className="w-80">
                          <span className="text-[10px] text-gray-400 uppercase font-bold block tracking-wider">Customer</span>
                          <span className="font-semibold text-gray-700 truncate block" title={header.erpCustomerName}>{header.erpCustomerName || '-'}</span>
                        </div>
                        {header.erpCustomerGrade && (
                          <>
                            <div className="h-8 w-px bg-gray-200" />
                            <div>
                              <span className="text-[10px] text-gray-400 uppercase font-bold block tracking-wider">Grade</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${header.erpCustomerGrade === 'A' ? 'bg-emerald-100 text-emerald-700' : header.erpCustomerGrade === 'B' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                {header.erpCustomerGrade}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold">
                        {header.plannedLines.length} Lines
                      </div>
                    </div>

                    {/* SO Lines */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-white">
                          <tr>
                            <th className="px-3 py-2 text-center font-semibold text-gray-600 border-b w-16">Priority</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b">Item Code</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b">Description</th>
                            <th className="px-3 py-2 text-right font-semibold text-gray-600 border-b w-28">Qty (kg)</th>
                            <th className="px-3 py-2 text-center font-semibold text-gray-600 border-b w-28">Planned Date</th>
                            <th className="px-3 py-2 text-center font-semibold text-gray-600 border-b w-28">Finished Date</th>
                            <th className="px-3 py-2 text-center font-semibold text-gray-600 border-b w-28">Ship Date</th>
                            <th className="px-3 py-2 text-center font-semibold text-gray-600 border-b w-28">Production</th>
                          </tr>
                        </thead>
                        <tbody>
                          {header.plannedLines.map((line: any) => {
                            const totalPlanned = line.totalPlanned;
                            const isFull = line.isFull;
                            const isPartial = totalPlanned > 0 && !isFull;
                            const plannedDate = line.planned.length > 0 ? line.planned[0].plannedProductionDate : null;
                            const currentPri = priorityMap[line.erpOrderLineId] ?? null;

                            return (
                              <tr key={line.erpOrderLineId} className="hover:bg-gray-50/80 transition-colors border-b last:border-0 border-gray-100">
                                <td className="px-3 py-2 text-center">
                                  <input
                                    type="number"
                                    min={1}
                                    max={99}
                                    value={currentPri ?? ''}
                                    onChange={(e) => handlePriorityChange(line.erpOrderLineId, e.target.value)}
                                    placeholder="-"
                                    className="w-12 text-center text-sm font-bold border border-gray-200 rounded-lg py-1 focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none transition-all"
                                  />
                                </td>
                                <td className="px-3 py-2 font-medium text-gray-800">{line.erpOrderItemCode}</td>
                                <td className="px-3 py-2 text-gray-600 truncate max-w-[200px]" title={line.erpItemDesc}>{line.erpItemDesc || '-'}</td>
                                <td className="px-3 py-2 text-right font-bold text-blue-700">{Number(line.erpOrderItemQty).toLocaleString()}</td>
                                <td className="px-3 py-2 text-center text-xs">
                                  {plannedDate ? (
                                    <span className="text-gray-700 font-bold">{new Date(plannedDate).toLocaleDateString()}</span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-center text-xs">
                                  {line.planned.length > 0 && line.planned[0].finishedProductionDate ? (
                                    <span className="text-blue-700 font-bold">{new Date(line.planned[0].finishedProductionDate).toLocaleDateString()}</span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-center text-emerald-700 text-xs font-bold">
                                  {new Date(line.erpOrderShipDate).toLocaleDateString()}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {isFull ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold">
                                      <CheckCircle2 size={10} /> Complete
                                    </span>
                                  ) : isPartial ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold">
                                      ⚠ Partial ({Math.round(totalPlanned).toLocaleString()}kg)
                                    </span>
                                  ) : (
                                    <span className="text-gray-300 text-[10px]">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Unfulfilled Demand Orders */}
          <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-red-800 flex items-center gap-2">
                <Activity className="text-red-500" />
                Unfulfilled Orders (Sales Orders)
              </h2>
              <div className="flex items-center gap-4">
                <div className="text-sm text-red-500/70">
                  Orders requiring attention for: <span className="font-bold text-red-700">{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                </div>
                <div className="bg-red-50 text-red-700 px-3 py-1 rounded-full text-xs font-bold border border-red-200">
                  {section2Unfulfilled.reduce((sum: number, h: any) => sum + h.unfulfilledLines.length, 0)} Lines
                </div>
              </div>
            </div>

            {section2Unfulfilled.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <CheckCircle2 size={48} className="mx-auto mb-4 opacity-30 text-emerald-500" />
                <p>All orders are scheduled! No unfulfilled orders found.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {section2Unfulfilled.map((header: any) => {
                  const exceptions = currentPlan?.exceptions || [];

                  return (
                    <div key={header.erpOrderHeaderId} className="border border-red-100 rounded-xl overflow-hidden shadow-sm">
                      {/* SO Header */}
                      <div className="bg-gradient-to-r from-red-50/50 to-orange-50/50 px-4 py-3 border-b border-red-100 flex flex-wrap gap-4 items-center justify-between">
                        <div className="flex gap-6 items-center">
                          <div className="w-44">
                            <span className="text-[10px] text-red-400 uppercase font-bold block tracking-wider">SO Number</span>
                            <span className="font-black text-gray-900 text-lg">{header.erpOrderNumber || header.erpOrderHeaderId}</span>
                          </div>
                          <div className="h-8 w-px bg-red-100" />
                          <div className="w-80">
                            <span className="text-[10px] text-red-400 uppercase font-bold block tracking-wider">Customer</span>
                            <span className="font-semibold text-gray-700 truncate block" title={header.erpCustomerName}>{header.erpCustomerName || '-'}</span>
                          </div>
                          {header.erpCustomerGrade && (
                            <>
                              <div className="h-8 w-px bg-red-100" />
                              <div>
                                <span className="text-[10px] text-red-400 uppercase font-bold block tracking-wider">Grade</span>
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${header.erpCustomerGrade === 'A' ? 'bg-emerald-100 text-emerald-700' : header.erpCustomerGrade === 'B' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                  {header.erpCustomerGrade}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                        <div className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold">
                          {header.unfulfilledLines.length} Lines
                        </div>
                      </div>

                      {/* SO Lines */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-white">
                            <tr>
                              <th className="px-3 py-2 text-center font-semibold text-gray-600 border-b w-16">Priority</th>
                              <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b">Item Code</th>
                              <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b">Description</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-600 border-b w-28">Qty (kg)</th>
                              <th className="px-3 py-2 text-center font-semibold text-gray-600 border-b w-28">Ship Date</th>
                              <th className="px-3 py-2 text-left font-semibold text-gray-600 border-b">Reason / Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {header.unfulfilledLines.map((line: any) => {
                              const exception = exceptions.find((e: any) => e.erpOrderLineId === line.erpOrderLineId);
                              const currentPri = priorityMap[line.erpOrderLineId] ?? null;

                              return (
                                <tr key={line.erpOrderLineId} className="hover:bg-red-50/30 transition-colors border-b last:border-0 border-red-50">
                                  <td className="px-3 py-2 text-center">
                                    <input
                                      type="number"
                                      min={1}
                                      max={99}
                                      value={currentPri ?? ''}
                                      onChange={(e) => handlePriorityChange(line.erpOrderLineId, e.target.value)}
                                      placeholder="-"
                                      className="w-12 text-center text-sm font-bold border border-gray-200 rounded-lg py-1 focus:ring-2 focus:ring-red-300 focus:border-red-400 outline-none transition-all"
                                    />
                                  </td>
                                  <td className="px-3 py-2 font-medium text-gray-800">{line.erpOrderItemCode}</td>
                                  <td className="px-3 py-2 text-gray-600 truncate max-w-[200px]" title={line.erpItemDesc}>{line.erpItemDesc || '-'}</td>
                                  <td className="px-3 py-2 text-right font-bold text-red-700">{Number(line.erpOrderItemQty).toLocaleString()}</td>
                                  <td className="px-3 py-2 text-center text-gray-600 text-xs">
                                    {new Date(line.erpOrderShipDate).toLocaleDateString()}
                                  </td>
                                  <td className="px-3 py-2 text-left">
                                    {exception ? (
                                      <div className="flex flex-col">
                                        <span className="text-red-600 font-bold text-[10px]">✕ Shortage: {Math.round(exception.shortageKg).toLocaleString()}kg</span>
                                        <span className="text-gray-400 text-[9px] truncate max-w-[200px]">{exception.reason}</span>
                                      </div>
                                    ) : (
                                      <span className="text-amber-600 font-medium text-[10px]">⚠ Not processed yet</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
                <div className="mt-4 bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-600 font-medium flex items-center gap-2">
                  <Info size={14} />
                  <span>💡 <strong>Tip:</strong> Set higher Priority (lower numbers) on critical orders above and click <strong>Save & Re-Generate</strong> to prioritize their fulfillment.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Supply & Demand Breakdown Modal */}
      {showSupplyModal && selectedSupply && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-6xl flex flex-col max-h-[90vh] border border-gray-200"
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Info size={20} className="text-orange-500" />
                Raw Material Breakdown — <span className="text-orange-600">{selectedDate}</span>
              </h3>
              <button
                onClick={() => setShowSupplyModal(false)}
                className="text-gray-400 hover:text-gray-700 bg-white p-1 rounded-full shadow-sm border border-gray-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ====== LEFT: SUPPLY PANEL ====== */}
                <div className="space-y-6">
                  <h4 className="text-sm font-black text-emerald-700 uppercase tracking-wider flex items-center gap-2">
                    <Scale size={16} /> Supply (RM Available)
                  </h4>

                  {/* Top Summary Chips */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Intake Birds', val: selectedSupply.intakeBirds, unit: 'Birds', color: 'blue' },
                      { label: 'Total Weight', val: selectedSupply.totalWeight, unit: 'kg', color: 'slate' },
                      { label: 'Avg. Weight', val: selectedSupply.avgWeight, unit: 'kg/pc', color: 'emerald', precision: 3 },
                      { label: 'Slaughtered', val: selectedSupply.slaughteredWeight, unit: 'kg', color: 'orange' },
                    ].map((stat, i) => (
                      <div key={i} className="bg-gray-50 border border-gray-100 p-4 rounded-xl">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{stat.label}</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-bold text-gray-800">
                            {stat.precision ? Number(stat.val).toFixed(stat.precision) : Math.round(Number(stat.val)).toLocaleString()}
                          </span>
                          <span className="text-[9px] font-medium text-gray-400 uppercase">{stat.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* RM Calculations Section */}
                  <div className="bg-orange-50 border border-orange-100 rounded-2xl p-6 space-y-4">
                    <h4 className="text-sm font-bold text-orange-800 flex items-center gap-2">
                      <Activity size={16} className="text-orange-500" />
                      {pc.rmPrefix} Summary ({pc.yieldLabel})
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {(() => {
                        const slaughtered = Number(selectedSupply.slaughteredWeight || 0);
                        const rmFlTotal = slaughtered * 0.04;
                        const rmFlGradeB = rmFlTotal * 0.093;
                        const rmFlNet = rmFlTotal - rmFlGradeB;

                        return (
                          <>
                            <div className="bg-white/80 p-4 rounded-xl border border-orange-200">
                              <p className="text-[10px] font-bold text-orange-600 uppercase mb-1">{pc.rmPrefix} Total</p>
                              <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-black text-orange-900">{Math.round(rmFlTotal).toLocaleString()}</span>
                                <span className="text-xs font-bold text-orange-500">kg</span>
                              </div>
                              <p className="text-[9px] text-orange-400 mt-1 italic">Slaughtered * 4%</p>
                            </div>
                            <div className="bg-white/80 p-4 rounded-xl border border-orange-200">
                              <p className="text-[10px] font-bold text-orange-600 uppercase mb-1">{pc.rmPrefix} Grade B</p>
                              <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-black text-orange-900">{Math.round(rmFlGradeB).toLocaleString()}</span>
                                <span className="text-xs font-bold text-orange-500">kg</span>
                              </div>
                              <p className="text-[9px] text-orange-400 mt-1 italic">Total * 9.3%</p>
                            </div>
                            <div className="bg-orange-500 p-4 rounded-xl shadow-md">
                              <p className="text-[10px] font-bold text-white/80 uppercase mb-1">{pc.rmPrefix} หัก Grade B</p>
                              <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-black text-white">{Math.round(rmFlNet).toLocaleString()}</span>
                                <span className="text-xs font-bold text-white/80">kg</span>
                              </div>
                              <p className="text-[9px] text-white/60 mt-1 italic">{pc.netLabel}</p>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* By Product Breakdown Section */}
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 space-y-4">
                    <h4 className="text-sm font-bold text-amber-800 flex items-center gap-2">
                      <Package size={16} className="text-amber-500" />
                      By Product Summary
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                      {(() => {
                        let byProducts: Record<string, { name: string; qty: number }> = {};
                        if (selectedSupply.byProducts) {
                          try {
                            byProducts = JSON.parse(selectedSupply.byProducts);
                          } catch (e) {
                            console.error('Error parsing byProducts', e);
                          }
                        }

                        const byProductKeys = Object.keys(byProducts);
                        if (byProductKeys.length === 0) {
                          return <div className="text-sm text-amber-600 italic col-span-full">No By Products generated for the selected orders. (Please map items in Master Yield Tree and Regenerate Plan)</div>;
                        }

                        return byProductKeys.map(key => {
                          const bp = byProducts[key];
                          const roundedQty = Math.round(bp.qty);
                          return (
                            <div key={key} className="bg-white/80 p-4 rounded-xl border border-amber-200">
                              <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">{bp.name}</p>
                              <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-black text-amber-900">{roundedQty.toLocaleString()}</span>
                                <span className="text-xs font-bold text-amber-500">kg</span>
                              </div>
                              <p className="text-[9px] text-amber-400 mt-1 italic">Saved in Database</p>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* Manpower Breakdown Section */}
                  {selectedManpower && (
                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 space-y-4">
                      <h4 className="text-sm font-bold text-indigo-800 flex items-center gap-2">
                        <Users size={16} className="text-indigo-500" />
                        Manpower Planning & Actual
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white/80 p-3 rounded-xl border border-indigo-200 shadow-sm flex flex-col justify-center">
                          <p className="text-[10px] font-bold text-indigo-500 uppercase mb-1">Station Workers (Plan)</p>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-indigo-900">{selectedManpower.plannedStationWorkers}</span>
                            <span className="text-[9px] font-bold text-indigo-400">Pax</span>
                          </div>
                        </div>
                        <div className="bg-white/80 p-3 rounded-xl border border-indigo-200 shadow-sm flex flex-col justify-center">
                          <p className="text-[10px] font-bold text-indigo-500 uppercase mb-1">Cutting Workers (Plan)</p>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-indigo-900">{selectedManpower.plannedCuttingWorkers}</span>
                            <span className="text-[9px] font-bold text-indigo-400">Pax</span>
                          </div>
                        </div>
                        <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 shadow-sm flex flex-col justify-center">
                          <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Station Workers (Actual)</p>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-emerald-900">{selectedManpower.actualStationWorkers}</span>
                            <span className="text-[9px] font-bold text-emerald-500">Pax</span>
                          </div>
                        </div>
                        <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 shadow-sm flex flex-col justify-center">
                          <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Cutting Workers (Actual)</p>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-emerald-900">{selectedManpower.actualCuttingWorkers}</span>
                            <span className="text-[9px] font-bold text-emerald-500">Pax</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-[10px] text-indigo-400 italic font-medium">
                        * Cutting Workers (Plan) calculated dynamically via Demand Orders: SUMPRODUCT(Order Qty / Product Speed) / 10
                      </div>
                    </div>
                  )}

                  {/* Size Distribution Grid */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                      <Package size={16} className="text-orange-500" />
                      {pc.sizeBreakdownTitle}
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {(() => {
                        const getMonthSizeKg = (groupSize: string) => (selectedSupply.sizes || []).filter((sz: any) => sz.groupSize === groupSize).reduce((sum: number, sz: any) => sum + Number(sz.quantityKg || 0), 0);
                        const getWeekSizeKg = (groupSize: string) => weeklySizes.filter((sz: any) => sz.groupSize === groupSize && (typeof sz.receiveDate === 'string' ? sz.receiveDate.split('T')[0] === selectedDate : false)).reduce((sum: number, sz: any) => sum + Number(sz.quantityKg || 0), 0);
                        const hasWeekly = weeklySizes.some((sz: any) => typeof sz.receiveDate === 'string' ? sz.receiveDate.split('T')[0] === selectedDate : false);
                        const getSizeKg = (groupSize: string) => hasWeekly ? getWeekSizeKg(groupSize) : getMonthSizeKg(groupSize);

                        const filletSizeLabels = [
                          { label: '40 Down', color: 'bg-slate-500' },
                          { label: '40-45', color: 'bg-blue-500' },
                          { label: '45-50', color: 'bg-cyan-500' },
                          { label: '50-55', color: 'bg-emerald-500' },
                          { label: '55-60', color: 'bg-green-500' },
                          { label: '60-65', color: 'bg-amber-500' },
                          { label: '65-70', color: 'bg-orange-500' },
                          { label: '70 Up', color: 'bg-red-500' },
                        ];

                        const isBil = currentPlan?.partType === 'bil';
                        const currentSizeLabels = isBil 
                          ? Array.from(new Set((selectedSupply.sizes || []).map((s: any) => s.groupSize)))
                              .map((label, idx) => ({
                                label,
                                color: `bg-${['slate','blue','cyan','emerald','green','amber','orange','red'][idx % 8]}-500`
                              }))
                          : filletSizeLabels;

                        const totalAll = currentSizeLabels.reduce((sum, s) => sum + getSizeKg(s.label), 0);
                        
                        return currentSizeLabels.map((size, idx) => {
                          const val = getSizeKg(size.label);
                          const monthVal = getMonthSizeKg(size.label);
                          const diff = hasWeekly ? size.val - size.monthVal : 0;
                          return (
                            <div key={idx} className="bg-white border border-gray-100 p-3 rounded-xl shadow-sm hover:border-orange-200 transition-all">
                              <div className="flex justify-between items-start mb-1">
                                <p className="text-[10px] font-bold text-gray-400 uppercase">{size.label}</p>
                                {hasWeekly && diff !== 0 && (
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${diff > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                    {diff > 0 ? '+' : ''}{Math.round(diff).toLocaleString()} kg
                                  </span>
                                )}
                              </div>
                              <div className="flex items-baseline gap-1">
                                <span className="text-lg font-bold text-gray-800">{Number(size.val || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                                <span className="text-[9px] font-bold text-gray-400">kg</span>
                              </div>
                              <div className="mt-2 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full ${size.color} opacity-80`} style={{ width: `${totalAll > 0 ? (size.val / totalAll) * 100 : 0}%` }}></div>
                              </div>
                            </div>
                          )
                        });
                      })()}
                    </div>
                  </div>

                  {/* Final Summary Output */}
                  <div className="bg-gray-900 rounded-2xl p-6 text-white flex flex-col md:flex-row justify-between items-center gap-6">
                    <div>
                      <p className="text-gray-400 font-bold uppercase text-[10px] mb-1">Estimated Net Output (Aggregate)</p>
                      {(() => {
                        const getMonthSizeKg = (groupSize: string) => (selectedSupply.sizes || []).filter((sz: any) => sz.groupSize === groupSize).reduce((sum: number, sz: any) => sum + Number(sz.quantityKg || 0), 0);
                        const getWeekSizeKg = (groupSize: string) => weeklySizes.filter((sz: any) => sz.groupSize === groupSize && (typeof sz.receiveDate === 'string' ? sz.receiveDate.split('T')[0] === selectedDate : false)).reduce((sum: number, sz: any) => sum + Number(sz.quantityKg || 0), 0);
                        const hasWeekly = weeklySizes.some((sz: any) => typeof sz.receiveDate === 'string' ? sz.receiveDate.split('T')[0] === selectedDate : false);
                        const getSizeKg = (groupSize: string) => hasWeekly ? getWeekSizeKg(groupSize) : getMonthSizeKg(groupSize);

                        const isBil = currentPlan?.partType === 'bil';
                        const sizeNames = isBil 
                          ? Array.from(new Set((selectedSupply.sizes || []).map((s: any) => s.groupSize)))
                          : ['40 Down', '40-45', '45-50', '50-55', '55-60', '60-65', '65-70', '70 Up'];

                        const total = sizeNames.reduce((sum, name) => sum + getSizeKg(name), 0);
                        const monthTotal = sizeNames.reduce((sum, name) => sum + getMonthSizeKg(name), 0);
                        const diff = hasWeekly ? total - monthTotal : 0;

                        return (
                          <>
                            <h5 className="text-3xl font-bold flex items-baseline gap-2">
                              {Math.round(total).toLocaleString()}
                              <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">KG</span>
                              {hasWeekly && diff !== 0 && (
                                <span className={`text-sm ml-2 font-bold ${diff > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                  ({diff > 0 ? '+' : ''}{Math.round(diff).toLocaleString()})
                                </span>
                              )}
                            </h5>
                          </>
                        );
                      })()}
                    </div>
                    <div className="w-full md:w-64 space-y-2">
                      <div className="flex justify-between text-[10px] font-bold uppercase text-gray-400">
                        <span>Distribution Matrix</span>
                        <span className="text-orange-400">100% Match</span>
                      </div>
                      <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden flex">
                        {(() => {
                          const getMonthSizeKg = (groupSize: string) => (selectedSupply.sizes || []).filter((sz: any) => sz.groupSize === groupSize).reduce((sum: number, sz: any) => sum + Number(sz.quantityKg || 0), 0);
                          const getWeekSizeKg = (groupSize: string) => weeklySizes.filter((sz: any) => sz.groupSize === groupSize && (typeof sz.receiveDate === 'string' ? sz.receiveDate.split('T')[0] === selectedDate : false)).reduce((sum: number, sz: any) => sum + Number(sz.quantityKg || 0), 0);
                          const hasWeekly = weeklySizes.some((sz: any) => typeof sz.receiveDate === 'string' ? sz.receiveDate.split('T')[0] === selectedDate : false);
                          const getSizeKg = (groupSize: string) => hasWeekly ? getWeekSizeKg(groupSize) : getMonthSizeKg(groupSize);

                          const isBil = currentPlan?.partType === 'bil';
                          const currentSizeLabels = isBil 
                            ? Array.from(new Set((selectedSupply.sizes || []).map((s: any) => s.groupSize)))
                                .map((label, idx) => ({
                                  label,
                                  color: `bg-${['slate','blue','cyan','emerald','green','amber','orange','red'][idx % 8]}-500`
                                }))
                            : [
                                { label: '40 Down', color: 'bg-slate-500' },
                                { label: '40-45', color: 'bg-blue-500' },
                                { label: '45-50', color: 'bg-cyan-500' },
                                { label: '50-55', color: 'bg-emerald-500' },
                                { label: '55-60', color: 'bg-green-500' },
                                { label: '60-65', color: 'bg-amber-500' },
                                { label: '65-70', color: 'bg-orange-500' },
                                { label: '70 Up', color: 'bg-red-500' },
                              ];

                          const total = currentSizeLabels.reduce((sum, s) => sum + getSizeKg(s.label), 0);
                          return currentSizeLabels.map((s, i) => {
                            const val = getSizeKg(s.label);
                            const width = total > 0 ? (val / total) * 100 : 0;
                            return <div key={i} style={{ width: `${width}%` }} className={`${s.color} h-full border-r border-black/20 last:border-0`} />;
                          });
                        })()}
                      </div>
                    </div>
                  </div>

                </div>{/* END LEFT: SUPPLY PANEL */}

                {/* ====== RIGHT: DEMAND PANEL ====== */}
                <div className="space-y-4">
                  <h4 className="text-sm font-black text-orange-700 uppercase tracking-wider flex items-center gap-2">
                    <ShoppingCart size={16} /> Demand (Orders)
                  </h4>

                  {selectedDailyOrders.length === 0 ? (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
                      <Package size={32} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-sm text-gray-400 font-medium">No orders on this date</p>
                    </div>
                  ) : (
                    <>
                      {/* Orders Table */}
                      <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-gray-50 text-gray-500 uppercase tracking-wider">
                              <th className="text-left px-3 py-2 font-bold">SO / Item</th>
                              <th className="text-left px-3 py-2 font-bold">Type</th>
                              <th className="text-left px-3 py-2 font-bold">Size</th>
                              <th className="text-right px-3 py-2 font-bold">Qty (kg)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedDailyOrders.map((order: any, idx: number) => {
                              const spec = specs[order.itemCode];
                              const size = spec?.productSize || 'unsize';
                              return (
                                <tr key={idx} className="border-t border-gray-100 hover:bg-orange-50/30">
                                  <td className="px-3 py-2">
                                    <div className="font-bold text-gray-800">{order.soNumber}</div>
                                    <div className="text-[10px] text-gray-400">{order.itemCode}</div>
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${order.type === 'chilled' ? 'bg-orange-100 text-orange-700' : 'bg-cyan-100 text-cyan-700'}`}>
                                      {order.type}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 font-bold text-gray-700">{size}</td>
                                  <td className="px-3 py-2 text-right font-bold text-gray-900">{Math.round(order.qty).toLocaleString()}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-gray-900 text-white">
                              <td colSpan={3} className="px-3 py-2 font-bold text-xs uppercase">Total Demand</td>
                              <td className="px-3 py-2 text-right font-bold">{Math.round(selectedDailyOrders.reduce((s: number, o: any) => s + o.qty, 0)).toLocaleString()} kg</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* Demand by Size Summary — expandable */}
                      <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 space-y-3">
                        <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">Demand by RM Size</p>
                        {(() => {
                          const isBil = currentPlan?.partType === 'bil';
                          const sizeLabels = isBil 
                            ? Array.from(new Set((selectedSupply.sizes || []).map((s: any) => s.groupSize)))
                                .map((label, idx) => ({
                                  key: label,
                                  label,
                                  groupSize: label,
                                  color: `bg-${['slate','blue','cyan','emerald','green','amber','orange','red'][idx % 8]}-500`
                                }))
                            : [
                                { key: '40Down', label: '40 Down', groupSize: '40 Down', color: 'bg-slate-500' },
                                { key: '40_45', label: '40-45', groupSize: '40-45', color: 'bg-blue-500' },
                                { key: '45_50', label: '45-50', groupSize: '45-50', color: 'bg-cyan-500' },
                                { key: '50_55', label: '50-55', groupSize: '50-55', color: 'bg-emerald-500' },
                                { key: '55_60', label: '55-60', groupSize: '55-60', color: 'bg-green-500' },
                                { key: '60_65', label: '60-65', groupSize: '60-65', color: 'bg-amber-500' },
                                { key: '65_70', label: '65-70', groupSize: '65-70', color: 'bg-orange-500' },
                                { key: '70Up', label: '70 Up', groupSize: '70 Up', color: 'bg-red-500' },
                              ];
                          // Helper: get supply kg from normalized sizes array
                          const getSupplySizeKg = (groupSize: string): number => {
                            return (selectedSupply.sizes || []).filter((sz: any) => sz.groupSize === groupSize).reduce((sum: number, sz: any) => sum + Number(sz.quantityKg || 0), 0);
                          };
                          const allBinDefs = [
                            { key: '40Down', lo: 0, hi: 40 },
                            { key: '40_45', lo: 40, hi: 45 },
                            { key: '45_50', lo: 45, hi: 50 },
                            { key: '50_55', lo: 50, hi: 55 },
                            { key: '55_60', lo: 55, hi: 60 },
                            { key: '60_65', lo: 60, hi: 65 },
                            { key: '65_70', lo: 65, hi: 70 },
                            { key: '70Up', lo: 70, hi: 999 },
                          ];
                          const getSizeBinKeys = (productSize: string): string[] => {
                            if (!productSize) return [];
                            const s = productSize.toLowerCase().trim();
                            if (s === 'unsize' || s === '') return [];
                            
                            if (isBil) {
                               // For BIL, match directly to one of our labels
                               const match = sizeLabels.find(sl => sl.label.toLowerCase() === s);
                               return match ? [match.key] : [productSize]; // Fallback to raw size if no direct label match
                            }

                            if (s.includes('40 down') || s === '40down') return ['40Down'];
                            if (s.includes('70 up') || s === '70up' || s.includes('60 up') || s === '60up') return ['60_65', '65_70', '70Up'];
                            const rangeMatch = s.match(/(\d+)\s*[-–]\s*(\d+)/);
                            if (rangeMatch) {
                              const lo = parseInt(rangeMatch[1]);
                              const hi = parseInt(rangeMatch[2]);
                              return allBinDefs.filter(b => b.hi > lo && b.lo < hi).map(b => b.key);
                            }
                            return [];
                          };

                          // Build per-bin demand + order details
                          const demandByBin: Record<string, number> = {};
                          const ordersByBin: Record<string, { soNumber: string; itemCode: string; size: string; qty: number; type: string }[]> = {};
                          sizeLabels.forEach(sl => { demandByBin[sl.key] = 0; ordersByBin[sl.key] = []; });

                          // Build supply remaining map for waterfall
                          const supplyRemaining: Record<string, number> = {};
                          sizeLabels.forEach(sl => { supplyRemaining[sl.key] = getSupplySizeKg(sl.groupSize); });

                          // Pass 1: Allocate SIZED orders first (they have specific bins)
                          const sizedOrders: any[] = [];
                          const unsizedOrders: any[] = [];
                          selectedDailyOrders.forEach((o: any) => {
                            const spec = specs[o.itemCode];
                            const size = spec?.productSize || 'unsize';
                            const binKeys = getSizeBinKeys(size);
                            if (binKeys.length > 0) {
                              sizedOrders.push({ ...o, size, binKeys });
                            } else {
                              unsizedOrders.push({ ...o, size: 'unsize' });
                            }
                          });

                          sizedOrders.forEach(o => {
                            const perBin = o.qty / o.binKeys.length;
                            o.binKeys.forEach((key: string) => {
                              demandByBin[key] = (demandByBin[key] || 0) + perBin;
                              supplyRemaining[key] = (supplyRemaining[key] || 0) - perBin;
                              ordersByBin[key].push({ soNumber: o.soNumber, itemCode: o.itemCode, size: o.size, qty: perBin, type: o.type });
                            });
                          });

                          // Pass 2: Allocate UNSIZE orders via waterfall (fill remaining capacity per bin)
                          unsizedOrders.forEach(o => {
                            let remainingQty = o.qty;
                            for (const sl of sizeLabels) {
                              if (remainingQty <= 0) break;
                              const avail = Math.max(0, supplyRemaining[sl.key] || 0);
                              if (avail <= 0) continue;
                              const allocQty = Math.min(avail, remainingQty);
                              demandByBin[sl.key] = (demandByBin[sl.key] || 0) + allocQty;
                              supplyRemaining[sl.key] -= allocQty;
                              remainingQty -= allocQty;
                              ordersByBin[sl.key].push({ soNumber: o.soNumber, itemCode: o.itemCode, size: 'unsize', qty: allocQty, type: o.type });
                            }
                            // If still remaining after all bins full, dump into last non-zero or first bin
                            if (remainingQty > 0) {
                              const fallbackKey = sizeLabels.length > 0 ? sizeLabels[0].key : 'unsize';
                              if (!ordersByBin[fallbackKey]) ordersByBin[fallbackKey] = [];
                              demandByBin[fallbackKey] = (demandByBin[fallbackKey] || 0) + remainingQty;
                              ordersByBin[fallbackKey].push({ soNumber: o.soNumber, itemCode: o.itemCode, size: 'unsize (overflow)', qty: remainingQty, type: o.type });
                            }
                          });

                          return (
                            <div className="space-y-1">
                              {sizeLabels.map(sl => {
                                const supply = getSupplySizeKg(sl.groupSize);
                                const demand = demandByBin[sl.key] || 0;
                                if (supply === 0 && demand === 0) return null;
                                const remaining = supply - demand;
                                const isExpanded = expandedSizeBins[sl.key] || false;
                                const orders = ordersByBin[sl.key] || [];

                                return (
                                  <div key={sl.key}>
                                    <div
                                      className="bg-white rounded-lg p-2.5 border border-orange-100 flex items-center gap-3 cursor-pointer hover:bg-orange-50/50 transition-colors"
                                      onClick={() => setExpandedSizeBins(prev => ({ ...prev, [sl.key]: !prev[sl.key] }))}
                                    >
                                      <div className={`w-2 h-8 rounded-full ${sl.color}`} />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-bold text-gray-500 uppercase">{sl.label}</span>
                                          {orders.length > 0 && (
                                            <span className="text-[9px] text-gray-400">
                                              {isExpanded ? '▲' : '▼'} {orders.length} orders
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex gap-4 text-xs mt-0.5">
                                          <span className="text-emerald-600">Supply: <b>{Math.round(supply).toLocaleString()}</b></span>
                                          <span className="text-orange-600">Demand: <b>{Math.round(demand).toLocaleString()}</b></span>
                                          <span className={remaining >= 0 ? 'text-blue-600' : 'text-red-600 font-bold'}>
                                            {remaining >= 0 ? 'Rem' : 'Short'}: <b>{Math.round(Math.abs(remaining)).toLocaleString()}</b>
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    {/* Expanded order list */}
                                    {isExpanded && orders.length > 0 && (
                                      <div className="ml-5 mt-1 mb-2 border-l-2 border-orange-200 pl-3 space-y-1">
                                        {orders.map((ord, idx) => (
                                          <div key={idx} className="flex items-center gap-2 text-[11px] py-1 px-2 bg-white/80 rounded border border-gray-100">
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${ord.type === 'chilled' ? 'bg-orange-100 text-orange-700' : 'bg-cyan-100 text-cyan-700'}`}>
                                              {ord.type === 'chilled' ? 'C' : 'F'}
                                            </span>
                                            <span className="font-bold text-gray-700">{ord.soNumber}</span>
                                            <span className="text-gray-400 text-[10px]">{ord.itemCode}</span>
                                            <span className="text-gray-400 text-[10px]">({ord.size})</span>
                                            <span className="ml-auto font-bold text-gray-900">{Math.round(ord.qty).toLocaleString()} kg</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    </>
                  )}
                </div>{/* END RIGHT: DEMAND PANEL */}

              </div>{/* END grid */}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl flex justify-end">
              <button
                onClick={() => setShowSupplyModal(false)}
                className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-all shadow-sm"
              >
                Close Breakdown
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* Split/Move Modal */}
      {splitModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Move className="text-orange-500 w-5 h-5" />
                Move / Split Order
              </h3>
              <button
                onClick={() => setSplitModal({ ...splitModal, isOpen: false })}
                className="text-gray-400 hover:bg-gray-200 hover:text-gray-600 p-1.5 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-sm">
                <p className="font-bold text-orange-900 truncate" title={splitModal.orderDesc}>{splitModal.orderDesc}</p>
                <div className="flex gap-4 mt-1 text-orange-700">
                  <p>SO: <span className="font-bold">{splitModal.soNumber}</span></p>
                  <p>Target Date: <span className="font-bold">{splitModal.targetDate}</span></p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Quantity to Move (kg)
                </label>
                <input
                  type="number"
                  value={splitModal.qtyToMove}
                  onChange={(e) => setSplitModal({ ...splitModal, qtyToMove: e.target.value })}
                  max={splitModal.maxQty}
                  min={1}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg font-bold focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                />
                <div className="flex justify-between items-center mt-2">
                  <p className="text-xs text-gray-500">
                    Max Available: <span className="font-bold">{splitModal.maxQty}</span> kg
                  </p>
                  {parseFloat(splitModal.qtyToMove) < splitModal.maxQty && (
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                      Will Split Order
                    </span>
                  )}
                </div>
              </div>

            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
              <button
                onClick={() => setSplitModal({ ...splitModal, isOpen: false })}
                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSplitMove}
                className="px-6 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-xl shadow-md hover:from-orange-600 hover:to-red-600 transition-all shadow-orange-200"
              >
                Confirm Move
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* GENERATE PLAN MODAL */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl shadow-xl border border-gray-100 w-full max-w-lg overflow-hidden flex flex-col p-8"
          >
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                  <div className="p-2 bg-orange-100 text-orange-600 rounded-xl">
                    <Activity className="w-5 h-5" />
                  </div>
                  Generate & Save Plan
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  กำหนด Ship Date Range เพื่อสร้างแผนผลิตอัตโนมัติ
                </p>
              </div>
              <button onClick={() => setShowGenerateModal(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="bg-orange-50/50 border border-orange-100 rounded-2xl p-5 mb-4">
              <p className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-4">Sales Order Date Range (Ship Date)</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">Start Date</label>
                  <input
                    type="date"
                    value={generateRange.startDate}
                    onChange={e => setGenerateRange({ ...generateRange, startDate: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-800 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">End Date</label>
                  <input
                    type="date"
                    value={generateRange.endDate}
                    onChange={e => setGenerateRange({ ...generateRange, endDate: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-800 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 bg-white"
                  />
                </div>
              </div>
              <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
                ระบบจะดึง Sales Orders ที่มี Ship Date ตั้งแต่วันที่ <span className="font-bold text-gray-600">{generateRange.startDate}</span> ถึง <span className="font-bold text-gray-600">{generateRange.endDate}</span> แล้วจัดสรรเข้าแผนผลิตแต่ละเดือนอัตโนมัติ
              </p>
            </div>

            {/* Month preview badges */}
            {generateRange.startDate && generateRange.endDate && generateRange.startDate <= generateRange.endDate && (
              <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 mb-6">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">แผนที่จะถูกสร้าง</p>
                <div className="flex flex-wrap gap-2">
                  {getMonthsInRange(generateRange.startDate, generateRange.endDate).map((m, i) => (
                    <span key={i} className="px-3 py-1.5 bg-white border border-blue-200 text-blue-700 text-xs font-bold rounded-lg shadow-sm">
                      📅 {m}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={executeGeneratePlan}
                disabled={!generateRange.startDate || !generateRange.endDate || generateRange.startDate > generateRange.endDate}
                className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-orange-200 transition-all flex justify-center items-center gap-2"
              >
                <Activity className="w-4 h-4" /> Generate {getMonthsInRange(generateRange.startDate, generateRange.endDate).length > 1 ? `${getMonthsInRange(generateRange.startDate, generateRange.endDate).length} Plans` : 'Plan'}
              </button>
            </div>
          </motion.div>
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
