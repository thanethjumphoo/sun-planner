const sql = require('mssql');
const config = {
  server: '127.0.0.1', port: 1433,
  user: 'sa', password: 'Your_password123', database: 'sun_planner',
  options: { encrypt: false, trustServerCertificate: true }
};

async function checkCols() {
  const pool = await sql.connect(config);
  
  console.log('--- weight_distributions ---');
  const d1 = await pool.request().query(`SELECT TOP 10 row_label, col_label, dist_value FROM weight_distributions WHERE dist_value > 0`);
  console.table(d1.recordset);

  console.log('--- bil_weight_distributions ---');
  const d2 = await pool.request().query(`SELECT TOP 10 row_label, col_label, dist_value FROM bil_weight_distributions WHERE dist_value > 0`);
  console.table(d2.recordset);

  // Check what columns actually exist in bil_weight_distributions
  const distinctCols = await pool.request().query(`SELECT DISTINCT col_label FROM bil_weight_distributions`);
  console.log('Distinct col_label in bil_weight_distributions:', distinctCols.recordset.map(r => r.col_label));

  await pool.close();
}

checkCols().catch(console.error);
