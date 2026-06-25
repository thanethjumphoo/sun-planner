const sql = require('mssql');
const config = {
  server: '127.0.0.1', port: 1433,
  user: 'sa', password: 'Your_password123', database: 'sun_planner',
  options: { encrypt: false, trustServerCertificate: true }
};

async function debug() {
  const pool = await sql.connect(config);
  const ordersRes = await pool.request().query("SELECT TOP 5 * FROM mps_plan_orders WHERE so_number = '1411012602910' AND mps_plan_id = 6226");
  console.log(ordersRes.recordset);
  await pool.close();
}
debug().catch(console.error);
