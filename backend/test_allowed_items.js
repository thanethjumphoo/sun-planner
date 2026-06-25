require('dotenv').config();
const sql = require('mssql');

const config = {
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

async function testAllowedItems() {
  try {
    await sql.connect(config);
    // 1. Get all nodes
    const { recordset: allNodes } = await sql.query('SELECT * FROM master_yield');
    
    // 2. Find category matches
    const categoryNames = ['BIL L/C', 'BIL S/C'];
    const nodeIds = [];
    const collectTree = (parentId) => {
      const children = allNodes.filter(n => n.parentId === parentId);
      for (const child of children) {
        nodeIds.push(child.id);
        collectTree(child.id);
      }
    };
    
    for (const name of categoryNames) {
      const matches = allNodes.filter(n => (n.type === 'CATEGORY' || n.type === 'ROOT') && n.name === name);
      for (const m of matches) {
        nodeIds.push(m.id);
        collectTree(m.id);
      }
    }
    
    // 3. Get specs
    const { recordset: specs } = await sql.query('SELECT * FROM product_specs');
    
    const codes = specs.filter(s => {
      if (!s.masterYieldIds) return false;
      const ids = s.masterYieldIds.split(',').map(id => id.trim());
      return ids.some(id => nodeIds.includes(id));
    }).map(s => s.erpItemCode);
    
    console.log("Allowed item codes for BIL:", codes.length);
    console.log("Are any of the screenshot's byproduct items included?");
    const screenshotByproducts = ['111149101', '111149102', '111149103', '111149201'];
    for (const bp of screenshotByproducts) {
      console.log(bp, 'included?', codes.includes(bp));
    }
    
    // Check their masterYieldIds
    for (const bp of screenshotByproducts) {
      const spec = specs.find(s => s.erpItemCode === bp);
      if (spec) {
        console.log(bp, 'masterYieldIds:', spec.masterYieldIds);
        const yIds = spec.masterYieldIds.split(',').map(id => id.trim());
        const yNodes = yIds.map(id => allNodes.find(n => n.id === id));
        console.log(bp, 'Yield Nodes:', yNodes.map(n => n ? n.name : null));
        
        // Trace back to root
        for (const node of yNodes) {
          if (!node) continue;
          let curr = node;
          const path = [curr.name];
          while (curr.parentId) {
            curr = allNodes.find(n => n.id === curr.parentId);
            if (curr) path.unshift(curr.name);
            else break;
          }
          console.log(bp, 'Path:', path.join(' -> '));
        }
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    sql.close();
  }
}

testAllowedItems();
