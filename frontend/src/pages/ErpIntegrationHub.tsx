import React, { useState, useEffect, useMemo } from 'react';
import { 
  RefreshCw, XOctagon, AlertTriangle, CheckCircle2, Clock, 
  FileText, Users, Package, ServerCrash, ChevronDown, ChevronRight, Loader2,
  Search, ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API = import.meta.env.VITE_API_URL;

const ErpIntegrationHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState('orders');
  const [itemCodes, setItemCodes] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [isSyncing, setIsSyncing] = useState('');
  
  // Order data
  const [orderHeaders, setOrderHeaders] = useState<any[]>([]);
  const [orderLines, setOrderLines] = useState<any[]>([]);
  const [expandedHeader, setExpandedHeader] = useState<number | null>(null);
  const [syncResult, setSyncResult] = useState<{type: string, count: number, time: string} | null>(null);

  // Pagination & Search States for Orders
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Pagination & Search States for Items
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [itemCurrentPage, setItemCurrentPage] = useState(1);
  const itemsPerPageItemTab = 15;

  useEffect(() => { fetchTargetItems(); }, []);
  useEffect(() => { if (activeTab === 'orders') { fetchOrderHeaders(); fetchOrderLines(); } }, [activeTab]);

  // Reset page numbers when search queries change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  useEffect(() => {
    setItemCurrentPage(1);
  }, [itemSearchQuery]);

  // ─── Item Sync ───
  const fetchTargetItems = async () => {
    try { const res = await fetch(`${API}/api/erp/target-items`); if (res.ok) setItemCodes(await res.json()); } catch (err) { console.error(err); }
  };
  const handleBulkAdd = async () => {
    const codes = bulkInput.split(/[\n, ]+/).map(c => c.trim()).filter(c => c);
    if (codes.length > 0) {
      await fetch(`${API}/api/erp/target-items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemCodes: codes }) });
      await fetchTargetItems();
    }
    setBulkInput(''); setIsModalOpen(false);
  };
  const handleRemoveCode = async (code: string) => {
    await fetch(`${API}/api/erp/target-items/${code}`, { method: 'DELETE' }); await fetchTargetItems();
  };
  const handleSyncItems = async () => {
    setIsSyncing('items');
    try {
      const res = await fetch(`${API}/api/erp/sync-items`, { method: 'POST' });
      if (res.ok) { const d = await res.json(); setSyncResult({ type: 'Items', count: d.count, time: new Date().toLocaleTimeString() }); await fetchTargetItems(); }
    } catch { alert('Item sync failed'); } finally { setIsSyncing(''); }
  };

  // ─── Order Sync ───
  const fetchOrderHeaders = async () => {
    try { const res = await fetch(`${API}/api/erp/order-headers`); if (res.ok) setOrderHeaders(await res.json()); } catch (err) { console.error(err); }
  };
  const fetchOrderLines = async () => {
    try { const res = await fetch(`${API}/api/erp/order-lines`); if (res.ok) setOrderLines(await res.json()); } catch (err) { console.error(err); }
  };
  const handleSyncHeaders = async () => {
    setIsSyncing('headers');
    try {
      const res = await fetch(`${API}/api/erp/sync-order-headers`, { method: 'POST' });
      if (res.ok) { const d = await res.json(); setSyncResult({ type: 'Order Headers', count: d.count, time: new Date().toLocaleTimeString() }); await fetchOrderHeaders(); }
    } catch { alert('Header sync failed'); } finally { setIsSyncing(''); }
  };
  const handleSyncLines = async () => {
    setIsSyncing('lines');
    try {
      const res = await fetch(`${API}/api/erp/sync-order-lines`, { method: 'POST' });
      if (res.ok) { const d = await res.json(); setSyncResult({ type: 'Order Lines', count: d.count, time: new Date().toLocaleTimeString() }); await fetchOrderLines(); }
    } catch { alert('Line sync failed'); } finally { setIsSyncing(''); }
  };
  const handleSyncAll = async () => {
    setIsSyncing('all');
    try {
      const r1 = await fetch(`${API}/api/erp/sync-order-headers`, { method: 'POST' });
      const d1 = r1.ok ? await r1.json() : { count: 0 };
      await fetchOrderHeaders();
      const r2 = await fetch(`${API}/api/erp/sync-order-lines`, { method: 'POST' });
      const d2 = r2.ok ? await r2.json() : { count: 0 };
      await fetchOrderLines();
      setSyncResult({ type: 'Orders (H+L)', count: d1.count + d2.count, time: new Date().toLocaleTimeString() });
    } catch { alert('Full sync failed'); } finally { setIsSyncing(''); }
  };

  const getLinesForHeader = (headerId: number) => orderLines.filter(l => l.erpOrderHeaderId === headerId);

  // Filter and Paginate Orders
  const filteredHeaders = useMemo(() => {
    if (!searchQuery) return orderHeaders;
    const q = searchQuery.toLowerCase();
    return orderHeaders.filter(h => 
      (h.erpOrderNumber && h.erpOrderNumber.toLowerCase().includes(q)) ||
      (h.erpOrderType && h.erpOrderType.toLowerCase().includes(q)) ||
      (h.erpCustomerName && h.erpCustomerName.toLowerCase().includes(q))
    );
  }, [orderHeaders, searchQuery]);

  const totalPages = Math.ceil(filteredHeaders.length / itemsPerPage);

  const paginatedHeaders = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredHeaders.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredHeaders, currentPage]);

  // Filter and Paginate Items
  const filteredItemCodes = useMemo(() => {
    if (!itemSearchQuery) return itemCodes;
    const q = itemSearchQuery.toLowerCase();
    return itemCodes.filter(item => 
      item.itemCode && item.itemCode.toLowerCase().includes(q)
    );
  }, [itemCodes, itemSearchQuery]);

  const itemTotalPages = Math.ceil(filteredItemCodes.length / itemsPerPageItemTab);

  const paginatedItemCodes = useMemo(() => {
    const startIndex = (itemCurrentPage - 1) * itemsPerPageItemTab;
    return filteredItemCodes.slice(startIndex, startIndex + itemsPerPageItemTab);
  }, [filteredItemCodes, itemCurrentPage]);

  const tabs = [
    { id: 'orders', label: 'Orders Sync', icon: FileText },
    { id: 'items', label: 'Item Sync', icon: Package },
    { id: 'manual', label: 'Manual Re-sync', icon: RefreshCw },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">ERP Integration Hub</h1>
          <p className="text-gray-500 mt-1">Manage and monitor data synchronization between Oracle ERP and Sun Planner.</p>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatusCard title="Order Headers" status={orderHeaders.length > 0 ? 'Synced' : 'Empty'} count={`${orderHeaders.length} records`} icon={FileText} color={orderHeaders.length > 0 ? 'green' : 'yellow'} />
        <StatusCard title="Order Lines" status={orderLines.length > 0 ? 'Synced' : 'Empty'} count={`${orderLines.length} records`} icon={Package} color={orderLines.length > 0 ? 'green' : 'yellow'} />
        <StatusCard title="Item Codes" status={itemCodes.length > 0 ? 'Active' : 'Empty'} count={`${itemCodes.length} items`} icon={Users} color={itemCodes.length > 0 ? 'green' : 'yellow'} />
        <StatusCard title="Last Sync" status={syncResult ? 'Success' : 'N/A'} count={syncResult ? `${syncResult.count} at ${syncResult.time}` : 'No sync yet'} icon={ServerCrash} color={syncResult ? 'green' : 'yellow'} />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex overflow-x-auto border-b border-gray-200 bg-gray-50/50">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                <Icon className="w-4 h-4" />{tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {/* ═══ ORDERS TAB ═══ */}
          {activeTab === 'orders' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <SyncButton label="Sync All (Headers + Lines)" loading={isSyncing === 'all'} onClick={handleSyncAll} variant="primary" />
                <SyncButton label="Sync Headers Only" loading={isSyncing === 'headers'} onClick={handleSyncHeaders} variant="secondary" />
                <SyncButton label="Sync Lines Only" loading={isSyncing === 'lines'} onClick={handleSyncLines} variant="secondary" />
              </div>

              {/* Search Bar */}
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200/50">
                <div className="relative w-full md:max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="ค้นหา Order Number, Type หรือ Customer..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-white transition-all font-semibold"
                  />
                </div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  พบ {filteredHeaders.length} จาก {orderHeaders.length} รายการ
                </div>
              </div>

              {/* Order Headers + Lines Table */}
              <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 w-10"></th>
                      <th className="px-4 py-3">Order Number</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Grade</th>
                      <th className="px-4 py-3">Order Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Lines</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedHeaders.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">No order headers found. Click "Sync All" to import or check search query.</td></tr>
                    ) : paginatedHeaders.map((h) => {
                      const lines = getLinesForHeader(h.erpOrderHeaderId);
                      const isExpanded = expandedHeader === h.erpOrderHeaderId;
                      return (
                        <React.Fragment key={h.id}>
                          <tr className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedHeader(isExpanded ? null : h.erpOrderHeaderId)}>
                            <td className="px-4 py-3">{isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}</td>
                            <td className="px-4 py-3 font-medium text-blue-600">{h.erpOrderNumber}</td>
                            <td className="px-4 py-3 text-gray-600">{h.erpOrderType}</td>
                            <td className="px-4 py-3 text-gray-800 max-w-[200px] truncate" title={h.erpCustomerName}>{h.erpCustomerName}</td>
                            <td className="px-4 py-3"><span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">{h.erpCustomerGrade || '-'}</span></td>
                            <td className="px-4 py-3 text-gray-600">{h.erpOrderDate ? new Date(h.erpOrderDate).toLocaleDateString('th-TH') : '-'}</td>
                            <td className="px-4 py-3"><StatusBadge status={h.erpOrderStatus} /></td>
                            <td className="px-4 py-3 text-right font-medium text-gray-700">{lines.length}</td>
                          </tr>
                          {isExpanded && lines.length > 0 && (
                            <tr><td colSpan={8} className="p-0">
                              <div className="bg-blue-50/50 border-t border-b border-blue-100 px-8 py-3">
                                <table className="w-full text-xs">
                                  <thead><tr className="text-gray-500 uppercase">
                                    <th className="py-2 text-left">Line#</th><th className="py-2 text-left">Item Code</th><th className="py-2 text-right">Qty</th><th className="py-2 text-left pl-2">UOM</th><th className="py-2 text-left">Ship Date</th><th className="py-2 text-left">Status</th>
                                  </tr></thead>
                                  <tbody>{lines.map(l => (
                                    <tr key={l.id} className="border-t border-blue-100/50 hover:bg-blue-50">
                                      <td className="py-2 font-medium text-gray-700">{l.erpOrderLineNumber}</td>
                                      <td className="py-2 font-medium text-blue-700">{l.erpOrderItemCode}</td>
                                      <td className="py-2 text-right font-semibold text-gray-800">{Number(l.erpOrderItemQty).toLocaleString()}</td>
                                      <td className="py-2 pl-2 text-gray-500">{l.erpOrderItemUom}</td>
                                      <td className="py-2 text-gray-600">{l.erpOrderShipDate ? new Date(l.erpOrderShipDate).toLocaleDateString('th-TH') : '-'}</td>
                                      <td className="py-2"><StatusBadge status={l.erpOrderStatus} /></td>
                                    </tr>
                                  ))}</tbody>
                                </table>
                              </div>
                            </td></tr>
                          )}
                          {isExpanded && lines.length === 0 && (
                            <tr><td colSpan={8} className="px-8 py-4 text-center text-gray-400 text-xs bg-gray-50">No lines for this order. Click "Sync Lines Only" to import.</td></tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={filteredHeaders.length}
                itemsPerPage={itemsPerPage}
              />
            </motion.div>
          )}

          {/* ═══ ITEMS TAB ═══ */}
          {activeTab === 'items' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="flex justify-between items-center">
                <div><h3 className="text-lg font-semibold text-gray-900">Item Sync (Manual)</h3><p className="text-sm text-gray-500">ดึงข้อมูล Master Item จาก Oracle ERP (Organization 82)</p></div>
                <div className="flex gap-3">
                  <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg shadow-sm text-sm font-medium">Manage Item Codes</button>
                  <SyncButton label="Sync All Items" loading={isSyncing === 'items'} onClick={handleSyncItems} variant="primary" />
                </div>
              </div>

              {/* Search Bar for Items */}
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200/50">
                <div className="relative w-full md:max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="ค้นหา Item Code..."
                    value={itemSearchQuery}
                    onChange={e => setItemSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-white transition-all font-semibold"
                  />
                </div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  พบ {filteredItemCodes.length} จาก {itemCodes.length} รายการ
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                <table className="w-full text-sm text-left text-gray-500">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50"><tr><th className="px-4 py-3 w-16">No.</th><th className="px-4 py-3">Item Code (SEGMENT1)</th><th className="px-4 py-3">Sync Status</th><th className="px-4 py-3">Last Sync</th><th className="px-4 py-3 text-right">Action</th></tr></thead>
                  <tbody>
                    {paginatedItemCodes.length === 0 ? (<tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No Item Codes found matching search criteria.</td></tr>
                    ) : paginatedItemCodes.map((item, i) => (
                      <tr key={item.itemCode} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{((itemCurrentPage - 1) * itemsPerPageItemTab) + i + 1}</td>
                        <td className="px-4 py-3 font-medium text-blue-600">{item.itemCode}</td>
                        <td className="px-4 py-3">
                          {item.lastSyncStatus === 'SUCCESS' ? (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium flex items-center gap-1 w-fit"><CheckCircle2 className="w-3 h-3"/> Success</span>
                          ) : item.lastSyncStatus === 'FAILED' ? (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium flex items-center gap-1 w-fit"><XOctagon className="w-3 h-3"/> Failed</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">Pending</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{item.lastSyncDate ? new Date(item.lastSyncDate).toLocaleString('th-TH') : '-'}</td>
                        <td className="px-4 py-3 text-right"><button onClick={() => handleRemoveCode(item.itemCode)} className="text-red-500 hover:text-red-700 text-sm font-medium">Remove</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls for Items */}
              <PaginationControls
                currentPage={itemCurrentPage}
                totalPages={itemTotalPages}
                onPageChange={setItemCurrentPage}
                totalItems={filteredItemCodes.length}
                itemsPerPage={itemsPerPageItemTab}
              />
            </motion.div>
          )}

          {/* ═══ MANUAL TAB ═══ */}
          {activeTab === 'manual' && (
            <div className="text-center py-12 text-gray-500"><RefreshCw className="w-12 h-12 mx-auto text-gray-300 mb-4" /><p>Manual Re-sync configuration will appear here.</p></div>
          )}
        </div>
      </div>

      {/* ═══ MODAL ═══ */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-900">Add Item Codes</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700"><XOctagon className="w-5 h-5" /></button>
              </div>
              <div className="p-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">Paste multiple Item Codes (separated by comma, space, or new lines)</label>
                <textarea rows={6} value={bulkInput} onChange={(e) => setBulkInput(e.target.value)} placeholder={"111145102\n111145103\n111145104"}
                  className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3" />
              </div>
              <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={handleBulkAdd} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">Add Codes</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Sub Components ───

const StatusCard = ({ title, status, count, icon: Icon, color }: any) => {
  const colors: any = { green: 'bg-green-100 text-green-700', red: 'bg-red-100 text-red-700', yellow: 'bg-yellow-100 text-yellow-700' };
  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <div className="flex items-center gap-2 mt-2">
          {status === 'Synced' || status === 'Active' || status === 'Success' ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <AlertTriangle className="w-5 h-5 text-yellow-500" />}
          <span className="text-lg font-bold text-gray-900">{status}</span>
        </div>
        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><Clock className="w-3 h-3" /> {count}</p>
      </div>
      <div className={`p-3 rounded-lg ${colors[color] || colors.yellow}`}><Icon className="w-5 h-5" /></div>
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const map: any = { BOOKED: 'bg-green-100 text-green-700', ENTERED: 'bg-blue-100 text-blue-700', CANCELLED: 'bg-red-100 text-red-700' };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>{status}</span>;
};

const SyncButton = ({ label, loading, onClick, variant }: { label: string; loading: boolean; onClick: () => void; variant: 'primary' | 'secondary' }) => (
  <button onClick={onClick} disabled={loading}
    className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-sm text-sm font-medium transition-colors ${
      variant === 'primary' ? (loading ? 'bg-blue-400 cursor-not-allowed text-white' : 'bg-blue-600 hover:bg-blue-700 text-white')
      : (loading ? 'bg-gray-100 cursor-not-allowed text-gray-400' : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300')}`}>
    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}{label}
  </button>
);

