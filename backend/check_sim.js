const fs = require('fs');

const data = JSON.parse(fs.readFileSync('master_yield.json', 'utf8'));

// We want to simulate what happens for "หนังติดมัน เกรด A 10 KG." (111119118)
const allNodes = [];
function flatten(n) {
  allNodes.push(n);
  if (n.children) n.children.forEach(flatten);
}
data.forEach(flatten);

function findNode(nodes, id) {
  return nodes.find(n => n.id === id);
}

const spec_111119118_ids = "55C3423E-F36B-1410-8FBD-004B1A6D4ABE,64C3423E-F36B-1410-8FBD-004B1A6D4ABE";

const bpIds = spec_111119118_ids.split(',').map(id => id.trim());

const daySupply = {
  // Let's pretend process: 3 generated supply. The ID of หนังติดมันเกรด A under process 3 is 64C3423E.
  '64C3423E-F36B-1410-8FBD-004B1A6D4ABE': { name: 'หนังติดมันเกรด A', qty: 2085 }
};

let remainingQty = 30;
for (const bpId of bpIds) {
  if (remainingQty <= 0) break;
  const bpSupply = daySupply[bpId] ? daySupply[bpId].qty : 0;
  console.log(`Checking bpId: ${bpId}, found supply: ${bpSupply}`);
  if (bpSupply <= 0) continue;
  
  const allocQty = Math.round(Math.min(bpSupply, remainingQty));
  console.log(`Allocating ${allocQty}`);
  if (allocQty <= 0) continue;
  
  daySupply[bpId].qty = Math.max(0, daySupply[bpId].qty - allocQty);
  remainingQty -= allocQty;
}

console.log("Remaining Qty:", remainingQty);
