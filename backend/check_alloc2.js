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
    const res = await pool.request().query("SELECT product_type, item_code, SUM(quantity_kg) FROM mps_plan_orders WHERE mps_plan_id = 6227 GROUP BY product_type, item_code");
    console.log(res.recordset);
    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
