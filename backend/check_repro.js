const fs = require('fs');

const yieldTree = JSON.parse(fs.readFileSync('master_yield.json', 'utf8'));

// Simulating everything exactly
let dailyByproductSupply = new Map();
dailyByproductSupply.set('2026-06-10', {
  '64C3423E-F36B-1410-8FBD-004B1A6D4ABE': { name: 'หนังติดมันเกรด A', qty: 2085 }
});

const byprodChillOrders = [
  {
    erpOrderLineId: 'line_1',
    erpOrderItemCode: '111119118',
    erpOrderItemQty: 30,
    erpOrderShipDate: '2026-06-11T00:00:00.000Z'
  }
];

const specMap = new Map();
specMap.set('111119118', {
  masterYieldIds: '55C3423E-F36B-1410-8FBD-004B1A6D4ABE,64C3423E-F36B-1410-8FBD-004B1A6D4ABE'
});

function formatDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const exceptionsToSave = [];

for (const order of byprodChillOrders) {
  const spec = specMap.get(order.erpOrderItemCode);
  let remainingQty = Number(order.erpOrderItemQty || 0);
  if (remainingQty <= 0) continue;
  
  const shipDate = new Date(order.erpOrderShipDate);
  for (let i = 0; i <= 5; i++) {
    if (remainingQty <= 0) break;
    const d = new Date(shipDate);
    d.setDate(d.getDate() - i);
    const dateStr = formatDate(d);
    
    const daySupply = dailyByproductSupply.get(dateStr);
    if (!daySupply) continue;
    
    const bpIds = spec?.masterYieldIds ? spec.masterYieldIds.split(',').map((id) => id.trim()) : [];
    for (const bpId of bpIds) {
      if (remainingQty <= 0) break;
      const bpSupply = daySupply[bpId] ? daySupply[bpId].qty : 0;
      if (bpSupply <= 0) continue;
      
      const allocQty = Math.round(Math.min(bpSupply, remainingQty));
      if (allocQty <= 0) continue;
      
      daySupply[bpId].qty = Math.max(0, daySupply[bpId].qty - allocQty);
      remainingQty -= allocQty;
    }
  }
  
  if (remainingQty > 0) {
    exceptionsToSave.push({
      itemCode: order.erpOrderItemCode,
      reason: 'Insufficient byproduct supply for Chill byproduct order',
      shortageKg: remainingQty
    });
  }
}

console.log("Exceptions:", exceptionsToSave);
console.log("Remaining supply:", dailyByproductSupply.get('2026-06-10'));
