const sql = require('mssql');
require('dotenv').config({ path: '../.env' });

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
    // Find the latest plan
    const { recordset: plans } = await sql.query("SELECT TOP 1 id FROM mps_plans WHERE partType = 'bil' ORDER BY id DESC");
    if (plans.length === 0) return;
    const planId = plans[0].id;
    
    // Find supplies
    const { recordset: supplies } = await sql.query(`SELECT productionDate, byProducts FROM mps_plan_supplies WHERE mpsPlanId = ${planId} AND byProducts IS NOT NULL`);
    supplies.forEach(s => {
      const date = new Date(s.productionDate).toISOString().split('T')[0];
      if (date === '2026-06-10') {
        const bp = JSON.parse(s.byProducts);
        console.log("2026-06-10 byProducts:");
        console.log(bp);
      }
    });
  } catch (err) {
    console.error(err);
  } finally {
    sql.close();
  }
}
test();
