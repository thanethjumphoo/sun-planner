const sql = require('mssql');
const config = {
  user: 'sa',
  password: 'Your_password123',
  server: '127.0.0.1',
  database: 'sun_planner',
  options: { encrypt: false, trustServerCertificate: true }
};
sql.connect(config).then(pool => {
  return pool.request().query("SELECT TOP 10 erp_item_code, erp_item_desc, product_type, min_product_lead, max_product_lead FROM product_specs WHERE product_type = 'FREEZE' AND erp_item_code LIKE '%17%'");
}).then(result => {
  console.log(result.recordset);
  process.exit(0);
}).catch(err => {
  console.log(err);
  process.exit(1);
});
