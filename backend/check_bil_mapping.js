const sql = require('mssql');
const config = {
  server: '127.0.0.1', port: 1433,
  user: 'sa', password: 'Your_password123', database: 'sun_planner',
  options: { encrypt: false, trustServerCertificate: true }
};

async function run() {
  const pool = await sql.connect(config);
  const res = await pool.request().query(`
    SELECT DISTINCT col_label, bl_col_label 
    FROM bil_weight_distributions 
    WHERE dist_value > 0
  `);
  console.table(res.recordset);
  await pool.close();
}

run().catch(console.error);
