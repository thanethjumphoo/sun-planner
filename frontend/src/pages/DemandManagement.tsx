import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, Search, Filter, ChevronLeft, ArrowUpDown, Package, AlertTriangle, Calendar, Hash, User, FileText, Tag, Clock } from 'lucide-react';

const API = import.meta.env.VITE_API_URL;

interface OrderLine {
  id: number; erpOrderLineId: number; erpOrderHeaderId: number; erpOrderLineNumber: string;
  erpOrderItemId: number; erpOrderItemCode: string; erpOrderItemQty: number; erpOrderItemUom: string;
  erpOrderShipDate: string; erpOrderStatus: string; erpItemDesc: string | null; isItemSynced: boolean;
}
interface OrderHeader {
  id: number; erpOrderHeaderId: number; erpOrgId: number; erpOrderDate: string; erpOrderNumber: string;
  erpOrderType: string; erpCustomerNumber: string; erpCustomerName: string; erpCustomerGrade: string;
  erpOrderStatus: string; lines: OrderLine[];
}

export default function DemandManagement() {
  const [orders, setOrders] = useState<OrderHeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderHeader | null>(null);

  // Filters
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterGrade, setFilterGrade] = useState('ALL');
  const [sortField, setSortField] = useState<'date' | 'customer' | 'number'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/erp/demand-orders`);
      if (res.ok) setOrders(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  // Unique values for filters
  const statuses = useMemo(() => ['ALL', ...new Set(orders.map(o => o.erpOrderStatus).filter(Boolean))], [orders]);
  const grades = useMemo(() => ['ALL', ...new Set(orders.map(o => o.erpCustomerGrade).filter(Boolean))], [orders]);

  // Filtered & sorted orders
  const filteredOrders = useMemo(() => {
    let result = orders.filter(o => {
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
  }, [orders, searchText, filterStatus, filterGrade, sortField, sortDir]);

  const totalQty = useMemo(() => filteredOrders.reduce((sum, o) => sum + o.lines.reduce((s, l) => s + Number(l.erpOrderItemQty || 0), 0), 0), [filteredOrders]);
  const totalLines = useMemo(() => filteredOrders.reduce((sum, o) => sum + o.lines.length, 0), [filteredOrders]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

  // ─── DETAIL VIEW ───
  if (selectedOrder) {
    const o = selectedOrder;
    return (
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        {/* Back Button */}
        <button onClick={() => setSelectedOrder(null)} className="flex items-center gap-2 text-gray-500 hover:text-orange-600 transition-colors text-sm font-medium group">
          <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> Back to Sales Orders
        </button>

        {/* Order Header Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm font-medium">Sales Order</p>
                <h2 className="text-2xl font-bold text-white mt-1">{o.erpOrderNumber}</h2>
              </div>
              <StatusBadge status={o.erpOrderStatus} large />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
            <InfoItem icon={User} label="Customer" value={o.erpCustomerName} sub={`#${o.erpCustomerNumber}`} />
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
          <p className="text-gray-500 text-sm mt-1">Sales Orders synced from Oracle ERP — view, filter, and manage demand.</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-slide-up delay-100">
        <SummaryCard icon={FileText} label="Total Orders" value={filteredOrders.length} color="orange" />
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
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500">
          {statuses.map(s => <option key={s} value={s}>{s === 'ALL' ? 'All Status' : s}</option>)}
        </select>
        <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500">
          {grades.map(g => <option key={g} value={g}>{g === 'ALL' ? 'All Grades' : `Grade ${g}`}</option>)}
        </select>
        <div className="flex items-center gap-1 text-xs text-gray-400"><Filter size={14} /> {filteredOrders.length} of {orders.length}</div>
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
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-5 py-16 text-center text-gray-400">
                  <div className="flex flex-col items-center gap-2"><Clock className="w-8 h-8 animate-pulse" /><span>Loading orders...</span></div>
                </td></tr>
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-16 text-center text-gray-400">
                  <div className="flex flex-col items-center gap-2"><TrendingUp className="w-8 h-8" /><span>No orders found. Sync data from ERP Integration Hub first.</span></div>
                </td></tr>
              ) : filteredOrders.map(o => {
                const lineQty = o.lines.reduce((s, l) => s + Number(l.erpOrderItemQty || 0), 0);
                return (
                  <tr key={o.id} onClick={() => setSelectedOrder(o)}
                    className="border-b border-gray-50 hover:bg-orange-50/40 cursor-pointer transition-colors group">
                    <td className="px-5 py-3.5 font-semibold text-blue-700 group-hover:text-orange-600 transition-colors">{o.erpOrderNumber}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs">{o.erpOrderType}</td>
                    <td className="px-5 py-3.5">
                      <div className="max-w-[220px] truncate font-medium text-gray-800" title={o.erpCustomerName}>{o.erpCustomerName}</div>
                      <div className="text-xs text-gray-400">#{o.erpCustomerNumber}</div>
                    </td>
                    <td className="px-5 py-3.5"><span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-semibold">{o.erpCustomerGrade || '-'}</span></td>
                    <td className="px-5 py-3.5 text-gray-600">{formatDate(o.erpOrderDate)}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={o.erpOrderStatus} /></td>
                    <td className="px-5 py-3.5 text-right font-medium text-gray-700">{o.lines.length}</td>
                    <td className="px-5 py-3.5 text-right font-bold text-gray-900">{lineQty.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Sub Components ───
const StatusBadge = ({ status, large }: { status: string; large?: boolean }) => {
  const map: any = { BOOKED: 'bg-green-100 text-green-700', ENTERED: 'bg-blue-100 text-blue-700', CANCELLED: 'bg-red-100 text-red-700', CLOSED: 'bg-gray-200 text-gray-600' };
  return <span className={`px-2 py-0.5 rounded font-medium ${large ? 'text-sm px-3 py-1' : 'text-xs'} ${map[status] || 'bg-gray-100 text-gray-600'}`}>{status}</span>;
};

const InfoItem = ({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) => (
  <div className="flex items-start gap-3">
    <div className="p-2 bg-orange-50 rounded-lg shrink-0"><Icon size={16} className="text-orange-500" /></div>
    <div>
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className="text-sm font-bold text-gray-900 mt-0.5">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  </div>
);

const SummaryCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) => {
  const colors: any = { orange: 'from-orange-500 to-red-500', blue: 'from-blue-500 to-indigo-500', emerald: 'from-emerald-500 to-teal-500', purple: 'from-purple-500 to-pink-500' };
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
      <div className={`p-2.5 rounded-lg bg-gradient-to-br ${colors[color]} shadow-md`}><Icon size={18} className="text-white" /></div>
      <div>
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
};
