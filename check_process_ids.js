const fs = require('fs');

const data = JSON.parse(fs.readFileSync('master_yield.json', 'utf8'));
function traverse(n, processName) {
  let pName = processName;
  if (n.type === 'PROCESS') pName = n.name;
  
  if (n.name === 'หนังติดมันเกรด A' && n.type === 'BY-PRODUCT') {
    console.log(`Found under ${pName}: ID = ${n.id}`);
  }
  
  if (n.children) {
    n.children.forEach(c => traverse(c, pName));
  }
}

data.forEach(n => traverse(n, 'ROOT'));
