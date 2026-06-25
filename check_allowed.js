const fs = require('fs');
const http = require('http');

const tree = JSON.parse(fs.readFileSync('master_yield.json', 'utf8'));

let bilNode = null;
const allNodes = [];

function traverse(nodes) {
  for (const n of nodes) {
    allNodes.push(n);
    if (n.name === 'BIL L/C' && n.type === 'CATEGORY') {
      bilNode = n;
    }
    if (n.children) {
      traverse(n.children);
    }
  }
}

traverse(tree);

const nodeIds = [];
function collectTree(node) {
  nodeIds.push(node.id);
  if (node.children) {
    node.children.forEach(collectTree);
  }
}
if (bilNode) collectTree(bilNode);

console.log("Collected node IDs:", nodeIds.length);

http.get('http://203.130.137.153:3000/api/product-spec', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const specs = JSON.parse(data);
    const codes = specs.filter(s => {
      if (!s.masterYieldIds) return false;
      const ids = s.masterYieldIds.split(',').map(id => id.trim());
      return ids.some(id => nodeIds.includes(id));
    }).map(s => s.erpItemCode);
    console.log("Allowed item codes for BIL L/C:", codes.length);
    
    // Find items that are By-Products
    const byProductCodes = specs.filter(s => {
      if (!s.masterYieldIds) return false;
      const ids = s.masterYieldIds.split(',').map(id => id.trim());
      return ids.some(id => {
        const node = allNodes.find(n => n.id === id);
        return node && nodeIds.includes(id) && node.type === 'BY-PRODUCT';
      });
    });
    
    console.log("By-Product items for BIL L/C:");
    byProductCodes.forEach(s => {
      const ids = s.masterYieldIds.split(',').map(id => id.trim());
      const nodes = ids.map(id => allNodes.find(n => n.id === id)).filter(Boolean);
      console.log(s.erpItemCode, s.erpItemDesc, "->", nodes.map(n => n.name).join(', '));
    });
  });
});
