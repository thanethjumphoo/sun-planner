const { DataSource } = require('typeorm');

const dataSource = new DataSource({
  type: 'mssql',
  host: '127.0.0.1',
  port: 1433,
  username: 'sa',
  password: 'Your_password123',
  database: 'sun_planner',
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
});

async function run() {
  await dataSource.initialize();
  const res = await dataSource.query(`
    SELECT * FROM mps_plan_dailies 
    WHERE production_date >= '2026-06-08' AND production_date <= '2026-06-08'
  `);
  console.log(res);
  await dataSource.destroy();
}

run().catch(console.error);
