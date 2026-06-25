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
    
    console.log("--- Allocations for 111119118 in BIL plan 7223 ---");
    const alloc = await pool.request().query("SELECT mps_plan_id, quantity_kg, planned_production_date FROM mps_plan_orders WHERE mps_plan_id = 7223 AND item_code = '111119118'");
    console.log(alloc.recordset);

    console.log("\n--- Exceptions for 111119118 in BIL plan 7223 ---");
    const exc = await pool.request().query("SELECT mps_plan_id, shortage_kg, reason FROM mps_exception_reports WHERE mps_plan_id = 7223 AND item_code = '111119118'");
    console.log(exc.recordset);

    console.log("\n--- By-Product Supply for 'หนังติดมันเกรด A' in BIL plan 7223 on 2026-06-10 ---");
    const bpRes = await pool.request().query("SELECT by_products FROM mps_plan_supply WHERE mps_plan_id = 7223 AND production_date = '2026-06-10'");
    if (bpRes.recordset.length > 0) {
        const bp = JSON.parse(bpRes.recordset[0].by_products);
        const pIds = ['55C3423E-F36B-1410-8FBD-004B1A6D4ABE', '64C3423E-F36B-1410-8FBD-004B1A6D4ABE'];
        pIds.forEach(id => {
            if (bp[id]) console.log("ID:", id, "Name:", bp[id].name, "Qty:", bp[id].qty);
        });
    }

    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
