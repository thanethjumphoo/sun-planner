const fs = require('fs');

const data = JSON.parse(fs.readFileSync('master_yield.json', 'utf8'));
function traverse(n, processName) {
  let pName = processName;
  if (n.type === 'PROCESS') pName = n.name;
  
  if (n.type === 'BY-PRODUCT' && pName === 'process: 3') {
    console.log(`Child under process 3: ${n.name} | ID: ${n.id}`);
  }
  
  if (n.children) {
    n.children.forEach(c => traverse(c, pName));
  }
}

data.forEach(n => traverse(n, 'ROOT'));
