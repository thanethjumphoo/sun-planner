require('dotenv').config();
const sql = require('mssql');

const config = {
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

async function run() {
  try {
    let pool = await sql.connect(config);
    const spec = await pool.request().query("SELECT id, master_yield_ids, product_type, erp_item_code, part_type FROM product_spec WHERE erp_item_code = '111119118'");
    console.log("Spec 111119118:", spec.recordset);
    
    // Also check how getItemCodesByPartType works!
    const test = await pool.request().query("SELECT id, master_yield_ids, product_type, erp_item_code, part_type FROM product_spec WHERE part_type = 'bil' OR part_type = 'bl'");
    console.log("Specs for bil/bl:", test.recordset.length);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

run();
