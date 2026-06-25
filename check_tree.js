const fs = require('fs');

const tree = JSON.parse(fs.readFileSync('master_yield.json', 'utf8'));

let bilNode = null;

function traverse(nodes) {
  for (const n of nodes) {
    if (n.name === 'BIL L/C' && n.type === 'CATEGORY') {
      bilNode = n;
    }
    if (n.children) {
      traverse(n.children);
    }
  }
}

traverse(tree);

if (bilNode) {
  console.log("Children of BIL L/C:");
  for (const c of bilNode.children) {
    console.log(`- ${c.name} (${c.type})`);
    if (c.children && c.children.length > 0) {
      for (const cc of c.children) {
        console.log(`  - ${cc.name} (${cc.type})`);
        if (cc.children && cc.children.length > 0) {
          for (const ccc of cc.children) {
            console.log(`    - ${ccc.name} (${ccc.type})`);
          }
        }
      }
    }
  }
}
