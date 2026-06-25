const fs = require('fs');

const data = JSON.parse(fs.readFileSync('master_yield.json', 'utf8'));
const flatNodes = [];
function traverse(nodes) {
  for (const n of nodes) {
    flatNodes.push(n);
    if (n.children) traverse(n.children);
  }
}
traverse(data);

const http = require('http');
http.get('http://203.130.137.153:3000/api/product-spec', (res) => {
  let json = '';
  res.on('data', c => json += c);
  res.on('end', () => {
    const specs = JSON.parse(json);
    const spec = specs.find(s => s.erpItemCode === '111119118');
    console.log("Spec 111119118 name:", spec.erpItemDesc);
    console.log("masterYieldIds:", spec.masterYieldIds);
    
    if (spec && spec.masterYieldIds) {
      const ids = spec.masterYieldIds.split(',').map(id => id.trim());
      ids.forEach(id => {
        const found = flatNodes.find(n => n.id === id);
        console.log(`ID ${id} -> Node Name: ${found ? found.name : 'NOT FOUND'}, Parent: ${found ? found.parentId : 'N/A'}`);
      });
    }
  });
});
