const sizeLabels = [
  { key: '180 DOWN', label: '180 DOWN', groupSize: '180 DOWN' },
  { key: '210-230', label: '210-230', groupSize: '210-230' },
  { key: '230-260', label: '230-260', groupSize: '230-260' },
];

const getSupplySizeKg = (groupSize) => {
  if (groupSize === '180 DOWN') return 2843;
  if (groupSize === '210-230') return 689;
  if (groupSize === '230-260') return 6203;
  return 0;
};

const targetOrders = [
  { itemCode: '111111140', qty: 24, soNumber: 'SO-1', type: 'test' }
];

const specs = {
  '111111140': { productSize: '230-260' }
};

const bilBinDefs = [
  { key: '180 DOWN', lo: 0, hi: 180 },
  { key: '210-230', lo: 210, hi: 230 },
  { key: '230-260', lo: 230, hi: 260 },
];

const mode = 'bil';

const getSizeBinKeys = (productSize) => {
  if (!productSize) return [];
  const s = productSize.toLowerCase().trim();
  if (s === 'unsize' || s === '') return [];

  if (mode !== 'fillet') {
    const match = sizeLabels.find(sl => sl.label.toLowerCase() === s);
    if (match) return [match.key];

    let lo = -1, hi = -1;
    if (s.includes('down')) {
      const m = s.match(/(\d+)/);
      if (m) { lo = 0; hi = parseInt(m[1], 10); }
    } else if (s.includes('up')) {
      const m = s.match(/(\d+)/);
      if (m) { lo = parseInt(m[1], 10); hi = 9999; }
    } else {
      const m = s.match(/(\d+)\s*[-–]\s*(\d+)/);
      if (m) { lo = parseInt(m[1], 10); hi = parseInt(m[2], 10); }
      else {
        const singleMatch = s.match(/^(\d+)$/);
        if (singleMatch) { lo = parseInt(singleMatch[1], 10); hi = lo; }
      }
    }

    if (lo >= 0 && hi >= 0 && hi >= lo) {
      const activeBinDefs = bilBinDefs;
      const overlaps = activeBinDefs.filter(b => {
        if (lo === hi) return lo >= b.lo && hi <= b.hi;
        return Math.max(lo, b.lo) < Math.min(hi, b.hi);
      });
      if (overlaps.length > 0) return overlaps.map(b => b.key);
    }
    return [];
  }
  return [];
};

const demandByBin = {};
const ordersByBin = {};
const supplyRemaining = {};

sizeLabels.forEach(sl => {
  demandByBin[sl.key] = 0;
  ordersByBin[sl.key] = [];
  supplyRemaining[sl.key] = getSupplySizeKg(sl.groupSize);
});

const sizedOrders = [];
const unsizedOrders = [];

targetOrders.forEach((o) => {
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
  let remainingQty = Number(o.qty || 0);
  if (isNaN(remainingQty)) remainingQty = 0;
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
  if (remainingQty > 0) {
    unsizedOrders.push({ ...o, qty: remainingQty, size: 'unsize' });
  }
});

unsizedOrders.forEach(o => {
  let remainingQty = Number(o.qty || 0);
  if (isNaN(remainingQty)) remainingQty = 0;
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

console.log('demandByBin:', demandByBin);
console.log('supplyRemaining:', supplyRemaining);
