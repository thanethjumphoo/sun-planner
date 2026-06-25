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

    console.log("--- Latest LEG Plans ---");
    const plans = await pool.request().query("SELECT TOP 5 id, part_type, target_month, created_at FROM mps_plans WHERE part_type = 'leg' ORDER BY created_at DESC");
    console.log(plans.recordset);

    const latestPlanId = 6235;
    console.log(`\n--- Allocations for 111119118 in LEG plan ${latestPlanId} ---`);
    const alloc = await pool.request().query(`SELECT mps_plan_id, quantity_kg, planned_production_date FROM mps_plan_orders WHERE mps_plan_id = ${latestPlanId} AND item_code = '111119118'`);
    console.log(alloc.recordset);

    console.log(`\n--- Exceptions for 111119118 in LEG plan ${latestPlanId} ---`);
    const exc = await pool.request().query(`SELECT mps_plan_id, shortage_kg, reason FROM mps_exception_reports WHERE mps_plan_id = ${latestPlanId} AND item_code = '111119118'`);
    console.log(exc.recordset);

    console.log(`\n--- ByProducts on 2026-06-10 in LEG plan 6235 ---`);
    const bpQ = await pool.request().query("SELECT by_products FROM mps_plan_supply WHERE mps_plan_id = 6235 AND production_date = '2026-06-10'");
    if (bpQ.recordset.length > 0) {
       const bp = JSON.parse(bpQ.recordset[0].by_products);
       console.log("Keys:", Object.keys(bp).length);
       const pIds = ['55C3423E-F36B-1410-8FBD-004B1A6D4ABE', '64C3423E-F36B-1410-8FBD-004B1A6D4ABE'];
       pIds.forEach(id => {
           if (bp[id]) console.log("Found:", bp[id].name, bp[id].qty);
       });
    }

    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
