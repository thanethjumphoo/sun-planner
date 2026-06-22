const sql = require('mssql');
const config = {
  server: '127.0.0.1', port: 1433,
  user: 'sa', password: 'Your_password123', database: 'sun_planner',
  options: { encrypt: false, trustServerCertificate: true }
};

async function checkItems() {
  const pool = await sql.connect(config);
  
  // 1. Check Product Specs
  console.log('--- Product Specs ---');
  const specRes = await pool.request()
    .query(`SELECT ERP_ITEM_CODE, ERP_ITEM_DESC, ICUT_SPEED, PRODUCT_SIZE, PRODUCT_TYPE 
            FROM product_specs WHERE ERP_ITEM_CODE IN ('111114219', '111114241')`);
  console.table(specRes.recordset);

  // 2. Check Exceptions
  console.log('\n--- Exceptions ---');
  const excRes = await pool.request()
    .query(`SELECT TOP 10 item_code, shortage_kg, reason, created_at 
            FROM mps_exception_reports WHERE item_code IN ('111114219', '111114241')
            ORDER BY created_at DESC`);
  console.table(excRes.recordset);

  // 3. Check Orders
  console.log('\n--- Orders ---');
  const orderRes = await pool.request()
    .query(`SELECT erp_order_item_code, erp_order_item_qty, erp_order_ship_date
            FROM stg_erp_order_lines WHERE erp_order_item_code IN ('111114219', '111114241')`);
  console.table(orderRes.recordset);

  await pool.close();
}

checkItems().catch(console.error);
