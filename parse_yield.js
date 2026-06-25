const fs = require('fs');

const tree = JSON.parse(fs.readFileSync('master_yield.json', 'utf8'));

// Find "BIL L/C" category
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

if (bilNode) {
  console.log("Found BIL L/C");
  // Find descendants
  const byProducts = [];
  function collectByProducts(node) {
    if (node.type === 'BY-PRODUCT') {
      byProducts.push(node.name);
    }
    if (node.children) {
      node.children.forEach(collectByProducts);
    }
  }
  collectByProducts(bilNode);
  console.log("By-Products under BIL L/C:");
  console.log(byProducts);
} else {
  console.log("BIL L/C not found");
}
