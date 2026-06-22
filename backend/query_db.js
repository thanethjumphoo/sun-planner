require('dotenv').config();
const { DataSource } = require('typeorm');
const ds = new DataSource({
  type: 'mssql',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  options: { encrypt: false }
});
ds.initialize().then(async () => {
  const res = await ds.query(`SELECT * FROM stg_product_spec WHERE erpItemCode = '111114213'`);
  console.log(res);
  process.exit(0);
}).catch(console.error);
