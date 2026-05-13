import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  GitMerge, Plus, Trash2, Edit2, Save, X, ChevronDown, ChevronRight, Package, Leaf
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MasterYieldNode {
  id: string;
  name: string;
  yieldPercentage: number;
  type: string;
  parentId: string | null;
  children: MasterYieldNode[];
}

export default function MasterYield() {
  const [treeData, setTreeData] = useState<MasterYieldNode[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State for Add/Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', yieldPercentage: 0, parentId: null as string | null, type: 'CATEGORY' });

  const API = import.meta.env.VITE_API_URL || 'http://localhost:3333';

  const fetchTree = async () => {
    try {
      const res = await axios.get(`${API}/api/master-yield`);
      setTreeData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTree();
  }, []);

  const openAddModal = (parentId: string | null, type: string) => {
    setFormData({ name: '', yieldPercentage: 0, parentId, type });
    setEditMode(false);
    setIsModalOpen(true);
  };

  const openEditModal = (node: MasterYieldNode) => {
    setFormData({ name: node.name, yieldPercentage: node.yieldPercentage * 100, parentId: node.parentId, type: node.type });
    setCurrentNodeId(node.id);
    setEditMode(true);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        ...formData,
        yieldPercentage: formData.yieldPercentage / 100 // Convert back to decimal
      };

      if (editMode && currentNodeId) {
        await axios.put(`${API}/api/master-yield/${currentNodeId}`, payload);
      } else {
        await axios.post(`${API}/api/master-yield`, payload);
      }
      setIsModalOpen(false);
      fetchTree();
    } catch (err) {
      console.error(err);
      alert('Error saving data');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('คุณต้องการลบรายการนี้และรายการย่อยทั้งหมดหรือไม่?')) {
      try {
        await axios.delete(`${API}/api/master-yield/${id}`);
        fetchTree();
      } catch (err) {
        console.error(err);
        alert('Error deleting data');
      }
    }
  };

  const renderTree = (nodes: MasterYieldNode[], level: number = 0) => {
    return nodes.map((node) => (
      <TreeNode 
        key={node.id} 
        node={node} 
        level={level} 
        onAdd={openAddModal} 
        onEdit={openEditModal} 
        onDelete={handleDelete} 
      />
    ));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end border-b border-gray-200 pb-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-sm">
            <GitMerge className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Master Yield Tree</h1>
            <p className="text-gray-500 text-sm mt-1">จัดการโครงสร้าง Yield ผลิตภัณฑ์</p>
          </div>
        </div>
        <button 
          onClick={() => openAddModal(null, 'ROOT')}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors shadow-sm text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> เพิ่ม Root Node
        </button>
      </div>

      {/* Tree Content */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm min-h-[500px]">
        {loading ? (
          <div className="flex justify-center items-center h-40 text-gray-500">กำลังโหลดข้อมูล...</div>
        ) : treeData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-500 gap-3">
            <Package className="w-12 h-12 text-gray-300" />
            <p>ยังไม่มีข้อมูล Yield Tree</p>
          </div>
        ) : (
          <div className="space-y-3">
            {renderTree(treeData)}
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden"
            >
              <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="text-lg font-bold text-gray-900">{editMode ? 'แก้ไขรายการ' : 'เพิ่มรายการใหม่'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">ชื่อรายการ</label>
                  <input 
                    type="text" 
                    value={formData.name} 
                    onChange={e => setFormData({ ...formData, name: e.target.value })} 
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400"
                    placeholder="เช่น สันใน, หัวไก่, process: 1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">% Yield</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      step="0.01"
                      value={formData.yieldPercentage} 
                      onChange={e => setFormData({ ...formData, yieldPercentage: parseFloat(e.target.value) || 0 })} 
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                    <span className="absolute right-4 top-2.5 text-gray-500 font-medium">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">ประเภท (Type)</label>
                  <select 
                    value={formData.type} 
                    onChange={e => setFormData({ ...formData, type: e.target.value })} 
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                  >
                    <option value="ROOT">ROOT (ระดับตั้งต้น)</option>
                    <option value="CATEGORY">CATEGORY (หมวดหมู่/ชิ้นส่วนหลัก)</option>
                    <option value="PROCESS">PROCESS (กระบวนการ)</option>
                    <option value="PRODUCT">PRODUCT (ผลิตภัณฑ์หลัก)</option>
                    <option value="CO-PRODUCT">CO-PRODUCT (ผลิตภัณฑ์ร่วม)</option>
                    <option value="BY-PRODUCT">BY-PRODUCT (ผลพลอยได้)</option>
                  </select>
                </div>
              </div>
              <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-xl hover:bg-gray-50">ยกเลิก</button>
                <button 
                  onClick={handleSave} 
                  disabled={!formData.name} 
                  className="px-5 py-2 text-sm font-semibold text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Save className="w-4 h-4" /> บันทึก
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Recursive Tree Node Component
const TreeNode = ({ node, level, onAdd, onEdit, onDelete }: { 
  node: MasterYieldNode; 
  level: number; 
  onAdd: (parentId: string, type: string) => void;
  onEdit: (node: MasterYieldNode) => void;
  onDelete: (id: string) => void;
}) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  
  const colors = [
    'border-emerald-200 bg-emerald-50', 
    'border-blue-200 bg-blue-50', 
    'border-purple-200 bg-purple-50', 
    'border-amber-200 bg-amber-50'
  ];
  
  const textColors = [
    'text-emerald-800', 'text-blue-800', 'text-purple-800', 'text-amber-800'
  ];

  const bgColor = colors[Math.min(level, colors.length - 1)];
  const textColor = textColors[Math.min(level, textColors.length - 1)];

  return (
    <div className="w-full">
      <div className={`flex items-center justify-between p-3 border rounded-xl mb-2 hover:shadow-md transition-all ${bgColor}`}>
        <div className="flex items-center gap-3">
          <div 
            className={`w-6 h-6 flex items-center justify-center rounded-md cursor-pointer hover:bg-white/50 ${hasChildren ? 'text-gray-600' : 'text-transparent'}`}
            onClick={() => setExpanded(!expanded)}
          >
            {hasChildren && (expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)}
          </div>
          <div className={`font-bold ${textColor} text-sm md:text-base flex items-center gap-2`}>
            {level === 0 && <Leaf className="w-4 h-4" />}
            {node.name}
            {node.type && (
              <span className="px-2 py-0.5 ml-2 text-[10px] uppercase font-bold tracking-wider rounded-md border border-current opacity-70">
                {node.type}
              </span>
            )}
          </div>
          <div className="px-2.5 py-1 bg-white/60 rounded-full text-xs font-bold text-gray-700 shadow-sm">
            {(node.yieldPercentage * 100).toFixed(2)}%
          </div>
        </div>
        
        <div className="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
          <button onClick={() => onAdd(node.id, 'PRODUCT')} className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-white rounded-md" title="เพิ่มรายการย่อย">
            <Plus className="w-4 h-4" />
          </button>
          <button onClick={() => onEdit(node)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-white rounded-md" title="แก้ไข">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={() => onDelete(node.id)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-white rounded-md" title="ลบ">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && hasChildren && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }}
            className="pl-8 border-l-2 border-gray-100 ml-4 mb-2 overflow-hidden"
          >
            {node.children.map(child => (
              <TreeNode 
                key={child.id} 
                node={child} 
                level={level + 1} 
                onAdd={onAdd} 
                onEdit={onEdit} 
                onDelete={onDelete} 
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
