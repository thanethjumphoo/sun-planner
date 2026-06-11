import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Search, Plus, Edit2, Trash2, X, AlertTriangle, 
  Shield, UserCheck, UserX, Building, Calendar, Key, AlertCircle, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CustomSelect from '../components/common/CustomSelect';

const API = import.meta.env.VITE_API_URL;

interface User {
  id: string;
  username: string;
  role: 'admin' | 'production' | 'planner';
  department: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const DEPARTMENTS = [
  'fillet',
  'BL',
];

const ROLES = [
  { value: 'admin', label: 'Administrator (ผู้ดูแลระบบ)' },
  { value: 'production', label: 'Production Staff (ฝ่ายผลิต)' },
  { value: 'planner', label: 'Production Planner (ผู้วางแผน)' }
];

const DEPT_OPTIONS = DEPARTMENTS.map(d => ({ value: d, label: d }));

const FILTER_DEPT_OPTIONS = [
  { value: 'ALL', label: 'ทั้งหมด (All Depts)' },
  ...DEPARTMENTS.map(d => ({ value: d, label: d }))
];

const FILTER_ROLE_OPTIONS = [
  { value: 'ALL', label: 'ทั้งหมด (All Roles)' },
  ...ROLES
];

const FILTER_STATUS_OPTIONS = [
  { value: 'ALL', label: 'ทั้งหมด' },
  { value: 'ACTIVE', label: 'กำลังใช้งาน (Active)' },
  { value: 'INACTIVE', label: 'ระงับการใช้งาน (Inactive)' }
];

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [searchText, setSearchText] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');
  const [filterDept, setFilterDept] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // Form states
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<'admin' | 'production' | 'planner'>('planner');
  const [formDept, setFormDept] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/users`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setUsers(json.data || []);
        } else {
          setError('Failed to load users');
        }
      } else {
        setError('Server responded with an error');
      }
    } catch (err) {
      console.error(err);
      setError('Connection to server failed');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormUsername('');
    setFormPassword('');
    setFormRole('planner');
    setFormDept(DEPARTMENTS[0]);
    setFormIsActive(true);
    setFormError(null);
  };

  const handleOpenAddModal = () => {
    setEditingUser(null);
    resetForm();
    setShowModal(true);
  };

  const handleOpenEditModal = (user: User) => {
    setEditingUser(user);
    setFormUsername(user.username);
    setFormPassword(''); // blank password = no change
    setFormRole(user.role);
    setFormDept(user.department || DEPARTMENTS[0]);
    setFormIsActive(user.isActive);
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUsername.trim()) {
      setFormError('กรุณากรอกชื่อผู้ใช้งาน (Username)');
      return;
    }

    if (!editingUser && !formPassword) {
      setFormError('กรุณากรอกรหัสผ่านสำหรับผู้ใช้งานใหม่');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const url = editingUser ? `${API}/api/users/${editingUser.id}` : `${API}/api/users`;
      const method = editingUser ? 'PUT' : 'POST';
      
      const payload: any = {
        username: formUsername.trim(),
        role: formRole,
        department: formDept,
        isActive: formIsActive
      };

      if (formPassword) {
        payload.password = formPassword;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setShowModal(false);
        resetForm();
        fetchUsers();
      } else {
        setFormError(json.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      }
    } catch (err) {
      console.error(err);
      setFormError('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (id: string, username: string) => {
    if (!confirm(`คุณต้องการลบผู้ใช้งาน "${username}" ใช่หรือไม่?`)) return;
    
    try {
      const res = await fetch(`${API}/api/users/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (res.ok && json.success) {
        fetchUsers();
      } else {
        alert(json.message || 'ไม่สามารถลบผู้ใช้งานได้');
      }
    } catch (err) {
      console.error(err);
      alert('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
    }
  };

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      // Search text
      if (searchText) {
        const query = searchText.toLowerCase();
        const matchesUsername = u.username.toLowerCase().includes(query);
        const matchesDept = (u.department || '').toLowerCase().includes(query);
        if (!matchesUsername && !matchesDept) return false;
      }

      // Role filter
      if (filterRole !== 'ALL' && u.role !== filterRole) return false;

      // Department filter
      if (filterDept !== 'ALL' && u.department !== filterDept) return false;

      // Status filter
      if (filterStatus !== 'ALL') {
        const isActiveFilter = filterStatus === 'ACTIVE';
        if (u.isActive !== isActiveFilter) return false;
      }

      return true;
    });
  }, [users, searchText, filterRole, filterDept, filterStatus]);

  // Formats date to local readable format
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('th-TH', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRoleLabel = (role: string) => {
    const found = ROLES.find(r => r.value === role);
    return found ? found.label.split(' ')[0] : role;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Users className="text-orange-500" />
            User Management (จัดการผู้ใช้งาน)
          </h1>
          <p className="text-gray-500 text-sm mt-1">จัดการรายชื่อผู้ใช้งาน ระบบสิทธิ์เบื้องต้น และแผนกในระบบ Sun-Planner</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-orange-100 transition-all ml-auto sm:ml-0"
        >
          <Plus size={18} />
          เพิ่มผู้ใช้งาน
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-4 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อผู้ใช้งาน หรือแผนก..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all bg-gray-50/30"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Role Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">บทบาท:</span>
            <CustomSelect
              options={FILTER_ROLE_OPTIONS}
              value={filterRole}
              onChange={setFilterRole}
              className="w-48"
            />
          </div>

          {/* Department Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">แผนก:</span>
            <CustomSelect
              options={FILTER_DEPT_OPTIONS}
              value={filterDept}
              onChange={setFilterDept}
              searchable={true}
              placeholder="ค้นหาแผนก..."
              className="w-48"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">สถานะ:</span>
            <CustomSelect
              options={FILTER_STATUS_OPTIONS}
              value={filterStatus}
              onChange={setFilterStatus}
              className="w-40"
            />
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-400 font-bold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 text-left">ชื่อผู้ใช้งาน / Username</th>
                <th className="px-6 py-4 text-left">บทบาท / Role</th>
                <th className="px-6 py-4 text-left">แผนก / Department</th>
                <th className="px-6 py-4 text-center w-36">สถานะการใช้งาน</th>
                <th className="px-6 py-4 text-left w-48">วันที่สร้าง</th>
                <th className="px-6 py-4 text-center w-32">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-3">
                      <Clock className="w-8 h-8 animate-pulse text-orange-400" />
                      <span className="font-semibold text-sm text-gray-500">กำลังโหลดรายชื่อผู้ใช้...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-red-500">
                    <div className="flex flex-col items-center gap-3">
                      <AlertCircle className="w-8 h-8" />
                      <span className="font-bold">{error}</span>
                      <button onClick={fetchUsers} className="text-sm underline font-semibold text-orange-500">
                        ลองใหม่อีกครั้ง
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="w-8 h-8 text-gray-300" />
                      <span className="font-semibold text-gray-500">ไม่พบรายชื่อผู้ใช้งานตามเงื่อนไขที่เลือก</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4.5 font-bold text-gray-900 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold shrink-0 border border-slate-200">
                        {user.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span>{user.username}</span>
                        <span className="text-[10px] text-gray-400 font-mono font-normal tracking-tight">{user.id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                        user.role === 'admin'
                          ? 'bg-red-50 text-red-700 border border-red-100'
                          : user.role === 'planner'
                          ? 'bg-orange-50 text-orange-700 border border-orange-100'
                          : 'bg-blue-50 text-blue-700 border border-blue-100'
                      }`}>
                        <Shield size={12} />
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4.5 text-gray-700">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Building size={14} className="text-gray-400" />
                        {user.department || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        user.isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50'
                          : 'bg-gray-100 text-gray-500 border-gray-200'
                      }`}>
                        {user.isActive ? (
                          <>
                            <UserCheck size={12} /> ใช้งานปกติ
                          </>
                        ) : (
                          <>
                            <UserX size={12} /> ระงับการใช้งาน
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4.5 text-gray-500 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} />
                        {formatDate(user.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenEditModal(user)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="แก้ไขผู้ใช้งาน"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id, user.username)}
                          disabled={user.username === 'admin'}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-30 disabled:hover:bg-transparent"
                          title="ลบผู้ใช้งาน"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowModal(false)}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col border border-gray-100"
            >
              {/* Modal Header */}
              <div className="px-6 py-4.5 border-b border-gray-100 flex items-center justify-between text-white bg-orange-500 rounded-t-2xl">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Shield size={18} />
                  {editingUser ? 'แก้ไขข้อมูลผู้ใช้งาน' : 'เพิ่มผู้ใช้งานใหม่'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors text-white"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {formError && (
                  <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded-lg flex items-start gap-2.5">
                    <AlertTriangle className="text-red-500 w-5 h-5 shrink-0 mt-0.5" />
                    <span className="text-sm font-medium text-red-700">{formError}</span>
                  </div>
                )}

                {/* Username */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                    ชื่อผู้ใช้งาน (Username)
                  </label>
                  <input
                    type="text"
                    required
                    disabled={editingUser?.username === 'admin'}
                    value={formUsername}
                    onChange={e => setFormUsername(e.target.value)}
                    placeholder="ภาษาอังกฤษหรือตัวเลข เช่น production_01"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 disabled:bg-gray-100 disabled:text-gray-500 transition-all text-sm font-semibold"
                  />
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block flex items-center justify-between">
                    <span>รหัสผ่าน (Password)</span>
                    {editingUser && <span className="text-[10px] text-gray-400 capitalize font-medium">เว้นว่างไว้หากไม่เปลี่ยนรหัสผ่าน</span>}
                  </label>
                  <div className="relative">
                    <Key size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="password"
                      required={!editingUser}
                      value={formPassword}
                      onChange={e => setFormPassword(e.target.value)}
                      placeholder={editingUser ? "•••••••• (ไม่เปลี่ยนรหัสผ่าน)" : "ความยาวอย่างน้อย 6 ตัวอักษร"}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-sm"
                    />
                  </div>
                </div>

                {/* Role */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                    บทบาทหน้าที่ (Role)
                  </label>
                  <CustomSelect
                    options={ROLES}
                    value={formRole}
                    onChange={(val) => setFormRole(val as any)}
                  />
                </div>

                {/* Department */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                    แผนก (Department)
                  </label>
                  <CustomSelect
                    options={DEPT_OPTIONS}
                    value={formDept}
                    onChange={setFormDept}
                    searchable={true}
                    placeholder="เลือกแผนก..."
                  />
                </div>

                {/* Status Toggle (only when editing) */}
                {editingUser && editingUser.username !== 'admin' && (
                  <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-gray-700">สถานะการใช้งาน</span>
                      <span className="text-[10px] text-gray-400">ปิดการระงับสิทธิ์เข้าใช้งานชั่วคราว</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormIsActive(!formIsActive)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        formIsActive ? 'bg-orange-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          formIsActive ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                )}

                {/* Submit Actions */}
                <div className="flex gap-2 pt-2 border-t border-gray-100 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-200 hover:bg-gray-50 active:scale-95 text-gray-600 font-bold rounded-xl text-sm transition-all"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-orange-100 flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {submitting ? 'กำลังบันทึก...' : editingUser ? 'บันทึกการแก้ไข' : 'บันทึกผู้ใช้'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
