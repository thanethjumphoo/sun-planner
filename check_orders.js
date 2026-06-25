const fs = require('fs');

const data = JSON.parse(fs.readFileSync('master_yield.json', 'utf8'));

// Find "BIL L/C" category
let bilNode = null;
function traverse(nodes) {
  for (const n of nodes) {
    if (n.name === 'BIL L/C' && n.type === 'CATEGORY') bilNode = n;
    if (n.children) traverse(n.children);
  }
}
traverse(data);

const nodeIds = [];
function collectTree(node) {
  nodeIds.push(node.id);
  if (node.children) node.children.forEach(collectTree);
}
if (bilNode) collectTree(bilNode);

// Let's query mps_plan_orders for planId = 6226 to see if any are allocated
require('dotenv').config();
const sql = require('mssql');

const config = {
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  options: { encrypt: false, trustServerCertificate: true },
};

async function test() {
  try {
    await sql.connect(config);
    const { recordset: specs } = await sql.query('SELECT * FROM product_specs');
    
    // Get all by-product items for BIL L/C
    const bpCodes = specs.filter(s => {
      if (!s.masterYieldIds) return false;
      const ids = s.masterYieldIds.split(',').map(id => id.trim());
      return ids.some(id => {
        const node = nodeIds.includes(id) ? id : null;
        return node;
      });
    }).map(s => s.erpItemCode);
    
    console.log("BIL L/C By-Product Codes:", bpCodes);
    
    const { recordset: erpOrders } = await sql.query("SELECT * FROM stg_erp_orders_lines WHERE itemCode IN ('" + bpCodes.join("','") + "')");
    console.log("ERP Orders for these By-Products:", erpOrders.length);
    
    const { recordset: mpsOrders } = await sql.query("SELECT * FROM mps_plan_orders WHERE mpsPlanId IN (SELECT id FROM mps_plans WHERE targetMonth = '2026-07') AND itemCode IN ('" + bpCodes.join("','") + "')");
    console.log("Allocated MPS Orders for these By-Products in 2026-07:", mpsOrders.length);
  } catch (err) {
    console.error(err);
  } finally {
    sql.close();
  }
}
test();
