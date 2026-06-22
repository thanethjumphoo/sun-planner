const sql = require('mssql');
const config = {
  server: '127.0.0.1', port: 1433,
  user: 'sa', password: 'Your_password123', database: 'sun_planner',
  options: { encrypt: false, trustServerCertificate: true }
};

async function getCols() {
  const pool = await sql.connect(config);
  
  const res = await pool.request()
    .query(`
      SELECT TABLE_NAME, COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME IN ('mps_exception_reports', 'stg_erp_order_lines', 'stg_erp_rm_receiving')
      ORDER BY TABLE_NAME
    `);
  
  const tables = {};
  for (const row of res.recordset) {
    if (!tables[row.TABLE_NAME]) tables[row.TABLE_NAME] = [];
    tables[row.TABLE_NAME].push(row.COLUMN_NAME);
  }
  
  console.log(JSON.stringify(tables, null, 2));
  
  await pool.close();
}

getCols().catch(console.error);
