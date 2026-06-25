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
    const res = await pool.request().query(`
      SELECT o.item_code, o.quantity_kg, p.product_type 
      FROM mps_plan_orders o 
      LEFT JOIN product_specs p ON o.item_code = p.erp_item_code 
      WHERE o.mps_plan_id = 6227
    `);
    console.log(res.recordset);
    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
