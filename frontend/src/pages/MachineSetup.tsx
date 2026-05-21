import { useState, useEffect } from 'react';
import { Settings, Save, CheckCircle, Zap, ShieldAlert, Cpu } from 'lucide-react';
import axios from 'axios';

interface MachineConfig {
  id: number;
  machineKey: string;
  machineName: string;
  machineType: string;
  capacityPcsPerHour: number;
  yieldPercentage: number;
  defaultLines: number;
  machinesPerLine: number;
  workersPerUnit: number;
  isActive: boolean;
}

export default function MachineSetup() {
  const [configs, setConfigs] = useState<MachineConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/machine-config`);
      
      if (res.data.length === 0) {
        // Auto seed if empty
        await axios.post(`${import.meta.env.VITE_API_URL}/api/machine-config/seed`);
        const refetch = await axios.get(`${import.meta.env.VITE_API_URL}/api/machine-config`);
        setConfigs(refetch.data);
      } else {
        setConfigs(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch configs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigChange = (id: number, field: keyof MachineConfig, value: number | boolean) => {
    setConfigs(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      for (const conf of configs) {
        await axios.post(`${import.meta.env.VITE_API_URL}/api/machine-config/${conf.id}/update`, conf);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save configurations.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="mt-4 text-indigo-600 font-bold animate-pulse">Loading Configurations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-900 p-8 text-white rounded-[32px] shadow-2xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay"></div>
        <div className="absolute -right-20 -top-20 w-96 h-96 bg-purple-500/20 blur-3xl rounded-full group-hover:bg-purple-500/30 transition-all duration-1000"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="bg-white/10 p-5 rounded-2xl backdrop-blur-xl border border-white/20 shadow-inner">
              <Cpu className="w-10 h-10 text-indigo-300" />
            </div>
            <div>
              <h1 className="text-4xl font-black mb-2 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-indigo-200">
                Machine & Flow Setup
              </h1>
              <p className="text-indigo-200/80 font-medium max-w-xl leading-relaxed">
                Configure production machines, speed limits, and manpower requirements. 
                Changes here will instantly reflect in both MPS (Monthly) and DPS (Daily) calculations.
              </p>
            </div>
          </div>
          <button 
            onClick={handleSaveAll}
            disabled={saving}
            className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-200 bg-indigo-500 font-pj rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 hover:bg-indigo-600 shadow-xl shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden shrink-0"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
            <span className="relative flex items-center gap-2">
              {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : saveSuccess ? <CheckCircle size={20} /> : <Save size={20} />}
              {saving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Configurations'}
            </span>
          </button>
        </div>
      </div>

      <div className="bg-orange-50 border border-orange-200 p-4 rounded-2xl flex items-start gap-4">
        <ShieldAlert className="text-orange-500 w-6 h-6 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold text-orange-800">Critical Settings Area</h3>
          <p className="text-sm text-orange-600 mt-1">
            Modifying these values will directly impact the output capacity and manpower requirements calculated by the system.
            Please ensure values match actual factory floor capabilities.
          </p>
        </div>
      </div>

      {/* Grid of Machines */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {configs.map((conf) => (
          <div key={conf.id} className="bg-white rounded-[24px] border border-gray-200/80 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group">
            
            <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${conf.isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>
                  <Settings size={20} />
                </div>
                <div>
                  <h3 className="font-black text-gray-900 text-lg">{conf.machineName}</h3>
                  <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">{conf.machineType}</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={conf.isActive}
                  onChange={(e) => handleConfigChange(conf.id, 'isActive', e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                <span className="ml-3 text-sm font-bold text-gray-700">{conf.isActive ? 'Active' : 'Disabled'}</span>
              </label>
            </div>

            <div className={`p-6 grid grid-cols-2 gap-x-8 gap-y-6 transition-opacity ${!conf.isActive ? 'opacity-40 pointer-events-none' : ''}`}>
              
              {/* Capacity */}
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Speed (pcs / hr)</label>
                <div className="relative">
                  <input 
                    type="number"
                    value={conf.capacityPcsPerHour}
                    onChange={(e) => handleConfigChange(conf.id, 'capacityPcsPerHour', Number(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-lg font-black rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block p-3 pr-12 transition-all"
                  />
                  <Zap className="absolute right-4 top-3.5 text-yellow-500 w-5 h-5" />
                </div>
              </div>

              {/* Yield */}
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Yield %</label>
                <div className="relative flex items-center">
                  <input 
                    type="range" 
                    min="0" max="1" step="0.01" 
                    value={conf.yieldPercentage}
                    onChange={(e) => handleConfigChange(conf.id, 'yieldPercentage', Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <span className="ml-4 min-w-[3rem] text-right font-black text-indigo-700 text-lg bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">
                    {Math.round(conf.yieldPercentage * 100)}%
                  </span>
                </div>
              </div>

              <div className="col-span-2 h-px bg-gray-100 w-full my-2"></div>

              {/* Layout Config */}
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Number of Lines / Belts</label>
                <input 
                  type="number"
                  value={conf.defaultLines}
                  onChange={(e) => handleConfigChange(conf.id, 'defaultLines', Number(e.target.value))}
                  className="w-full bg-white border border-gray-200 text-gray-900 text-base font-bold rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block p-3"
                />
              </div>
              
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Machines Per Line</label>
                <input 
                  type="number"
                  value={conf.machinesPerLine}
                  onChange={(e) => handleConfigChange(conf.id, 'machinesPerLine', Number(e.target.value))}
                  className="w-full bg-white border border-gray-200 text-gray-900 text-base font-bold rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block p-3"
                />
              </div>

              {/* Manpower */}
              <div className="col-span-2 bg-purple-50/50 p-4 rounded-2xl border border-purple-100">
                <label className="block text-[11px] font-bold text-purple-500 uppercase tracking-wider mb-2">Headcount per Unit (Line / Belt / Machine)</label>
                <div className="flex items-center gap-4">
                  <input 
                    type="number"
                    value={conf.workersPerUnit}
                    onChange={(e) => handleConfigChange(conf.id, 'workersPerUnit', Number(e.target.value))}
                    className="w-32 bg-white border border-purple-200 text-purple-900 text-xl font-black rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 block p-2.5 text-center"
                  />
                  <div className="text-xs font-semibold text-purple-600/70">
                    Total Potential Manpower: <span className="font-black text-purple-800 text-sm ml-1">{(conf.defaultLines * (conf.machineKey === 'toridas' ? 1 : conf.machinesPerLine) * conf.workersPerUnit)} pax</span>
                    <br/><span className="text-[10px] italic">*(Toridas counts workers per line, not per individual machine)*</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
