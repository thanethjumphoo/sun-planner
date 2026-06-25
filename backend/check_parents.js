const sql = require('mssql');
require('dotenv').config({path: '.env'});

async function run() {
  try {
    const pool = await sql.connect({
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      server: process.env.DB_HOST,
      database: process.env.DB_NAME,
      options: {encrypt: false, trustServerCertificate: true}
    });
    
    const nodeQuery = await pool.request().query("SELECT id, name, type, parentId FROM master_yield WHERE id IN ('25C3423E-F36B-1410-8FBD-004B1A6D4ABE', '5BC3423E-F36B-1410-8FBD-004B1A6D4ABE', '3DC3423E-F36B-1410-8FBD-004B1A6D4ABE')");
    console.log('Nodes:', nodeQuery.recordset);

    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
