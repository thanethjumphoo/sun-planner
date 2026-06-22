const sql = require('mssql');
const config = {
  server: '127.0.0.1', port: 1433,
  user: 'sa', password: 'Your_password123', database: 'sun_planner',
  options: { encrypt: false, trustServerCertificate: true }
};

async function run() {
  const pool = await sql.connect(config);
  const res = await pool.request().query(`
    SELECT COLUMN_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'bil_weight_distributions'
  `);
  console.log(res.recordset.map(r => r.COLUMN_NAME));
  await pool.close();
}

run().catch(console.error);
