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
    const res = await pool.request().query("SELECT id, name, type, parentId FROM master_yield WHERE parentId IN (SELECT id FROM master_yield WHERE name LIKE '%BIL L%')");
    console.log('Children of BIL L/C CATEGORY:', res.recordset);
    
    const ids = res.recordset.map(r => r.id);
    if(ids.length > 0) {
      const res2 = await pool.request().query(`SELECT id, name, type, parentId FROM master_yield WHERE parentId IN ('${ids.join("','")}')`);
      console.log('Grandchildren:', res2.recordset);
    }
    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
