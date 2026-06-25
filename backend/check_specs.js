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
    
    // Check some BIL specs
    const specQuery = await pool.request().query("SELECT TOP 5 erp_item_code, master_yield_ids, product_type FROM specs WHERE product_type = 'main' AND (master_yield_ids LIKE '%5BC3423E%' OR master_yield_ids LIKE '%25C3423E%' OR master_yield_ids LIKE '%3DC3423E%')");
    console.log('Specs:', specQuery.recordset);

    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
