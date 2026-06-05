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
  const res = await dataSource.query(`SELECT sublot, shift, receive_date FROM chicken_receiving_plan_daily WHERE sublot='09'`);
  console.log(res);
  await dataSource.destroy();
}

run().catch(console.error);
