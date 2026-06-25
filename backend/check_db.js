const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  options: { encrypt: false, trustServerCertificate: true },
};

async function test() {
  try {
    await sql.connect(config);
    // Find plan ID for BIL or LEG
    const { recordset: plans } = await sql.query("SELECT id FROM mps_plans WHERE partType = 'leg' OR partType = 'bil'");
    const planIds = plans.map(p => p.id);
    if (planIds.length === 0) { console.log('no plans'); return; }
    
    // Check mps_plan_orders for byproduct types
    const { recordset: bpOrders } = await sql.query(`
      SELECT itemCode, itemDesc, productType, quantityKg 
      FROM mps_plan_orders 
      WHERE mpsPlanId IN (${planIds.join(',')}) 
      AND (itemDesc LIKE '%ข้อสั้น%' OR itemDesc LIKE '%กระดูกแข้ง%' OR itemDesc LIKE '%กระดูกน่อง%')
    `);
    
    console.log("Byproduct orders in DB:");
    console.log(bpOrders);
  } catch (err) {
    console.error(err);
  } finally {
    sql.close();
  }
}
test();
