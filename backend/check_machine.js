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

    const conf = await pool.request().query("SELECT * FROM machine_configurations WHERE is_active = 1");
    console.log(conf.recordset);

    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
