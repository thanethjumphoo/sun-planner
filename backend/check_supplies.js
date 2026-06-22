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
  const latestPlan = await ds.query(`SELECT TOP 1 id FROM mps_plans ORDER BY created_at DESC`);
  const planId = latestPlan[0].id;
  const supplies = await ds.query(`SELECT * FROM mps_plan_supply_size WHERE mps_plan_id = ${planId} AND size_key LIKE '%241-260%'`);
  console.log(`Supplies for plan ${planId}:`);
  console.log(supplies);
  process.exit(0);
}).catch(console.error);
