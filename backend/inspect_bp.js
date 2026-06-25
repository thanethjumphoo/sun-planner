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

    console.log(`\n--- ByProducts on 2026-06-10 in LEG plan 6235 ---`);
    const bpQ = await pool.request().query("SELECT by_products FROM mps_plan_supply WHERE mps_plan_id = 6235 AND production_date = '2026-06-10'");
    if (bpQ.recordset.length > 0) {
       const bpStr = bpQ.recordset[0].by_products;
       if (bpStr) {
           const bp = JSON.parse(bpStr);
           for (const [id, val] of Object.entries(bp)) {
               console.log(id, val.name, val.qty);
           }
       } else {
           console.log("by_products is NULL");
       }
    }

    // Wait, let's also query the nodes for "หนังติดมันเกรด A"
    const nodes = await pool.request().query("SELECT id, name, parent_id, type FROM master_yield_nodes WHERE name LIKE N'%หนังติดมันเกรด A%'");
    console.log("\nNodes for หนังติดมันเกรด A:");
    console.log(nodes.recordset);

    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
