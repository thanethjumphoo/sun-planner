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

    const dates = ['2026-06-08', '2026-06-09', '2026-06-10'];
    const pIds = ['55C3423E-F36B-1410-8FBD-004B1A6D4ABE', '64C3423E-F36B-1410-8FBD-004B1A6D4ABE'];
    
    console.log("--- Checking Supply for target dates ---");
    for (const d of dates) {
      const res = await pool.request()
        .input('d', sql.NVarChar, d)
        .query(`SELECT TOP 1 by_products FROM mps_plan_supply WHERE production_date = @d ORDER BY mps_plan_id DESC`);
      
      if (res.recordset.length > 0 && res.recordset[0].by_products) {
         try {
           const bp = JSON.parse(res.recordset[0].by_products);
           let totalFound = 0;
           pIds.forEach(id => {
             if(bp[id]) {
                totalFound += bp[id].qty;
                console.log(`[${d}] Found ID ${id} with qty: ${bp[id].qty}`);
             }
           });
           if (totalFound === 0) console.log(`[${d}] ByProduct IDs not found in JSON.`);
         } catch(e) {
           console.log(`[${d}] Error parsing byProducts JSON`);
         }
      } else {
         console.log(`[${d}] No supply record or byProducts is null.`);
      }
    }
    
    console.log("\n--- Checking Other Allocations ---");
    const allocRes = await pool.request()
      .input('item', sql.NVarChar, '111119118')
      .query(`
        SELECT so_number, quantity_kg, planned_production_date 
        FROM mps_plan_orders 
        WHERE item_code = @item AND planned_production_date >= '2026-06-04' AND planned_production_date <= '2026-06-11'
        ORDER BY planned_production_date ASC
      `);
    console.log("Other allocations for this item in the window:", allocRes.recordset);

    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
