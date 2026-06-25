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

    const res = await pool.request().query("SELECT DISTINCT part_type FROM mps_plans");
    console.log("Distinct part_types in DB:", res.recordset);

    const res2 = await pool.request().query("SELECT top 10 id, part_type, target_month, created_at FROM mps_plans ORDER BY created_at DESC");
    console.log("Latest plans:", res2.recordset);

    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
