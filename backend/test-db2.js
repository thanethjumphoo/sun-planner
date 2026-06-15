const sql = require('mssql');
require('dotenv').config({ path: '.env.development' });

async function run() {
  try {
    const config = {
      user: process.env.DB_USER || process.env.DB_USERNAME,
      password: process.env.DB_PASS || process.env.DB_PASSWORD,
      server: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '1433'),
      database: process.env.DB_NAME || process.env.DB_DATABASE,
      options: {
        encrypt: true,
        trustServerCertificate: true,
      },
    };

    const pool = await sql.connect(config);
    
    // Query Product Spec for 111114213
    const specResult = await pool.request().query(`
      SELECT erpItemCode, erpItemDesc, productSize, icutSpeed, productYield, productType
      FROM product_specs 
      WHERE erpItemCode = '111114213' OR erpItemCode = '111114212'
    `);
    console.log("=== Product Specs ===");
    console.table(specResult.recordset);

    const mpsOrderResult = await pool.request().query(`
      SELECT TOP 10 o.itemCode, o.itemDesc, o.quantityKg, o.soNumber, o.plannedProductionDate
      FROM mps_plan_orders o
      WHERE o.itemCode IN ('111114212', '111114213')
      ORDER BY o.createdAt DESC
    `);
    console.log("=== MPS Plan Orders ===");
    console.table(mpsOrderResult.recordset);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
