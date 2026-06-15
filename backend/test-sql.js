const sql = require('mssql');
require('dotenv').config({ path: '.env.development' });

async function run() {
  try {
    const config = {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      server: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 1433),
      options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: true,
      },
    };
    await sql.connect(config);
    const result = await sql.query`SELECT TOP 10 soNumber, itemCode, itemDesc, quantityKg, plannedProductionDate FROM mps_plan_orders WHERE itemCode = '111114213' ORDER BY id DESC`;
    console.table(result.recordset);
  } catch (err) {
    console.error(err);
  } finally {
    await sql.close();
  }
}

run();
