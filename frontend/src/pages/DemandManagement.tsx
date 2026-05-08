import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, Search, Filter, ChevronLeft, ArrowUpDown, Package, AlertTriangle, Calendar, Hash, User, FileText, Tag, Clock, Plus, Trash2, X } from 'lucide-react';

const API = import.meta.env.VITE_API_URL;

interface OrderLine {
  id: number; erpOrderLineId: number; erpOrderHeaderId: number; erpOrderLineNumber: string;
  erpOrderItemId: number; erpOrderItemCode: string; erpOrderItemQty: number; erpOrderItemUom: string;
  erpOrderShipDate: string; erpOrderStatus: string; erpItemDesc: string | null; isItemSynced: boolean;
}
interface OrderHeader {
  id: number; erpOrderHeaderId: number; erpOrgId: number; erpOrderDate: string; erpOrderNumber: string;
  erpOrderType: string; erpCustomerNumber: string; erpCustomerName: string; erpCustomerGrade: string;
  erpOrderStatus: string; isManual: boolean; lines: OrderLine[];
}

export default function DemandManagement() {
  const [orders, setOrders] = useState<OrderHeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderHeader | null>(null);
  const [activeTab, setActiveTab] = useState<'ERP' | 'MANUAL'>('ERP');

  // Filters
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterGrade, setFilterGrade] = useState('ALL');
  const [sortField, setSortField] = useState<'date' | 'customer' | 'number'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [erpItems, setErpItems] = useState<any[]>([]);
  const [newOrder, setNewOrder] = useState({
    erpOrderNumber: '',
    erpOrderType: 'IVQF',
    erpCustomerName: 'Internal Customer',
    erpOrderDate: new Date().toISOString().split('T')[0],
    lines: [{ erpOrderItemCode: '', erpOrderItemQty: 0, erpOrderShipDate: new Date().toISOString().split('T')[0] }]
  });

  useEffect(() => {
    fetchOrders();
    fetchItems();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/erp/demand-orders`);
      if (res.ok) setOrders(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchItems = async () => {
    try {
      const res = await fetch(`${API}/api/erp/items`);
      if (res.ok) setErpItems(await res.json());
    } catch (err) { console.error(err); }
  };

  // Unique values for filters
  const statuses = useMemo(() => ['ALL', ...new Set(orders.map(o => o.erpOrderStatus).filter(Boolean))], [orders]);
  const grades = useMemo(() => ['ALL', ...new Set(orders.map(o => o.erpCustomerGrade).filter(Boolean))], [orders]);

  // Filtered & sorted orders
  const filteredOrders = useMemo(() => {
    let result = orders.filter(o => {
      // Tab filter
      if (activeTab === 'ERP' && o.isManual) return false;
      if (activeTab === 'MANUAL' && !o.isManual) return false;

      if (filterStatus !== 'ALL' && o.erpOrderStatus !== filterStatus) return false;
      if (filterGrade !== 'ALL' && o.erpCustomerGrade !== filterGrade) return false;
      if (searchText) {
        const s = searchText.toLowerCase();
        return (o.erpOrderNumber || '').toLowerCase().includes(s) ||
               (o.erpCustomerName || '').toLowerCase().includes(s) ||
               (o.erpCustomerNumber || '').toLowerCase().includes(s);
      }
      return true;
    });

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') cmp = new Date(a.erpOrderDate).getTime() - new Date(b.erpOrderDate).getTime();
      else if (sortField === 'customer') cmp = (a.erpCustomerName || '').localeCompare(b.erpCustomerName || '');
      else cmp = (a.erpOrderNumber || '').localeCompare(b.erpOrderNumber || '');
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [orders, searchText, filterStatus, filterGrade, sortField, sortDir, activeTab]);

  const totalQty = useMemo(() => filteredOrders.reduce((sum, o) => sum + o.lines.reduce((s, l) => s + Number(l.erpOrderItemQty || 0), 0), 0), [filteredOrders]);
  const totalLines = useMemo(() => filteredOrders.reduce((sum, o) => sum + o.lines.length, 0), [filteredOrders]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

  const handleAddOrder = async () => {
    if (!newOrder.erpOrderNumber || newOrder.lines.some(l => !l.erpOrderItemCode || l.erpOrderItemQty <= 0)) {
      alert('Please fill in all required fields');
      return;
    }
    try {
      const url = editingOrderId ? `${API}/api/erp/manual-order/${editingOrderId}` : `${API}/api/erp/manual-order`;
      const res = await fetch(url, {
        method: 'POST', // Already using POST in controller for update
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrder)
      });
      if (res.ok) {
        setShowAddModal(false);
        setEditingOrderId(null);
        fetchOrders();
        setNewOrder({
          erpOrderNumber: '',
          erpOrderType: 'IVQF',
          erpCustomerName: 'Internal Customer',
          erpOrderDate: new Date().toISOString().split('T')[0],
          lines: [{ erpOrderItemCode: '', erpOrderItemQty: 0, erpOrderShipDate: new Date().toISOString().split('T')[0] }]
        });
      }
    } catch (err) { console.error(err); }
  };

  const handleEditClick = (e: React.MouseEvent, o: OrderHeader) => {
    e.stopPropagation();
    setEditingOrderId(o.id);
    setNewOrder({
      erpOrderNumber: o.erpOrderNumber,
      erpOrderType: o.erpOrderType,
      erpCustomerName: o.erpCustomerName,
      erpOrderDate: new Date(o.erpOrderDate).toISOString().split('T')[0],
      lines: o.lines.map(l => ({
        erpOrderItemCode: l.erpOrderItemCode,
        erpOrderItemQty: Number(l.erpOrderItemQty),
        erpOrderShipDate: new Date(l.erpOrderShipDate).toISOString().split('T')[0]
      }))
    });
    setShowAddModal(true);
  };

  const handleDeleteOrder = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this manual order?')) return;
    try {
      const res = await fetch(`${API}/api/erp/manual-order/${id}`, { method: 'DELETE' });
      if (res.ok) fetchOrders();
    } catch (err) { console.error(err); }
  };

  // ─── DETAIL VIEW ───
  if (selectedOrder) {
    const o = selectedOrder;
    return (
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        {/* Back Button */}
        <button onClick={() => setSelectedOrder(null)} className="flex items-center gap-2 text-gray-500 hover:text-orange-600 transition-colors text-sm font-medium group">
          <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> Back to {o.isManual ? 'Manual Orders' : 'Sales Orders'}
        </button>

        {/* Order Header Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className={`bg-gradient-to-r ${o.isManual ? 'from-blue-600 to-indigo-600' : 'from-orange-500 to-red-500'} px-6 py-5`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm font-medium">{o.isManual ? 'Manual Planning Order' : 'Sales Order'}</p>
                <h2 className="text-2xl font-bold text-white mt-1">{o.erpOrderNumber}</h2>
              </div>
              <div className="flex items-center gap-3">
                {o.isManual && <span className="bg-white/20 text-white px-2 py-1 rounded text-xs font-bold uppercase tracking-wider border border-white/30">Manual</span>}
                <StatusBadge status={o.erpOrderStatus} large />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
            <InfoItem icon={User} label="Customer" value={o.erpCustomerName} sub={o.erpCustomerNumber ? `#${o.erpCustomerNumber}` : undefined} />
            <InfoItem icon={Tag} label="Grade" value={o.erpCustomerGrade || '-'} />
            <InfoItem icon={FileText} label="Order Type" value={o.erpOrderType} />
            <InfoItem icon={Calendar} label="Order Date" value={formatDate(o.erpOrderDate)} />
          </div>
        </div>

        {/* Order Lines */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">Order Lines <span className="text-sm font-normal text-gray-400 ml-2">{o.lines.length} items</span></h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-5 py-3 text-left w-16">Line</th>
                  <th className="px-5 py-3 text-left">Item Code</th>
                  <th className="px-5 py-3 text-left">Item Description</th>
                  <th className="px-5 py-3 text-right">Quantity</th>
                  <th className="px-5 py-3 text-left">UOM</th>
                  <th className="px-5 py-3 text-left">Ship Date</th>
                  <th className="px-5 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {o.lines.map(l => (
                  <tr key={l.id} className="border-b border-gray-50 hover:bg-orange-50/30 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-gray-700">{l.erpOrderLineNumber}</td>
                    <td className="px-5 py-3.5">
                      <span className="font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-xs">{l.erpOrderItemCode}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      {l.isItemSynced ? (
                        <span className="text-gray-800">{l.erpItemDesc}</span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-amber-600 text-xs">
                          <AlertTriangle size={13} /> ไม่ได้ Sync กับ ERP Item
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-gray-900">{Number(l.erpOrderItemQty).toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-gray-500">{l.erpOrderItemUom}</td>
                    <td className="px-5 py-3.5 text-gray-600">{formatDate(l.erpOrderShipDate)}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={l.erpOrderStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ─── LIST VIEW ───
  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Demand Management</h1>
          <p className="text-gray-500 text-sm mt-1">Manage Sales Orders from ERP and manual internal demand plans.</p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setActiveTab('ERP')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'ERP' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}>ERP Sales Orders</button>
          <button onClick={() => setActiveTab('MANUAL')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'MANUAL' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Manual Planning</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-slide-up delay-100">
        <SummaryCard icon={FileText} label="Total Orders" value={filteredOrders.length} color={activeTab === 'ERP' ? 'orange' : 'blue'} />
        <SummaryCard icon={Hash} label="Total Lines" value={totalLines} color="blue" />
        <SummaryCard icon={Package} label="Total Qty" value={totalQty.toLocaleString()} color="emerald" />
        <SummaryCard icon={User} label="Customers" value={new Set(filteredOrders.map(o => o.erpCustomerNumber)).size} color="purple" />
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-3 animate-slide-up delay-200">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search order number, customer..." value={searchText} onChange={e => setSearchText(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors" />
        </div>
        {activeTab === 'ERP' && (
          <>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500">
              {statuses.map(s => <option key={s} value={s}>{s === 'ALL' ? 'All Status' : s}</option>)}
            </select>
            <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500">
              {grades.map(g => <option key={g} value={g}>{g === 'ALL' ? 'All Grades' : `Grade ${g}`}</option>)}
            </select>
          </>
        )}
        <div className="flex items-center gap-3 ml-auto">
          <div className="flex items-center gap-1 text-xs text-gray-400"><Filter size={14} /> {filteredOrders.length} filtered</div>
          {activeTab === 'MANUAL' && (
            <button onClick={() => {
              setEditingOrderId(null);
              setNewOrder({
                erpOrderNumber: '',
                erpOrderType: 'IVQF',
                erpCustomerName: 'Internal Customer',
                erpOrderDate: new Date().toISOString().split('T')[0],
                lines: [{ erpOrderItemCode: '', erpOrderItemQty: 0, erpOrderShipDate: new Date().toISOString().split('T')[0] }]
              });
              setShowAddModal(true);
            }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
              <Plus size={16} /> Add Manual Plan
            </button>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-slide-up delay-300">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-5 py-3 text-left cursor-pointer select-none hover:text-orange-600" onClick={() => toggleSort('number')}>
                  <span className="flex items-center gap-1">Order No. <ArrowUpDown size={12} /></span>
                </th>
                <th className="px-5 py-3 text-left">Type</th>
                <th className="px-5 py-3 text-left cursor-pointer select-none hover:text-orange-600" onClick={() => toggleSort('customer')}>
                  <span className="flex items-center gap-1">Customer <ArrowUpDown size={12} /></span>
                </th>
                <th className="px-5 py-3 text-left">Grade</th>
                <th className="px-5 py-3 text-left cursor-pointer select-none hover:text-orange-600" onClick={() => toggleSort('date')}>
                  <span className="flex items-center gap-1">Order Date <ArrowUpDown size={12} /></span>
                </th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-right">Lines</th>
                <th className="px-5 py-3 text-right">Total Qty</th>
                {activeTab === 'MANUAL' && <th className="px-5 py-3 text-center">Action</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={activeTab === 'MANUAL' ? 9 : 8} className="px-5 py-16 text-center text-gray-400">
                  <div className="flex flex-col items-center gap-2"><Clock className="w-8 h-8 animate-pulse" /><span>Loading orders...</span></div>
                </td></tr>
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan={activeTab === 'MANUAL' ? 9 : 8} className="px-5 py-16 text-center text-gray-400">
                  <div className="flex flex-col items-center gap-2">
                    <TrendingUp className="w-8 h-8" />
                    <span>{activeTab === 'ERP' ? 'No orders found. Sync data from ERP Integration Hub first.' : 'No manual orders found. Click "Add Manual Plan" to create one.'}</span>
                  </div>
                </td></tr>
              ) : filteredOrders.map(o => {
                const lineQty = o.lines.reduce((s, l) => s + Number(l.erpOrderItemQty || 0), 0);
                return (
                  <tr key={o.id} onClick={() => setSelectedOrder(o)}
                    className="border-b border-gray-50 hover:bg-orange-50/40 cursor-pointer transition-colors group">
                    <td className={`px-5 py-3.5 font-semibold transition-colors ${o.isManual ? 'text-blue-700 group-hover:text-blue-600' : 'text-orange-600 group-hover:text-orange-500'}`}>{o.erpOrderNumber}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs">
                      <span className={`px-2 py-0.5 rounded ${o.isManual ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-gray-50 text-gray-600'}`}>{o.erpOrderType}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="max-w-[220px] truncate font-medium text-gray-800" title={o.erpCustomerName}>{o.erpCustomerName}</div>
                      {o.erpCustomerNumber && <div className="text-xs text-gray-400">#{o.erpCustomerNumber}</div>}
                    </td>
                    <td className="px-5 py-3.5"><span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-semibold">{o.erpCustomerGrade || '-'}</span></td>
                    <td className="px-5 py-3.5 text-gray-600">{formatDate(o.erpOrderDate)}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={o.erpOrderStatus} /></td>
                    <td className="px-5 py-3.5 text-right font-medium text-gray-700">{o.lines.length}</td>
                    <td className="px-5 py-3.5 text-right font-bold text-gray-900">{lineQty.toLocaleString()}</td>
                    {activeTab === 'MANUAL' && (
                      <td className="px-5 py-3.5 text-center flex items-center justify-center gap-1">
                        <button onClick={(e) => handleEditClick(e, o)} className="p-2 text-gray-400 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-50">
                          <FileText size={16} />
                        </button>
                        <button onClick={(e) => handleDeleteOrder(e, o.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Manual Order Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
            <div className={`px-6 py-4 border-b border-gray-100 flex items-center justify-between ${editingOrderId ? 'bg-amber-500' : 'bg-blue-600'} text-white`}>
              <h3 className="text-lg font-bold">{editingOrderId ? 'Edit Manual Demand Plan' : 'Add Manual Demand Plan'}</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-white/20 rounded-lg transition-colors"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Header Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Plan Number / ID</label>
                  <input type="text" value={newOrder.erpOrderNumber} onChange={e => setNewOrder({...newOrder, erpOrderNumber: e.target.value})} placeholder="e.g. IVQF-2024-001" className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Plan Type</label>
                  <select value={newOrder.erpOrderType} onChange={e => setNewOrder({...newOrder, erpOrderType: e.target.value})} className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                    <option value="IVQF">IVQF (Internal Forecast)</option>
                    <option value="YTR">YTR (Stock Replenishment)</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Customer / Purpose</label>
                  <input type="text" value={newOrder.erpCustomerName} onChange={e => setNewOrder({...newOrder, erpCustomerName: e.target.value})} placeholder="e.g. Internal Warehouse" className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Plan Date</label>
                  <input type="date" value={newOrder.erpOrderDate} onChange={e => setNewOrder({...newOrder, erpOrderDate: e.target.value})} className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-tight">Demand Items</h4>
                  <button onClick={() => setNewOrder({...newOrder, lines: [...newOrder.lines, { erpOrderItemCode: '', erpOrderItemQty: 0, erpOrderShipDate: new Date().toISOString().split('T')[0] }]})}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                    <Plus size={14} /> Add Line Item
                  </button>
                </div>
                <div className="space-y-2">
                  {newOrder.lines.map((line, idx) => (
                    <div key={idx} className="flex gap-2 items-end bg-gray-50 p-3 rounded-xl border border-gray-100 relative group">
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Item Code</label>
                        <ItemAutocomplete 
                          items={erpItems} 
                          value={line.erpOrderItemCode} 
                          onChange={(val) => {
                            const updated = [...newOrder.lines];
                            updated[idx].erpOrderItemCode = val;
                            setNewOrder({...newOrder, lines: updated});
                          }} 
                        />
                      </div>
                      <div className="w-32 space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Qty (KG)</label>
                        <input type="number" value={line.erpOrderItemQty} onChange={e => {
                          const updated = [...newOrder.lines];
                          updated[idx].erpOrderItemQty = Number(e.target.value);
                          setNewOrder({...newOrder, lines: updated});
                        }} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500" />
                      </div>
                      <div className="w-44 space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Target Date</label>
                        <input type="date" value={line.erpOrderShipDate} onChange={e => {
                          const updated = [...newOrder.lines];
                          updated[idx].erpOrderShipDate = e.target.value;
                          setNewOrder({...newOrder, lines: updated});
                        }} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500" />
                      </div>
                      <button onClick={() => {
                        const updated = newOrder.lines.filter((_, i) => i !== idx);
                        setNewOrder({...newOrder, lines: updated.length ? updated : [{ erpOrderItemCode: '', erpOrderItemQty: 0, erpOrderShipDate: new Date().toISOString().split('T')[0] }]});
                      }} className="p-2 text-gray-400 hover:text-red-500 mb-0.5"><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowAddModal(false)} className="px-6 py-2 rounded-lg text-sm font-bold text-gray-500 hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={handleAddOrder} className="px-8 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-200 transition-all">Save Demand Plan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub Components ───
const ItemAutocomplete = ({ items, value, onChange }: { items: any[], value: string, onChange: (val: string) => void }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  const filtered = useMemo(() => items.filter(item => 
    item.erpItemCode.toLowerCase().includes(search.toLowerCase()) || 
    (item.erpItemDesc || '').toLowerCase().includes(search.toLowerCase())
  ).slice(0, 50), [items, search]);

  const selectedItem = useMemo(() => items.find(i => i.erpItemCode === value), [items, value]);

  return (
    <div className="relative">
      <div 
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white cursor-pointer flex justify-between items-center hover:border-blue-300 transition-colors"
      >
        <span className={value ? 'text-gray-900 font-medium truncate' : 'text-gray-400'}>
          {selectedItem ? `${selectedItem.erpItemCode} - ${selectedItem.erpItemDesc}` : 'Select Item...'}
        </span>
        <Search size={14} className="text-gray-400 shrink-0 ml-2" />
      </div>
      
      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-100 shadow-xl rounded-xl z-[70] max-h-64 overflow-y-auto animate-slide-up">
            <div className="p-2 border-b border-gray-50 sticky top-0 bg-white">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  autoFocus
                  type="text" 
                  placeholder="Search code or name..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border-none rounded-lg text-sm outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>
            <div className="py-1">
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-xs text-gray-400 text-center flex flex-col items-center gap-2">
                  <Package size={24} className="text-gray-200" />
                  No items found
                </div>
              ) : filtered.map(item => (
                <div 
                  key={item.id}
                  onClick={() => {
                    onChange(item.erpItemCode);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0 ${value === item.erpItemCode ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700'}`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-mono">{item.erpItemCode}</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-bold uppercase shrink-0">{item.erpItemType}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">{item.erpItemDesc}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
const StatusBadge = ({ status, large }: { status: string; large?: boolean }) => {
  const map: any = { BOOKED: 'bg-green-100 text-green-700', ENTERED: 'bg-blue-100 text-blue-700', CANCELLED: 'bg-red-100 text-red-700', CLOSED: 'bg-gray-200 text-gray-600' };
  return <span className={`px-2 py-0.5 rounded font-medium ${large ? 'text-sm px-3 py-1' : 'text-xs'} ${map[status] || 'bg-gray-100 text-gray-600'}`}>{status}</span>;
};

const InfoItem = ({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) => (
  <div className="flex items-start gap-3">
    <div className="p-2 bg-gray-50 rounded-lg shrink-0 border border-gray-100"><Icon size={16} className="text-gray-500" /></div>
    <div>
      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{label}</p>
      <p className="text-sm font-bold text-gray-900 mt-0.5">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  </div>
);

const SummaryCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) => {
  const colors: any = { orange: 'from-orange-500 to-red-500', blue: 'from-blue-500 to-indigo-500', emerald: 'from-emerald-500 to-teal-500', purple: 'from-purple-500 to-pink-500' };
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 transition-all hover:shadow-md">
      <div className={`p-2.5 rounded-lg bg-gradient-to-br ${colors[color]} shadow-md`}><Icon size={18} className="text-white" /></div>
      <div>
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
};
