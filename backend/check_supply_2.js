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

    console.log("--- Checking Supply for target dates in DB ---");
    const res = await pool.request()
      .query("SELECT mps_plan_id, production_date, total_weight, by_products FROM mps_plan_supply WHERE production_date >= '2026-06-08' AND production_date <= '2026-06-11' ORDER BY production_date ASC, mps_plan_id DESC");
      
    res.recordset.forEach(row => {
      let bpSummary = "null";
      if (row.by_products) {
        try {
          const bp = JSON.parse(row.by_products);
          bpSummary = "JSON keys: " + Object.keys(bp).length;
          
          const pIds = ['55C3423E-F36B-1410-8FBD-004B1A6D4ABE', '64C3423E-F36B-1410-8FBD-004B1A6D4ABE'];
          let found = 0;
          pIds.forEach(id => {
            if (bp[id]) {
               found += bp[id].qty;
               console.log("  -> Found ID " + id + " in DB: " + bp[id].qty + " kg");
            }
          });
        } catch(e) {
          bpSummary = "Parse Error";
        }
      }
      console.log("Plan: " + row.mps_plan_id + " | Date: " + row.production_date.toISOString() + " | RM: " + row.total_weight + " | BP: " + bpSummary);
    });

    console.log("\n--- Checking all Exception logs for this item ---");
    const exc = await pool.request().query("SELECT top 3 mps_plan_id, reason, created_at FROM mps_exception_reports WHERE item_code = '111119118' ORDER BY created_at DESC");
    console.log(exc.recordset);

    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
