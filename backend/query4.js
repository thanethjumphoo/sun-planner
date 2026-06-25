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

    const res = await pool.request().query("SELECT id, name, type, parentId FROM master_yield WHERE id IN ('00C3423E-F36B-1410-8FBD-004B1A6D4ABE', '61BE63A5-A659-F111-A9AC-E0071B8A3D2C')");
    console.log('Parent Nodes:', res.recordset);
    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
