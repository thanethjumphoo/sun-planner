const sql = require('mssql');
const config = {
  server: '127.0.0.1', port: 1433,
  user: 'sa', password: 'Your_password123', database: 'sun_planner',
  options: { encrypt: false, trustServerCertificate: true }
};

async function getReasons() {
  const pool = await sql.connect(config);
  const res = await pool.request().query(`
    SELECT DISTINCT reason FROM mps_exception_reports
  `);
  console.log(res.recordset.map(r => r.reason));
  await pool.close();
}

getReasons().catch(console.error);
