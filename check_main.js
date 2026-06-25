const fs = require('fs');

const data = JSON.parse(fs.readFileSync('master_yield.json', 'utf8'));
let p3 = null;
function traverse(n) {
  if (n.name === 'process: 3' && n.type === 'PROCESS') p3 = n;
  if (n.children) n.children.forEach(traverse);
}
data.forEach(traverse);

if (!p3) return;

const childIds = p3.children.map(c => c.id);

const http = require('http');
http.get('http://203.130.137.153:3000/api/product-spec', (res) => {
  let json = '';
  res.on('data', c => json += c);
  res.on('end', () => {
    const specs = JSON.parse(json);
    const mainItems = specs.filter(s => {
      if (!s.masterYieldIds) return false;
      const ids = s.masterYieldIds.split(',').map(id => id.trim());
      return ids.some(id => childIds.includes(id));
    });
    console.log("Main items producing process 3 byproducts:");
    mainItems.forEach(s => {
      console.log(s.erpItemCode, s.erpItemDesc, s.productType);
    });
  });
});
