const fs = require('fs');

const data = JSON.parse(fs.readFileSync('master_yield.json', 'utf8'));
function traverse(n, processName) {
  let pName = processName;
  if (n.type === 'PROCESS') pName = n.name;
  
  if (n.name === 'หนังติดมันเกรด A' && n.type === 'BY-PRODUCT') {
    console.log(`Master Yield Tree ID: ${n.id}`);
  }
  
  if (n.children) {
    n.children.forEach(c => traverse(c, pName));
  }
}
data.forEach(n => traverse(n, 'ROOT'));

const http = require('http');
http.get('http://203.130.137.153:3000/api/product-spec', (res) => {
  let json = '';
  res.on('data', c => json += c);
  res.on('end', () => {
    const specs = JSON.parse(json);
    const spec = specs.find(s => s.erpItemCode === '111119118');
    console.log(`Product Spec ID: ${spec.masterYieldIds}`);
  });
});
