import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Users, Save, ChevronLeft, ChevronRight, Activity } from 'lucide-react';

const API = import.meta.env.VITE_API_URL;

interface DailyManpower {
  date: string;
  plannedStationWorkers: number;
  actualStationWorkers: number;
  actualCuttingWorkers: number;
}

const ManualOperation: React.FC = () => {
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day; // Adjust when day is sunday
    return new Date(today.setDate(diff));
  });

  const [manpowerData, setManpowerData] = useState<Record<string, DailyManpower>>({});
  const [saving, setSaving] = useState(false);

  // Use local date to avoid UTC timezone shift
  const formatLocalDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Generate days for the current week
  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(currentWeekStart.getDate() + i);
    return formatLocalDate(d);
  });

  useEffect(() => {
    loadData();
  }, [currentWeekStart]);

  const loadData = async () => {
    try {
      const res = await fetch(`${API}/api/manual-operation?startDate=${weekDays[0]}&endDate=${weekDays[6]}`);
      let fetchedData: any[] = [];
      if (res.ok) {
        fetchedData = await res.json();
      }

      const newData: Record<string, DailyManpower> = {};
      weekDays.forEach(date => {
        const existing = fetchedData.find(d => {
          const dStr = d.productionDate ? (typeof d.productionDate === 'string' ? d.productionDate.split('T')[0] : formatLocalDate(new Date(d.productionDate))) : '';
          return dStr === date;
        });

        newData[date] = {
          date,
          plannedStationWorkers: existing ? existing.plannedStationWorkers : 0,
          actualStationWorkers: existing ? existing.actualStationWorkers : 0,
          actualCuttingWorkers: existing ? existing.actualCuttingWorkers : 0
        };
      });
      setManpowerData(newData);
    } catch (e) {
      console.error("Failed to load data", e);
    }
  };

  const handlePrevWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentWeekStart(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentWeekStart(newDate);
  };

  const handleInputChange = (date: string, field: keyof DailyManpower, value: string) => {
    const numValue = value === '' ? 0 : parseInt(value, 10);
    if (isNaN(numValue)) return;

    setManpowerData(prev => ({
      ...prev,
      [date]: {
        ...prev[date],
        [field]: numValue
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = Object.values(manpowerData).map(d => ({
        date: d.date,
        plannedStationWorkers: d.plannedStationWorkers,
        actualStationWorkers: d.actualStationWorkers,
        actualCuttingWorkers: d.actualCuttingWorkers
        // Notice we DO NOT send plannedCuttingWorkers
      }));

      const res = await fetch(`${API}/api/manual-operation/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert('Manpower data saved successfully!');
      } else {
        alert('Failed to save data.');
      }
    } catch (e) {
      console.error(e);
      alert('Error saving data.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyToMonth = async () => {
    if (!window.confirm('This will copy your current week\'s planned and actual workers to all other days in the same month. Proceed?')) return;
    
    setSaving(true);
    try {
      // Use Wednesday to determine the "target month"
      const wednesday = new Date(weekDays[3]);
      const month = wednesday.getMonth();
      const year = wednesday.getFullYear();
      
      const payload: any[] = [];
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      for (let i = 1; i <= daysInMonth; i++) {
        // Adjust for local time differences to avoid shifting dates
        const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const d = new Date(dStr);
        const dayOfWeek = d.getDay();
        const refDateStr = weekDays[dayOfWeek];
        const plannedVal = manpowerData[refDateStr]?.plannedStationWorkers || 0;
        const actualStationVal = manpowerData[refDateStr]?.actualStationWorkers || 0;
        const actualCuttingVal = manpowerData[refDateStr]?.actualCuttingWorkers || 0;
        
        payload.push({
          date: dStr,
          plannedStationWorkers: plannedVal,
          actualStationWorkers: actualStationVal,
          actualCuttingWorkers: actualCuttingVal
        });
      }

      const res = await fetch(`${API}/api/manual-operation/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert('Monthly plan applied successfully!');
        loadData(); // reload
      } else {
        alert('Failed to apply plan.');
      }
    } catch (e) {
      console.error(e);
      alert('Error applying plan.');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('th-TH', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'short' 
    }).format(date);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="text-orange-500 w-8 h-8" />
            Manual Operation (Manpower)
          </h1>
          <p className="text-gray-500 text-sm mt-1">Weekly manpower planning and actual tracking.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-200">
            <button onClick={handlePrevWeek} className="p-2 hover:bg-white rounded-lg transition-colors text-gray-600">
              <ChevronLeft size={18} />
            </button>
            <div className="px-3 flex items-center gap-2 font-medium text-sm text-gray-700">
              <CalendarIcon size={16} className="text-orange-500" />
              <span>{formatDate(weekDays[0])}</span>
              <span className="text-gray-400">-</span>
              <span>{formatDate(weekDays[6])}</span>
            </div>
            <button onClick={handleNextWeek} className="p-2 hover:bg-white rounded-lg transition-colors text-gray-600">
              <ChevronRight size={18} />
            </button>
          </div>
          <button 
            onClick={handleCopyToMonth}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50"
          >
            <CalendarIcon className="w-4 h-4" />
            Apply to Month
          </button>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium rounded-xl hover:from-orange-600 hover:to-red-600 transition-all shadow-md disabled:opacity-50"
          >
            {saving ? <Activity className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
            Save Data
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {weekDays.map((date) => {
          const dayData = manpowerData[date];
          const isToday = formatLocalDate(new Date()) === date;

          if (!dayData) return null;

          return (
            <div 
              key={date} 
              className={`bg-white border rounded-2xl overflow-hidden shadow-sm transition-all hover:shadow-md ${isToday ? 'border-orange-400 ring-1 ring-orange-400/20' : 'border-gray-200'}`}
            >
              {/* Day Header */}
              <div className={`px-4 py-3 border-b flex justify-between items-center ${isToday ? 'bg-orange-50 border-orange-100' : 'bg-gray-50 border-gray-100'}`}>
                <span className={`font-bold ${isToday ? 'text-orange-800' : 'text-gray-700'}`}>
                  {formatDate(date)}
                </span>
                {isToday && (
                  <span className="text-[10px] bg-orange-500 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                    Today
                  </span>
                )}
              </div>

              <div className="p-4 space-y-5">
                {/* PLAN Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Plan (แผน)</h3>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500 font-medium block mb-1">พนักงานประจำจุดงาน Plan</label>
                      <input 
                        type="number" 
                        value={dayData.plannedStationWorkers || ''} 
                        onChange={(e) => handleInputChange(date, 'plannedStationWorkers', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                {/* ACTUAL Section */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Actual (หน้างานจริง)</h3>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500 font-medium block mb-1">พนักงานประจำจุดงาน Actual</label>
                      <input 
                        type="number" 
                        value={dayData.actualStationWorkers || ''} 
                        onChange={(e) => handleInputChange(date, 'actualStationWorkers', e.target.value)}
                        className="w-full border border-emerald-200 bg-emerald-50/30 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                        placeholder="0"
                      />
                    </div>
                    
                    <div>
                      <label className="text-xs text-gray-500 font-medium block mb-1">พนักงานตัดแต่ง Actual</label>
                      <input 
                        type="number" 
                        value={dayData.actualCuttingWorkers || ''} 
                        onChange={(e) => handleInputChange(date, 'actualCuttingWorkers', e.target.value)}
                        className="w-full border border-emerald-200 bg-emerald-50/30 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Summary Footer */}
              <div className="bg-gray-50 p-3 border-t border-gray-100 flex justify-between items-center text-xs">
                <span className="font-semibold text-gray-500">Total Workers</span>
                <div className="flex gap-3 font-bold">
                  <span className="text-blue-600" title="Total Planned">
                    P: {dayData.plannedStationWorkers}
                  </span>
                  <span className="text-emerald-600" title="Total Actual">
                    A: {dayData.actualStationWorkers + dayData.actualCuttingWorkers}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ManualOperation;
