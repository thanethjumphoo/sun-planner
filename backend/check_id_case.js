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
    const res = await pool.request().query("SELECT id, name, type FROM master_yield WHERE id IN ('55C3423E-F36B-1410-8FBD-004B1A6D4ABE', '64C3423E-F36B-1410-8FBD-004B1A6D4ABE')");
    console.log(res.recordset);
    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
