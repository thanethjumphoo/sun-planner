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
    
    console.log("--- Latest BIL Plans ---");
    const plans = await pool.request().query("SELECT TOP 5 id, part_type, target_month, created_at FROM mps_plans WHERE part_type = 'bil' ORDER BY created_at DESC");
    console.log(plans.recordset);

    console.log("\n--- Exceptions for 111119118 in BIL plans ---");
    const exc = await pool.request().query("SELECT top 5 e.mps_plan_id, e.shortage_kg, e.created_at FROM mps_exception_reports e JOIN mps_plans p ON e.mps_plan_id = p.id WHERE p.part_type = 'bil' AND e.item_code = '111119118' ORDER BY e.created_at DESC");
    console.log(exc.recordset);

    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