const PaginationControls = ({ currentPage, totalPages, onPageChange, totalItems, itemsPerPage }: any) => {
  if (totalPages <= 1) return null;
  return (
    <div className="bg-white px-6 py-4 border-t border-gray-100 flex items-center justify-between rounded-b-xl mt-4">
      <div className="text-sm text-gray-500">
        แสดง <span className="font-semibold text-gray-900">{((currentPage - 1) * itemsPerPage) + 1}</span> ถึง{' '}
        <span className="font-semibold text-gray-900">{Math.min(currentPage * itemsPerPage, totalItems)}</span> จาก{' '}
        <span className="font-semibold text-gray-900">{totalItems}</span> รายการ
      </div>
      <div className="flex items-center gap-1">
        <button
          disabled={currentPage === 1}
          onClick={() => onPageChange(1)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white text-xs font-semibold transition-colors"
        >
          First
        </button>
        <button
          disabled={currentPage === 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white text-xs font-semibold transition-colors flex items-center gap-1"
        >
          <ChevronLeft size={14} /> ก่อนหน้า
        </button>
        
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let pageNum = currentPage;
          if (currentPage <= 3) pageNum = i + 1;
          else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
          else pageNum = currentPage - 2 + i;
          
          if (pageNum < 1 || pageNum > totalPages) return null;
          
          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                currentPage === pageNum
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-100'
                  : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {pageNum}
            </button>
          );
        })}
        
        <button
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white text-xs font-semibold transition-colors flex items-center gap-1"
        >
          ถัดไป <ChevronRight size={14} />
        </button>
        <button
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(totalPages)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white text-xs font-semibold transition-colors"
        >
          Last
        </button>
      </div>
    </div>
  );
};

export default ErpIntegrationHub;
