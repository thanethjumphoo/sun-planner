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
      .query("SELECT s.mps_plan_id, s.production_date, p.part_type, s.by_products FROM mps_plan_supply s JOIN mps_plans p ON s.mps_plan_id = p.id WHERE s.production_date = '2026-06-10' ORDER BY s.mps_plan_id DESC");
      
    console.log("Plans for 2026-06-10:");
    res.recordset.forEach(row => {
       let hasBP = "no";
       if (row.by_products) {
          const bp = JSON.parse(row.by_products);
          hasBP = "yes, keys: " + Object.keys(bp).length;
       }
       console.log("Plan ID: " + row.mps_plan_id + " | Part Type: " + row.part_type + " | BP: " + hasBP);
    });

    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
