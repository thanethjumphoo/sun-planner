const fs = require('fs');

const data = JSON.parse(fs.readFileSync('master_yield.json', 'utf8'));

// Find nodes for "หนังติดมัน เกรด A"
const nodes = [];
function findNodes(n) {
  if (n.name && n.name.includes('หนังติดมันเกรด A') && n.type === 'BY-PRODUCT') {
    nodes.push(n);
  }
  if (n.children) n.children.forEach(findNodes);
}
findNodes(data);

console.log("Nodes for หนังติดมันเกรด A:", nodes.map(n => ({ id: n.id, parent: n.parentId })));

// Let's check how bpIds looks like in product_specs for 111119118
const http = require('http');
http.get('http://203.130.137.153:3000/api/product-spec', (res) => {
  let json = '';
  res.on('data', c => json += c);
  res.on('end', () => {
    const specs = JSON.parse(json);
    const spec = specs.find(s => s.erpItemCode === '111119118');
    console.log("spec for 111119118:", spec ? spec.masterYieldIds : 'NOT FOUND');
    
    if (spec && spec.masterYieldIds) {
      const ids = spec.masterYieldIds.split(',').map(id => id.trim());
      ids.forEach(id => {
        const found = nodes.find(n => n.id === id);
        console.log(`ID ${id} -> Match? ${!!found}`);
      });
    }
  });
});
