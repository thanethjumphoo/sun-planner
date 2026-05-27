import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, CheckCircle, GripVertical, Info } from 'lucide-react';
import axios from 'axios';

interface MatrixRow {
  id: number;
  targetProduct: string;
  priority: number;
  rmSize: string;
  yieldPct: number;
}

export default function BlBeltGateMatrixSetup() {
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchMatrix();
  }, []);

  const fetchMatrix = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/bl-belt-gate-matrix`);
      if (res.data.length === 0) {
        // Provide some default examples if empty
        setMatrix([
          { id: 1, targetProduct: 'BLK 140 DOWN', priority: 1, rmSize: '140 DOWN', yieldPct: 100 },
          { id: 2, targetProduct: 'BLK 160-180', priority: 1, rmSize: '160-180', yieldPct: 100 },
        ]);
      } else {
        setMatrix(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch belt gate matrix:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRow = () => {
    const newId = matrix.length > 0 ? Math.max(...matrix.map(m => m.id)) + 1 : 1;
    setMatrix([...matrix, { id: newId, targetProduct: '', priority: 1, rmSize: '', yieldPct: 100 }]);
  };

  const handleRemoveRow = (id: number) => {
    setMatrix(matrix.filter(m => m.id !== id));
  };

  const handleChange = (id: number, field: keyof MatrixRow, value: string | number) => {
    setMatrix(matrix.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/bl-belt-gate-matrix`, {
        data: matrix
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      fetchMatrix(); // Refresh IDs
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save matrix configurations.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
          <p className="mt-4 text-orange-600 font-bold animate-pulse">Loading Belt Gate Matrix...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-amber-500 p-8 text-white rounded-[32px] shadow-2xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-black mb-2 tracking-tight">
              BL Belt Gate Matrix
            </h1>
            <p className="text-orange-100 font-medium max-w-2xl leading-relaxed">
              Map the target BLK Sizing Orders to the required RM BL Size. This matrix controls how the system 
              matches raw material sizes with the final product sizes in Priority 1 (Sizing Allocation).
            </p>
          </div>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-orange-600 bg-white transition-all duration-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white hover:bg-gray-50 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden shrink-0"
          >
            <span className="relative flex items-center gap-2">
              {saving ? <div className="w-5 h-5 border-2 border-orange-200 border-t-orange-600 rounded-full animate-spin" /> : saveSuccess ? <CheckCircle size={20} /> : <Save size={20} />}
              {saving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Matrix'}
            </span>
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl flex items-start gap-4">
        <Info className="text-blue-500 w-6 h-6 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold text-blue-800">How to map sizes?</h3>
          <p className="text-sm text-blue-600 mt-1">
            Specify the <strong>Target Product</strong> (Order description like "BLK 140 DOWN") and match it to the <strong>RM Size</strong> 
            (like "140 DOWN") coming from the BIL department. The system will look for this exact match when allocating RM BL.
          </p>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="bg-white rounded-[24px] border border-gray-200 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-500 font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4 w-10"></th>
                <th className="px-6 py-4">Target Product (Sizing Order)</th>
                <th className="px-6 py-4 w-40">Priority</th>
                <th className="px-6 py-4">Required RM Size (from BIL)</th>
                <th className="px-6 py-4 w-40">Yield %</th>
                <th className="px-6 py-4 w-20 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {matrix.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-3 text-gray-300 group-hover:text-gray-400">
                    <GripVertical size={16} />
                  </td>
                  <td className="px-6 py-3">
                    <input
                      type="text"
                      value={row.targetProduct}
                      onChange={(e) => handleChange(row.id, 'targetProduct', e.target.value)}
                      placeholder="e.g. BLK 140 DOWN"
                      className="w-full bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 px-3 py-2 font-medium"
                    />
                  </td>
                  <td className="px-6 py-3">
                    <input
                      type="number"
                      value={row.priority}
                      onChange={(e) => handleChange(row.id, 'priority', Number(e.target.value))}
                      className="w-full bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 px-3 py-2 text-center"
                    />
                  </td>
                  <td className="px-6 py-3">
                    <input
                      type="text"
                      value={row.rmSize}
                      onChange={(e) => handleChange(row.id, 'rmSize', e.target.value)}
                      placeholder="e.g. 140 DOWN"
                      className="w-full bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 px-3 py-2 font-bold text-orange-700"
                    />
                  </td>
                  <td className="px-6 py-3">
                    <div className="relative">
                      <input
                        type="number"
                        value={row.yieldPct}
                        onChange={(e) => handleChange(row.id, 'yieldPct', Number(e.target.value))}
                        className="w-full bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 pl-3 pr-8 py-2 text-right font-medium"
                      />
                      <span className="absolute right-3 top-2.5 text-gray-400">%</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button
                      onClick={() => handleRemoveRow(row.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {matrix.length === 0 && (
          <div className="p-8 text-center text-gray-500 italic">
            No size mappings found. Add a row to get started.
          </div>
        )}

        <div className="p-4 bg-gray-50 border-t border-gray-100">
          <button
            onClick={handleAddRow}
            className="flex items-center gap-2 text-orange-600 font-bold hover:text-orange-700 hover:bg-orange-100 px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={18} /> Add Size Mapping
          </button>
        </div>
      </div>
    </div>
  );
}
