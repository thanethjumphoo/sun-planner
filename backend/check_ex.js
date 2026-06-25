const sql = require('mssql');
require('dotenv').config({path: '../.env'});

async function run() {
  try {
    const pool = await sql.connect({
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      server: process.env.DB_HOST,
      database: process.env.DB_DATABASE,
      options: { encrypt: false, trustServerCertificate: true }
    });
    const result = await pool.request().query("SELECT * FROM mps_exception_reports WHERE mpsPlanId = 6227 AND itemCode = '111119118'");
    console.log(result.recordset);
    sql.close();
  } catch (err) {
    console.error(err);
  }
}
run();
