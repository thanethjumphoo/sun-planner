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
  // Delete allocations first
  await dataSource.query(`DELETE FROM dps_allocations`);
  // Delete sublot bins
  await dataSource.query(`DELETE FROM dps_sublot_bins`);
  // Delete sublots
  await dataSource.query(`DELETE FROM dps_sublots`);
  // Delete orders
  await dataSource.query(`DELETE FROM dps_orders`);
  // Delete plans
  await dataSource.query(`DELETE FROM dps_plans`);
  console.log('Cleared all DPS plans');
  await dataSource.destroy();
}

run().catch(console.error);
