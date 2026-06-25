require('dotenv').config({path: '../.env'});
const sql = require('mssql');
async function run() {
  try {
    const pool = await sql.connect({
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      server: process.env.DB_HOST,
      database: process.env.DB_DATABASE,
      options: {encrypt: false, trustServerCertificate: true}
    });
    const res = await pool.request().query("SELECT reason FROM mps_exception_reports WHERE mpsPlanId = 6227 AND itemCode = '111119118'");
    console.log(res.recordset);
    sql.close();
  } catch(e) {
    console.error(e);
  }
}
run();
