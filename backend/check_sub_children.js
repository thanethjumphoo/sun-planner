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

    const bilLC = await pool.request().query("SELECT * FROM master_yield WHERE name LIKE '%BIL L/C%'");
    const children = await pool.request().query(`SELECT * FROM master_yield WHERE parentId = '${bilLC.recordset[0].id}'`);
    
    for (const child of children.recordset) {
       console.log(`\nChildren of ${child.name}:`);
       const subChildren = await pool.request().query(`SELECT * FROM master_yield WHERE parentId = '${child.id}'`);
       console.log(subChildren.recordset.map(c => c.name));
    }

    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
