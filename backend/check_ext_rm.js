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
  const rms = await ds.query(`SELECT DISTINCT rm_size FROM external_rm_supplies`);
  console.log('RM Sizes:');
  console.log(rms);
  process.exit(0);
}).catch(console.error);
