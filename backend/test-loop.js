const targetOrders = [
  { itemCode: 'A', qty: 32 }
];

const sizeLabels = [
  { key: '180 DOWN', groupSize: '180 DOWN' }
];

const getSupplySizeKg = () => 2843;

const demandByBin = {};
const ordersByBin = {};
sizeLabels.forEach(sl => { demandByBin[sl.key] = 0; ordersByBin[sl.key] = []; });

const supplyRemaining = {};
sizeLabels.forEach(sl => { supplyRemaining[sl.key] = getSupplySizeKg(sl.groupSize); });

const sizedOrders = [];
const unsizedOrders = [];
targetOrders.forEach(o => {
  unsizedOrders.push({ ...o, size: 'unsize' });
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
    ordersByBin[sl.key].push({ qty: allocQty });
  }
});

console.log('demandByBin:', demandByBin);
