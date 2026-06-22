const sql = require('mssql');
const config = {
  server: '127.0.0.1', port: 1433,
  user: 'sa', password: 'Your_password123', database: 'sun_planner',
  options: { encrypt: false, trustServerCertificate: true }
};

async function checkMatrix() {
  const pool = await sql.connect(config);
  const res = await pool.request().query(`SELECT TOP 10 * FROM bl_belt_gate_matrix`);
  console.table(res.recordset);
  await pool.close();
}

checkMatrix().catch(console.error);
