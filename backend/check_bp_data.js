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
    
    // Find the latest BIL plan ID
    const planQuery = await pool.request().query("SELECT TOP 1 id FROM mps_plans WHERE part_type = 'bil' ORDER BY created_at DESC");
    const planId = planQuery.recordset[0].id;
    
    // Find the supply row that has roughly 10,655 for BL BLOCK in by_products JSON
    const supplyQuery = await pool.request().query(`SELECT production_date, by_products FROM mps_plan_supply WHERE plan_id = ${planId}`);
    
    for (const row of supplyQuery.recordset) {
      if (!row.by_products) continue;
      const bp = JSON.parse(row.by_products);
      const blBlockQty = bp['BL-BLOCK']?.qty || bp['BL BLOCK']?.qty || 0;
      
      // Let's just print the by_products JSON for the day that has some process 3 byproducts
      console.log('Date:', row.production_date);
      console.log('By-Products keys:', Object.keys(bp));
      
      const p3Names = Object.values(bp).filter(b => b.processName === 'BIL L/C').map(b => b.name);
      console.log('BIL L/C items:', p3Names);
      console.log('-------------------------');
    }

    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
