require('dotenv').config({path: '.env'});
const sql = require('mssql');
async function run() {
  try {
    const pool = await sql.connect({
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      server: process.env.DB_HOST,
      database: process.env.DB_NAME,
      options: {encrypt: false, trustServerCertificate: true}
    });

    const supplies = await pool.request().query("SELECT production_date, by_products FROM mps_plan_supply WHERE mps_plan_id = 6235 ORDER BY production_date");
    let hasByproducts = false;
    for (const sup of supplies.recordset) {
       if (sup.by_products) {
           hasByproducts = true;
           console.log(`Date: ${sup.production_date.toISOString().split('T')[0]}, has byproducts! Keys: ${Object.keys(JSON.parse(sup.by_products)).length}`);
       } else {
           // console.log(`Date: ${sup.production_date.toISOString().split('T')[0]}, null`);
       }
    }

    if (!hasByproducts) {
       console.log("NO BYPRODUCTS GENERATED FOR ANY DATE IN PLAN 6235!");
    }

    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
