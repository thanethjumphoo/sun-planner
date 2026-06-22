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
  const labels = await ds.query(`SELECT DISTINCT col_label FROM bil_weight_distributions`);
  console.log('Matrix Col Labels:');
  console.log(labels);
  process.exit(0);
}).catch(console.error);
