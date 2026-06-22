const sql = require('mssql');
const config = {
  server: '127.0.0.1', port: 1433,
  user: 'sa', password: 'Your_password123', database: 'sun_planner',
  options: { encrypt: false, trustServerCertificate: true }
};

async function checkBilSupply() {
  const pool = await sql.connect(config);
  const res = await pool.request().query(`
    SELECT TOP 5 p.part_type, s.production_date, s.by_products
    FROM mps_plan_supply s
    JOIN mps_plans p ON s.mps_plan_id = p.id
    WHERE p.part_type = 'bil'
    ORDER BY s.production_date DESC
  `);
  res.recordset.forEach(r => {
    const bp = JSON.parse(r.by_products || '{}');
    const bl = bp['BL-DEBONE'] || bp['BL'] || bp['BL (Debone)'] || {};
    console.log(r.production_date, bl.sizes);
  });
  await pool.close();
}

checkBilSupply().catch(console.error);
