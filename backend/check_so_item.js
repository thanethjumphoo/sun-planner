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

    const soNumber = '1411032602484';
    const itemCode = '111119118';

    console.log("--- 1. Order Lines ---");
    const orderRes = await pool.request()
      .input('so', sql.NVarChar, soNumber)
      .input('item', sql.NVarChar, itemCode)
      .query(`
        SELECT h.erp_order_number, l.erp_order_item_code, l.erp_order_item_qty, l.erp_order_ship_date
        FROM stg_erp_order_headers h
        JOIN stg_erp_order_lines l ON h.erp_order_header_id = l.erp_order_header_id
        WHERE h.erp_order_number = @so AND l.erp_order_item_code = @item
      `);
    console.log(orderRes.recordset);

    console.log("\n--- 2. Product Spec ---");
    const specRes = await pool.request()
      .input('item', sql.NVarChar, itemCode)
      .query(`
        SELECT erp_item_code, erp_item_desc, product_type, master_yield_ids, product_size, product_yield, min_product_lead, max_product_lead, is_external_rm_allowed
        FROM product_specs
        WHERE erp_item_code = @item
      `);
    console.log(specRes.recordset);

    console.log("\n--- 3. Exceptions ---");
    const excRes = await pool.request()
      .input('so', sql.NVarChar, soNumber)
      .input('item', sql.NVarChar, itemCode)
      .query(`
        SELECT top 5 mps_plan_id, reason, shortage_kg, required_kg, created_at
        FROM mps_exception_reports
        WHERE so_number = @so AND item_code = @item
        ORDER BY created_at DESC
      `);
    console.log(excRes.recordset);

    console.log("\n--- 4. Allocated Orders ---");
    const allocRes = await pool.request()
      .input('so', sql.NVarChar, soNumber)
      .input('item', sql.NVarChar, itemCode)
      .query(`
        SELECT top 5 mps_plan_id, quantity_kg, planned_production_date
        FROM mps_plan_orders
        WHERE so_number = @so AND item_code = @item
        ORDER BY planned_production_date DESC
      `);
    console.log(allocRes.recordset);

    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
