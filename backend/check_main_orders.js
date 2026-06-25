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

    const lines = await pool.request().query("SELECT TOP 500 erp_order_item_code FROM stg_erp_order_lines WHERE erp_order_status != 'CANCELLED' AND erp_order_ship_date >= '2026-06-01' AND erp_order_ship_date <= '2026-06-30'");
    const allCodes = lines.recordset.map(r => r.erp_order_item_code);

    const bilNodes = await pool.request().query("SELECT master_yield_ids FROM product_specs");
    
    // Check if any code is BIL
    console.log("Total unique codes in June:", new Set(allCodes).size);
    // Let's just manually query the count of BIL items vs BL items
    // Since we don't have the tree easily, let's just see if any exist
    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
