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

    console.log("Cleaning up bil plan 7223...");
    await pool.request().query("DELETE FROM mps_exception_reports WHERE mps_plan_id = 7223");
    await pool.request().query("DELETE FROM mps_plan_orders WHERE mps_plan_id = 7223");
    await pool.request().query("DELETE FROM mps_plan_supply_sizes WHERE mps_plan_supply_id IN (SELECT id FROM mps_plan_supply WHERE mps_plan_id = 7223)");
    await pool.request().query("DELETE FROM mps_plan_supply WHERE mps_plan_id = 7223");
    await pool.request().query("DELETE FROM mps_plan_daily WHERE mps_plan_id = 7223");
    await pool.request().query("DELETE FROM mps_plans WHERE id = 7223");
    console.log("Deleted bil plan 7223.");

    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
