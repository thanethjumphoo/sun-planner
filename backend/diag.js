require('dotenv').config({path: '.env'});
const sql = require('mssql');
async function run() {
  try {
    const pool = await sql.connect({
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      server: process.env.DB_HOST,
      database: process.env.DB_NAME,
      options: {encrypt: false, trustServerCertificate: true}
    });

    const nodes = await pool.request().query("SELECT id, parentId, type, name FROM master_yield");
    const allNodes = nodes.recordset;

    const getCodes = (pt) => {
        const categoryMap = {
          'fillet': ['สันใน'],
          'bil': ['BIL L/C', 'BIL S/C'],
          'bl': ['BL Processing', 'RM: BL (ทั้งชิ้น)', 'RM: BLDR (น่อง)', 'RM: BLT (สะโพก)'],
          'leg': ['BIL L/C', 'BIL S/C', 'BL Processing', 'RM: BL (ทั้งชิ้น)', 'RM: BLDR (น่อง)', 'RM: BLT (สะโพก)'],
        };
        const categoryNames = categoryMap[pt];
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
        return nodeIds;
    };

    const bilCodes = getCodes('bil');
    console.log("bilCodes count:", bilCodes.length);
    const blCodes = getCodes('bl');
    console.log("blCodes count:", blCodes.length);

    const orders = await pool.request().query("SELECT erp_order_item_code FROM stg_erp_order_lines WHERE erp_order_ship_date >= '2026-06-01' AND erp_order_ship_date <= '2026-06-30'");
    const specs = await pool.request().query("SELECT erp_item_code, master_yield_ids FROM product_specs");
    
    let isBilCount = 0;
    let isBlCount = 0;

    for (const o of orders.recordset) {
        const spec = specs.recordset.find(s => s.erp_item_code === o.erp_order_item_code);
        if (spec && spec.master_yield_ids) {
            const pIds = spec.master_yield_ids.split(',').map(id => id.trim());
            const isBil = pIds.some(id => bilCodes.includes(id));
            const isBl = pIds.some(id => blCodes.includes(id));
            if (isBil) isBilCount++;
            if (isBl) isBlCount++;
        }
    }

    console.log("isBil orders:", isBilCount);
    console.log("isBl orders:", isBlCount);

    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
