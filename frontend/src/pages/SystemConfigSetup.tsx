import { useState, useEffect } from 'react';
import { Settings, Save, CheckCircle, SlidersHorizontal, AlertCircle } from 'lucide-react';
import axios from 'axios';

interface SystemConfig {
  id: number;
  configKey: string;
  configValue: string;
  valueType: string;
  description: string;
  isActive: boolean;
}

export default function SystemConfigSetup() {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/system-config`);
      setConfigs(res.data);
    } catch (err) {
      console.error('Failed to fetch configs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigChange = (key: string, value: string | boolean) => {
    setConfigs(prev => prev.map(c => c.configKey === key ? { ...c, configValue: String(value) } : c));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      for (const conf of configs) {
        await axios.put(`${import.meta.env.VITE_API_URL}/api/system-config/${conf.configKey}`, { value: conf.configValue });
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
          <p className="mt-4 text-indigo-600 font-bold animate-pulse">Loading System Configs...</p>
        </div>
      </div>
    );
  }

  // Grouping configs by logical categories based on keywords
  const getCategory = (key: string) => {
    if (key.includes('LEAD') || key.includes('OFFSET') || key.includes('ADD_DAYS')) return 'Lead Time & Offsets';
    if (key.includes('YIELD') || key.includes('RATIO')) return 'Standard Yields & Ratios';
    if (key.includes('ICUT') || key.includes('SPEED') || key.includes('SHIFT') || key.includes('HOURS')) return 'Machine Constraints';
    return 'General Settings';
  };

  const groupedConfigs = configs.reduce((acc, conf) => {
    const cat = getCategory(conf.configKey);
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(conf);
    return acc;
  }, {} as Record<string, SystemConfig[]>);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-900 p-8 text-white rounded-[32px] shadow-2xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay"></div>
        <div className="absolute -right-20 -top-20 w-96 h-96 bg-blue-500/20 blur-3xl rounded-full group-hover:bg-blue-500/30 transition-all duration-1000"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="bg-white/10 p-5 rounded-2xl backdrop-blur-xl border border-white/20 shadow-inner">
              <SlidersHorizontal className="w-10 h-10 text-blue-300" />
            </div>
            <div>
              <h1 className="text-4xl font-black mb-2 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">
                System Parameters
              </h1>
              <p className="text-blue-200/80 font-medium max-w-xl leading-relaxed">
                Manage global fallback values, system constraints, lead time calculations, and standard yields. 
                These values are used as fallbacks if specific product specs do not provide them.
              </p>
            </div>
          </div>
          <button 
            onClick={handleSaveAll}
            disabled={saving}
            className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-200 bg-blue-500 font-pj rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 hover:bg-blue-600 shadow-xl shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden shrink-0"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
            <span className="relative flex items-center gap-2">
              {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : saveSuccess ? <CheckCircle size={20} /> : <Save size={20} />}
              {saving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Changes'}
            </span>
          </button>
        </div>
      </div>

      <div className="bg-orange-50 border border-orange-200 p-4 rounded-2xl flex items-start gap-4">
        <AlertCircle className="text-orange-500 w-6 h-6 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold text-orange-800">Global Impact</h3>
          <p className="text-sm text-orange-600 mt-1">
            Modifying these parameters affects how the Master Production Schedule (MPS) and Daily Production Schedule (DPS) are generated globally. 
            Ensure you understand the variables before making changes.
          </p>
        </div>
      </div>

      {Object.entries(groupedConfigs).map(([category, items]) => (
        <div key={category} className="bg-white rounded-[24px] border border-gray-200/80 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden mb-6">
          <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-600">
              <Settings size={20} />
            </div>
            <h3 className="font-black text-gray-900 text-lg">{category}</h3>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {items.map((conf) => (
                <div key={conf.configKey} className="relative group/field">
                  <label className="block text-[13px] font-bold text-gray-700 mb-1">{conf.configKey}</label>
                  <p className="text-[11px] text-gray-400 mb-2 leading-tight">{conf.description}</p>
                  
                  {conf.valueType === 'boolean' ? (
                     <label className="relative inline-flex items-center cursor-pointer mt-1">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={conf.configValue === 'true'}
                        onChange={(e) => handleConfigChange(conf.configKey, e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                      <span className="ml-3 text-sm font-bold text-gray-700">{conf.configValue === 'true' ? 'Enabled' : 'Disabled'}</span>
                    </label>
                  ) : (
                    <input 
                      type={conf.valueType === 'number' ? 'number' : 'text'}
                      step={conf.valueType === 'number' ? 'any' : undefined}
                      value={conf.configValue}
                      onChange={(e) => handleConfigChange(conf.configKey, e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-base font-bold rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block p-3 transition-all hover:bg-white"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

    </div>
  );
}
