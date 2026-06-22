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
  const exceptions = await ds.query(`SELECT TOP 5 * FROM mps_exception_reports WHERE item_code = '111114213' ORDER BY created_at DESC`);
  console.log('Exceptions for 111114213:');
  console.log(exceptions);
  process.exit(0);
}).catch(console.error);
