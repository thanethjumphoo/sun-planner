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
    
    const nodeQuery = await pool.request().query("SELECT id, name, type FROM master_yield_nodes WHERE id = '64C3423E-F36B-1410-8FBD-004B1A6D4ABE'");
    console.log('Node:', nodeQuery.recordset[0]);

    const nodeQuery2 = await pool.request().query("SELECT id, name, type FROM master_yield_nodes WHERE id = '55C3423E-F36B-1410-8FBD-004B1A6D4ABE'");
    console.log('Node2:', nodeQuery2.recordset[0]);

    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
