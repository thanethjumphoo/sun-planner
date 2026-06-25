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
    const res = await pool.request().query("SELECT TOP 5 id, part_type, target_month, status FROM mps_plans WHERE part_type = 'bil' ORDER BY id DESC");
    console.log(res.recordset);
    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
