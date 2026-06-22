const sql = require('mssql');
const config = {
  server: '127.0.0.1', port: 1433,
  user: 'sa', password: 'Your_password123', database: 'sun_planner',
  options: { encrypt: false, trustServerCertificate: true }
};

async function getTables() {
  const pool = await sql.connect(config);
  const res = await pool.request()
    .query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES`);
  console.log(res.recordset.map(r => r.TABLE_NAME));
  await pool.close();
}

getTables().catch(console.error);
