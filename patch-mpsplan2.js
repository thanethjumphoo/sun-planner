const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/pages/MPSPlan.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// We will replace the IIFE inside the Demand by Size block
const startMarker = '{/* Demand by Size Summary — expandable */}';
const endMarker = '{/* Co-Product Orders Table */}';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error("Markers not found");
  process.exit(1);
}

const before = content.substring(0, startIndex);
const after = content.substring(endIndex);

const newBlock = `                          {/* Demand by Size Summary — expandable */}
                          {(() => {
                            const extDaily = externalRmSupplies.find(s => String(s.receivedDate).startsWith(selectedDate));
                            let extSizes: Record<string, number> = {};
                            if (extDaily && extDaily.sizeBreakdownJson) {
                              try { extSizes = JSON.parse(extDaily.sizeBreakdownJson); } catch (e) {}
                            }
                            
                            const globalBlSizesFrontend = (selectedSupply as any)._blSizesFrontend || {};
                            
                            const renderDemandBySize = (title: string, mode: 'bil' | 'bl' | 'fillet', targetOrders: any[]) => {
                              const allSupplySizesSet = new Set<string>();
                              if (mode === 'bl') {
                                Object.keys(globalBlSizesFrontend).forEach(k => allSupplySizesSet.add(k));
                              } else {
                                currentPlan?.supplyBreakdown?.forEach((s: any) => {
                                  if (s.sizes) s.sizes.forEach((sz: any) => { if (sz.groupSize) allSupplySizesSet.add(sz.groupSize); });
                                });
                                Object.keys(extSizes).forEach(k => allSupplySizesSet.add(k));
                              }
                              
                              const allSupplySizes = Array.from(allSupplySizesSet).sort((a, b) => {
                                if (a.toLowerCase().includes('down') && !b.toLowerCase().includes('down')) return -1;
                                if (!a.toLowerCase().includes('down') && b.toLowerCase().includes('down')) return 1;
                                return a.localeCompare(b, undefined, { numeric: true });
                              });

                              const bilBinDefs = [
                                { key: '180 DOWN', lo: 0, hi: 180 },
                                { key: '210-230', lo: 210, hi: 230 },
                                { key: '230-260', lo: 230, hi: 260 },
                                { key: '260-280', lo: 260, hi: 280 },
                                { key: '280-310', lo: 280, hi: 310 },
                                { key: '310-330', lo: 310, hi: 330 },
                                { key: '330-360', lo: 330, hi: 360 },
                                { key: '360-390', lo: 360, hi: 390 },
                                { key: '390-410', lo: 390, hi: 410 },
                                { key: '410-440', lo: 410, hi: 440 },
                                { key: '440-460', lo: 440, hi: 460 },
                                { key: '460-490', lo: 460, hi: 490 },
                                { key: '490-510', lo: 490, hi: 510 },
                                { key: '510-540', lo: 510, hi: 540 },
                                { key: '540 UP', lo: 540, hi: 9999 },
                              ];

                              const blBinDefs = Object.keys(globalBlSizesFrontend).map(k => {
                                let lo = -1, hi = -1;
                                if (k.toLowerCase().includes('down')) {
                                  const m = k.match(/(\\d+)/);
                                  if (m) { lo = 0; hi = parseInt(m[1], 10); }
                                } else if (k.toLowerCase().includes('up')) {
                                  const m = k.match(/(\\d+)/);
                                  if (m) { lo = parseInt(m[1], 10); hi = 9999; }
                                } else {
                                  const m = k.match(/(\\d+)\\s*[-–]\\s*(\\d+)/);
                                  if (m) { lo = parseInt(m[1], 10); hi = parseInt(m[2], 10); }
                                }
                                return { key: k, lo, hi };
                              });

                              const orderSizes: string[] = [];
                              if (mode !== 'fillet') {
                                targetOrders.forEach((o: any) => {
                                  const spec = specs[o.itemCode];
                                  const s = (spec?.productSize || 'unsize').toLowerCase().trim();
                                  if (s !== 'unsize' && s !== '') {
                                    const exactMatch = allSupplySizes.find(sz => sz.toLowerCase().replace(/\\s+/g, '') === s.replace(/\\s+/g, ''));
                                    if (exactMatch) {
                                      orderSizes.push(exactMatch);
                                    } else {
                                      let lo = -1, hi = -1;
                                      if (s.includes('down')) {
                                        const m = s.match(/(\\d+)/);
                                        if (m) { lo = 0; hi = parseInt(m[1], 10); }
                                      } else if (s.includes('up')) {
                                        const m = s.match(/(\\d+)/);
                                        if (m) { lo = parseInt(m[1], 10); hi = 9999; }
                                      } else {
                                        const m = s.match(/(\\d+)\\s*[-–]\\s*(\\d+)/);
                                        if (m) { lo = parseInt(m[1], 10); hi = parseInt(m[2], 10); }
                                      }
                                      if (lo >= 0 && hi >= 0 && hi > lo) {
                                        orderSizes.push(s);
                                      }
                                    }
                                  }
                                });
                              }

                              const uniqueSizes = Array.from(new Set([...allSupplySizes, ...orderSizes]));
                              const sizeLabels = mode !== 'fillet'
                                ? uniqueSizes.map((label, idx) => ({
                                  key: label,
                                  label,
                                  groupSize: label,
                                  color: \`bg-\${['slate', 'blue', 'cyan', 'emerald', 'green', 'amber', 'orange', 'red'][idx % 8]}-500\`
                                }))
                                : [
                                  { key: '40Down', label: '40 Down', groupSize: '40 Down', color: 'bg-slate-500' },
                                  { key: '40_45', label: '40-45', groupSize: '40-45', color: 'bg-blue-500' },
                                  { key: '45_50', label: '45-50', groupSize: '45-50', color: 'bg-cyan-500' },
                                  { key: '50_55', label: '50-55', groupSize: '50-55', color: 'bg-emerald-500' },
                                  { key: '55_60', label: '55-60', groupSize: '55-60', color: 'bg-green-500' },
                                  { key: '60_65', label: '60-65', groupSize: '60-65', color: 'bg-amber-500' },
                                  { key: '65_70', label: '65-70', groupSize: '65-70', color: 'bg-orange-500' },
                                  { key: '70Up', label: '70 Up', groupSize: '70 Up', color: 'bg-red-500' },
                                ];

                              const getSupplySizeKg = (groupSize: string): number => {
                                if (mode === 'bl') {
                                  return globalBlSizesFrontend[groupSize]?.totalVal || 0;
                                }
                                return (selectedSupply.sizes || []).filter((sz: any) => sz.groupSize === groupSize).reduce((sum: number, sz: any) => sum + Number(sz.quantityKg || 0), 0) + (extSizes[groupSize] || 0);
                              };

                              const allBinDefs = [
                                { key: '40Down', lo: 0, hi: 40 },
                                { key: '40_45', lo: 40, hi: 45 },
                                { key: '45_50', lo: 45, hi: 50 },
                                { key: '50_55', lo: 50, hi: 55 },
                                { key: '55_60', lo: 55, hi: 60 },
                                { key: '60_65', lo: 60, hi: 65 },
                                { key: '65_70', lo: 65, hi: 70 },
                                { key: '70Up', lo: 70, hi: 999 },
                              ];

                              const getSizeBinKeys = (productSize: string): string[] => {
                                if (!productSize) return [];
                                const s = productSize.toLowerCase().trim();
                                if (s === 'unsize' || s === '') return [];

                                if (mode !== 'fillet') {
                                  const match = sizeLabels.find(sl => sl.label.toLowerCase() === s);
                                  if (match) return [match.key];

                                  let lo = -1, hi = -1;
                                  if (s.includes('down')) {
                                    const m = s.match(/(\\d+)/);
                                    if (m) { lo = 0; hi = parseInt(m[1], 10); }
                                  } else if (s.includes('up')) {
                                    const m = s.match(/(\\d+)/);
                                    if (m) { lo = parseInt(m[1], 10); hi = 9999; }
                                  } else {
                                    const m = s.match(/(\\d+)\\s*[-–]\\s*(\\d+)/);
                                    if (m) { 
                                      lo = parseInt(m[1], 10); 
                                      hi = parseInt(m[2], 10); 
                                    } else {
                                      const singleMatch = s.match(/^(\\d+)$/);
                                      if (singleMatch) {
                                        lo = parseInt(singleMatch[1], 10);
                                        hi = parseInt(singleMatch[1], 10);
                                      }
                                    }
                                  }

                                  if (lo >= 0 && hi >= 0 && hi >= lo) {
                                    const activeBinDefs = mode === 'bl' ? blBinDefs : bilBinDefs;
                                    const overlaps = activeBinDefs.filter(b => {
                                      if (lo === hi) return lo >= b.lo && hi <= b.hi;
                                      return Math.max(lo, b.lo) < Math.min(hi, b.hi);
                                    });
                                    if (overlaps.length > 0) return overlaps.map(b => b.key);
                                  }
                                  return [];
                                }

                                if (s.includes('40 down') || s === '40down') return ['40Down'];
                                if (s.includes('70 up') || s === '70up' || s.includes('60 up') || s === '60up') return ['60_65', '65_70', '70Up'];
                                const rangeMatch = s.match(/(\\d+)\\s*[-–]\\s*(\\d+)/);
                                if (rangeMatch) {
                                  const lo = parseInt(rangeMatch[1]);
                                  const hi = parseInt(rangeMatch[2]);
                                  return allBinDefs.filter(b => b.hi > lo && b.lo < hi).map(b => b.key);
                                }
                                return [];
                              };

                              const demandByBin: Record<string, number> = {};
                              const ordersByBin: Record<string, { soNumber: string; itemCode: string; size: string; qty: number; type: string }[]> = {};
                              sizeLabels.forEach(sl => { demandByBin[sl.key] = 0; ordersByBin[sl.key] = []; });

                              const supplyRemaining: Record<string, number> = {};
                              sizeLabels.forEach(sl => { supplyRemaining[sl.key] = getSupplySizeKg(sl.groupSize); });

                              const sizedOrders: any[] = [];
                              const unsizedOrders: any[] = [];
                              targetOrders.forEach((o: any) => {
                                const spec = specs[o.itemCode];
                                const size = spec?.productSize || 'unsize';
                                const binKeys = getSizeBinKeys(size);
                                if (binKeys.length > 0) {
                                  sizedOrders.push({ ...o, size, binKeys });
                                } else {
                                  unsizedOrders.push({ ...o, size: 'unsize' });
                                }
                              });

                              sizedOrders.forEach(o => {
                                let remainingQty = o.qty;
                                for (const key of o.binKeys) {
                                  if (remainingQty <= 0) break;
                                  const avail = Math.max(0, supplyRemaining[key] || 0);
                                  if (avail > 0) {
                                    const alloc = Math.min(avail, remainingQty);
                                    if (!ordersByBin[key]) ordersByBin[key] = [];
                                    demandByBin[key] = (demandByBin[key] || 0) + alloc;
                                    supplyRemaining[key] -= alloc;
                                    remainingQty -= alloc;
                                    ordersByBin[key].push({ soNumber: o.soNumber, itemCode: o.itemCode, size: o.size, qty: alloc, type: o.type });
                                  }
                                }
                              });

                              unsizedOrders.forEach(o => {
                                let remainingQty = o.qty;
                                for (const sl of sizeLabels) {
                                  if (remainingQty <= 0) break;
                                  const avail = Math.max(0, supplyRemaining[sl.key] || 0);
                                  if (avail <= 0) continue;
                                  const allocQty = Math.min(avail, remainingQty);
                                  demandByBin[sl.key] = (demandByBin[sl.key] || 0) + allocQty;
                                  supplyRemaining[sl.key] -= allocQty;
                                  remainingQty -= allocQty;
                                  ordersByBin[sl.key].push({ soNumber: o.soNumber, itemCode: o.itemCode, size: 'unsize', qty: allocQty, type: o.type });
                                }
                              });

                              return (
                                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 space-y-3 mt-4">
                                  <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">{title}</p>
                                  <div className="space-y-1">
                                    {sizeLabels.map(sl => {
                                      const supply = getSupplySizeKg(sl.groupSize);
                                      const demand = demandByBin[sl.key] || 0;
                                      if (supply === 0 && demand === 0) return null;
                                      const remaining = supply - demand;
                                      const isExpanded = expandedSizeBins[sl.key] || false;
                                      const orders = ordersByBin[sl.key] || [];

                                      return (
                                        <div key={sl.key}>
                                          <div
                                            className="bg-white rounded-lg p-2.5 border border-orange-100 flex items-center gap-3 cursor-pointer hover:bg-orange-50/50 transition-colors"
                                            onClick={() => setExpandedSizeBins(prev => ({ ...prev, [sl.key]: !prev[sl.key] }))}
                                          >
                                            <div className={\`w-2 h-8 rounded-full \${sl.color}\`} />
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-gray-500 uppercase">{sl.label}</span>
                                                {orders.length > 0 && (
                                                  <span className="text-[9px] text-gray-400">
                                                    {isExpanded ? '▲' : '▼'} {orders.length} orders
                                                  </span>
                                                )}
                                              </div>
                                              <div className="flex gap-4 text-xs mt-0.5 items-center">
                                                <span className="text-emerald-600">Supply: <b>{Math.round(supply).toLocaleString()}</b></span>
                                                <span className="text-orange-600">Demand: <b>{Math.round(demand).toLocaleString()}</b></span>
                                                <span className={remaining >= 0 ? 'text-blue-600' : 'text-red-600 font-bold'}>
                                                  {remaining >= 0 ? 'Rem' : 'Short'}: <b>{Math.round(Math.abs(remaining)).toLocaleString()}</b>
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                          {isExpanded && orders.length > 0 && (
                                            <div className="ml-5 mt-1 mb-2 border-l-2 border-orange-200 pl-3 space-y-1">
                                              {orders.map((ord: any, idx: number) => (
                                                <div key={idx} className="flex items-center gap-2 text-[11px] py-1 px-2 bg-white/80 rounded border border-gray-100">
                                                  <span className={\`px-1.5 py-0.5 rounded text-[9px] font-bold \${ord.type === 'chilled' ? 'bg-orange-100 text-orange-700' : 'bg-cyan-100 text-cyan-700'}\`}>
                                                    {ord.type === 'chilled' ? 'C' : 'F'}
                                                  </span>
                                                  <span className="font-bold text-gray-700">{ord.soNumber}</span>
                                                  <span className="text-gray-400 text-[10px]">{ord.itemCode}</span>
                                                  <span className="text-gray-400 text-[10px]">({ord.size})</span>
                                                  <span className="ml-auto font-bold text-gray-900">{Math.round(ord.qty).toLocaleString()} kg</span>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            };

                            const isBlItemDesc = (desc: string) => {
                              const d = desc.toUpperCase();
                              return d.includes('BL ') || d.includes('BLK') || d.includes('BL-') || d.startsWith('BL');
                            };

                            const filteredOrders = partId === 'leg' 
                                ? mainOrders 
                                : mainOrders.filter((o: any) => allowedItemCodes.includes(o.itemCode));

                            if (partId === 'leg') {
                              const bilOrders = mainOrders.filter(o => !isBlItemDesc(specs[o.itemCode]?.erpItemDesc || ''));
                              const blOrders = mainOrders.filter(o => isBlItemDesc(specs[o.itemCode]?.erpItemDesc || ''));
                              return (
                                <>
                                  {bilOrders.length > 0 && renderDemandBySize('Demand by RM Size (BIL)', 'bil', bilOrders)}
                                  {blOrders.length > 0 && renderDemandBySize('Demand by RM Size (BL)', 'bl', blOrders)}
                                </>
                              );
                            } else if (partId === 'bl') {
                              return renderDemandBySize('Demand by RM Size', 'bl', filteredOrders);
                            } else if (partId === 'bil') {
                              return renderDemandBySize('Demand by RM Size', 'bil', filteredOrders);
                            } else {
                              return renderDemandBySize('Demand by RM Size', 'fillet', filteredOrders);
                            }
                          })()}

`;

fs.writeFileSync(filePath, before + newBlock + after);
console.log('Successfully patched MPSPlan.tsx');
