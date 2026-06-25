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
    const res = await pool.request().query("SELECT TOP 5 production_date, by_products FROM mps_plan_supply WHERE mps_plan_id = 6227");
    console.log(JSON.stringify(res.recordset.map(r => ({ date: r.production_date, byprod: r.by_products ? JSON.parse(r.by_products) : null })), null, 2));
    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
