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
    
    const bilQuery = await pool.request().query("SELECT TOP 1 master_yield_ids FROM product_specs WHERE erp_item_code IN ('111113206', '111111248', '111111120')");
    console.log('BIL masterYieldIds:', bilQuery.recordset[0]?.master_yield_ids);

    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
