import React, { useState, useEffect } from 'react';
import { RefreshCw, Save, Plus, Trash2, Box, Store } from 'lucide-react';
import CustomSelect from '../components/common/CustomSelect';
import CustomDatePicker from '../components/common/CustomDatePicker';

const API = import.meta.env.VITE_API_URL;

const PART_NAME_OPTIONS = [
  { value: 'BIL L/C', label: 'BIL L/C' },
  { value: 'FL', label: 'Fillet' }
];

const ExternalRmInput: React.FC = () => {
  const [supplies, setSupplies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    receivedDate: new Date().toISOString().split('T')[0],
    partName: 'BIL L/C',
    totalWeightKg: '',
    vendorName: '',
    lotNumber: ''
  });
  const [sizeBreakdown, setSizeBreakdown] = useState<Array<{label: string, amount: string}>>([
    { label: '140 Down', amount: '' },
    { label: '140-160', amount: '' },
    { label: '160-180', amount: '' },
    { label: '180-200', amount: '' },
    { label: '200-220', amount: '' },
    { label: '220-240', amount: '' },
    { label: '240-260', amount: '' },
    { label: '260-280', amount: '' },
    { label: '280-300', amount: '' },
    { label: '300-320', amount: '' },
    { label: '320-340', amount: '' },
    { label: '340-360', amount: '' },
    { label: '360-380', amount: '' },
    { label: '380 Up', amount: '' }
  ]);

  useEffect(() => {
    fetchSupplies();
  }, []);

  const fetchSupplies = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/external-rm-supplies`);
      if (res.ok) {
        const json = await res.json();
        setSupplies(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.receivedDate || !formData.partName || !formData.totalWeightKg) {
      alert("Please fill in Date, Part, and Total Weight");
      return;
    }

    const cleanSizes: Record<string, number> = {};
    sizeBreakdown.forEach((item) => {
      if (item.label && item.amount && Number(item.amount) > 0) {
        cleanSizes[item.label.trim()] = Number(item.amount);
      }
    });

    const payload = {
      ...formData,
      totalWeightKg: Number(formData.totalWeightKg),
      sizeBreakdownJson: JSON.stringify(cleanSizes)
    };

    try {
      const res = await fetch(`${API}/api/external-rm-supplies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        fetchSupplies();
        setFormData({ ...formData, totalWeightKg: '', vendorName: '', lotNumber: '' });
        setSizeBreakdown(sizeBreakdown.map(item => ({ ...item, amount: '' })));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this record?')) return;
    try {
      const res = await fetch(`${API}/api/external-rm-supplies/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchSupplies();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-black text-gray-800 tracking-tight">External RM Input (Purchased Meat)</h1>
          <p className="text-gray-500 mt-1">Record and manage purchased raw materials, specifically tracked for segregated downstream production.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-visible flex flex-col md:flex-row">
        
        {/* Left Side: Form */}
        <div className="w-full md:w-1/3 p-6 bg-gray-50 border-r border-gray-200">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Plus size={18}/> New Delivery Record</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Received Date</label>
              <CustomDatePicker
                value={formData.receivedDate}
                onChange={val => setFormData({...formData, receivedDate: val})}
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Part Name</label>
              <CustomSelect
                options={PART_NAME_OPTIONS}
                value={formData.partName}
                onChange={val => setFormData({...formData, partName: val})}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Vendor Name</label>
                <input type="text" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500" 
                  value={formData.vendorName} onChange={e => setFormData({...formData, vendorName: e.target.value})} placeholder="e.g. Supplier A" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Lot Number</label>
                <input type="text" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500" 
                  value={formData.lotNumber} onChange={e => setFormData({...formData, lotNumber: e.target.value})} placeholder="e.g. LOT-2026-X" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Total Weight (kg)</label>
              <input type="number" className="w-full border border-gray-300 rounded-lg p-2 text-xl font-bold focus:ring-2 focus:ring-blue-500 text-blue-800" 
                value={formData.totalWeightKg} onChange={e => setFormData({...formData, totalWeightKg: e.target.value})} placeholder="0.00" />
            </div>

            <div className="pt-4 border-t border-gray-200">
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2 flex items-center gap-1"><Box size={14}/> Sizing Breakdown (kg)</label>
              <div className="flex flex-col space-y-2 max-h-[250px] overflow-y-auto pr-2">
                {sizeBreakdown.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input 
                      type="text" 
                      className="w-24 text-xs font-bold text-gray-600 bg-gray-50 border border-gray-300 rounded p-1.5 focus:bg-white transition-colors" 
                      value={item.label} 
                      placeholder="e.g. 300+"
                      onChange={e => {
                        const newArr = [...sizeBreakdown];
                        newArr[idx].label = e.target.value;
                        setSizeBreakdown(newArr);
                      }} 
                    />
                    <input 
                      type="number" 
                      className="flex-1 border border-gray-300 rounded p-1.5 text-sm text-right font-medium" 
                      placeholder="0 kg" 
                      value={item.amount} 
                      onChange={e => {
                        const newArr = [...sizeBreakdown];
                        newArr[idx].amount = e.target.value;
                        setSizeBreakdown(newArr);
                      }} 
                    />
                    <button 
                      onClick={() => {
                        const newArr = sizeBreakdown.filter((_, i) => i !== idx);
                        setSizeBreakdown(newArr);
                      }} 
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Remove Size"
                    >
                        <Trash2 size={16}/>
                    </button>
                  </div>
                ))}
                <button 
                  onClick={() => setSizeBreakdown([...sizeBreakdown, {label: '', amount: ''}])} 
                  className="text-xs text-orange-600 font-bold hover:text-orange-700 self-start mt-2 px-2 py-1 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors border border-orange-200 flex items-center gap-1"
                >
                  + Add Custom Size
                </button>
              </div>
            </div>

            <button onClick={handleSave} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-sm transition-colors flex justify-center items-center gap-2 mt-4">
              <Save size={18} /> Save Record
            </button>
          </div>
        </div>

        {/* Right Side: List */}
        <div className="w-full md:w-2/3 p-6 flex flex-col h-[700px]">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Store size={18}/> Delivery History</h2>
            <button onClick={fetchSupplies} className="text-gray-500 hover:text-blue-600"><RefreshCw size={18} className={loading ? 'animate-spin' : ''}/></button>
          </div>
          
          <div className="flex-1 overflow-auto border border-gray-200 rounded-xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100/80 border-b border-gray-200 text-gray-700 font-bold uppercase text-[10px] tracking-wider sticky top-0">
                <tr>
                  <th className="px-4 py-3">Received Date</th>
                  <th className="px-4 py-3">Part</th>
                  <th className="px-4 py-3">Vendor / Lot</th>
                  <th className="px-4 py-3 text-right">Total Kg</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {supplies.map((s: any) => (
                  <React.Fragment key={s.id}>
                    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {new Date(s.receivedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-600">
                        <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs">{s.partName}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-700">{s.vendorName || '-'}</div>
                        <div className="text-xs text-gray-500">{s.lotNumber}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-blue-700">
                        {Number(s.totalWeightKg).toLocaleString()} kg
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleDelete(s.id)} className="text-red-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                    {s.sizeBreakdownJson && s.sizeBreakdownJson !== '{}' && (
                      <tr className="bg-gray-50/50 border-b border-gray-200">
                        <td colSpan={5} className="px-4 py-2">
                          <div className="flex flex-wrap gap-2 text-[10px]">
                            {Object.entries(JSON.parse(s.sizeBreakdownJson)).map(([sz, qty]) => (
                              <span key={sz} className="bg-white border border-gray-200 px-2 py-1 rounded shadow-sm text-gray-600">
                                <strong>{sz}:</strong> {Number(qty).toLocaleString()} kg
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {supplies.length === 0 && !loading && (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400 italic">No external deliveries recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExternalRmInput;
