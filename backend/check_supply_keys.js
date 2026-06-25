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

    const res = await pool.request()
      .query("SELECT TOP 1 by_products FROM mps_plan_supply WHERE production_date = '2026-06-10' AND by_products IS NOT NULL ORDER BY mps_plan_id ASC");
      
    if (res.recordset.length > 0) {
       const bp = JSON.parse(res.recordset[0].by_products);
       console.log("Keys and Names in JSON:");
       for (const k in bp) {
           console.log("Key: " + k + " -> Name: " + bp[k].name + ", Qty: " + bp[k].qty);
       }
    } else {
       console.log("No record found.");
    }

    const specRes = await pool.request().query("SELECT master_yield_ids FROM product_specs WHERE erp_item_code = '111119118'");
    console.log("\\nSpec master_yield_ids:", specRes.recordset[0]);

    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
