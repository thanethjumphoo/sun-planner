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
    
    // Get latest BIL plan ID
    const planQuery = await pool.request().query("SELECT TOP 1 id FROM mps_plans WHERE part_type = 'bil' ORDER BY created_at DESC");
    const planId = planQuery.recordset[0]?.id;
    console.log('Latest BIL Plan ID:', planId);

    if (planId) {
      const supplyQuery = await pool.request().query("SELECT TOP 1 production_date, by_products FROM mps_plan_supply WHERE mps_plan_id = " + planId + " AND by_products IS NOT NULL AND by_products != '{}'");
      console.log('Supply By-Products:', supplyQuery.recordset[0]?.by_products);

      const ordersQuery = await pool.request().query("SELECT * FROM mps_plan_orders WHERE mps_plan_id = " + planId + " AND type = 'BY-PRODUCT'");
      console.log('By-Product Orders length:', ordersQuery.recordset.length);
      console.log('First 2 orders:', ordersQuery.recordset.slice(0, 2));
    }

    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
