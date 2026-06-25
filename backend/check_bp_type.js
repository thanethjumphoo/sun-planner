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
    
    const query = await pool.request().query("SELECT product_type FROM product_specs WHERE erp_item_code = '111119118'");
    console.log('productType:', query.recordset[0]?.product_type);

    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
