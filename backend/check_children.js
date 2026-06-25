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
    if (bilLC.recordset.length > 0) {
        console.log("BIL L/C:", bilLC.recordset[0]);
        const children = await pool.request().query(`SELECT * FROM master_yield WHERE parentId = '${bilLC.recordset[0].id}'`);
        console.log("Children of BIL L/C:", children.recordset.length);
        console.log(children.recordset.map(c => c.name));
    }

    const bl = await pool.request().query("SELECT * FROM master_yield WHERE name LIKE '%BL Processing%'");
    if (bl.recordset.length > 0) {
        console.log("BL Processing:", bl.recordset[0]);
        const children = await pool.request().query(`SELECT * FROM master_yield WHERE parentId = '${bl.recordset[0].id}'`);
        console.log("Children of BL Processing:", children.recordset.length);
        console.log(children.recordset.map(c => c.name));
    }

    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
