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
    const res = await pool.request().query("SELECT reason, shortage_kg, required_kg FROM mps_exception_reports WHERE mps_plan_id = 6227 AND reason LIKE '%Insufficient byproduct%'");
    console.log(res.recordset);
    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
