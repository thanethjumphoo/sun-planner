const sql = require('mssql');
async function test() {
  await sql.connect('mssql://sa:Your_password123@127.0.0.1:1433/sun_planner?encrypt=true&trustServerCertificate=true');
  const res = await sql.query("SELECT erp_order_status FROM stg_erp_order_headers WHERE erp_order_number = '1411062600486'");
  console.log('STATUS:', res.recordset);
  
  const lineRes = await sql.query("SELECT erp_order_item_code, erp_order_ship_date, quantity_kg FROM stg_erp_order_lines WHERE erp_order_header_id IN (SELECT erp_order_header_id FROM stg_erp_order_headers WHERE erp_order_number = '1411062600486')");
  console.log('LINES:', lineRes.recordset);
  sql.close();
}
test();
