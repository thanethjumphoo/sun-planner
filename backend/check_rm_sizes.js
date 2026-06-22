const sql = require('mssql');
const config = {
  server: '127.0.0.1', port: 1433,
  user: 'sa', password: 'Your_password123', database: 'sun_planner',
  options: { encrypt: false, trustServerCertificate: true }
};

async function run() {
  const pool = await sql.connect(config);
  const res = await pool.request().query(`
    SELECT DISTINCT item_desc 
    FROM stg_erp_rm_receiving 
    WHERE item_desc LIKE '%BL%'
  `);
  console.log(res.recordset.map(r => r.item_desc));
  await pool.close();
}

run().catch(console.error);
