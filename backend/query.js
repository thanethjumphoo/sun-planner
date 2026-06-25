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

    const res = await pool.request().query("SELECT erp_item_code, erp_item_desc, product_type, type, master_yield_ids FROM product_specs WHERE erp_item_code = '111145102'");
    console.log('Spec for 111145102:', res.recordset);
    
    // Let's also check if it exists in any MPS plan
    const res2 = await pool.request().query("SELECT p.id, p.part_type, o.item_code, o.item_desc FROM mps_orders o JOIN mps_plans p ON o.mps_plan_id = p.id WHERE o.item_code = '111145102' AND p.part_type = 'leg'");
    console.log('MPS Orders for 111145102 in leg plan:', res2.recordset);

    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
