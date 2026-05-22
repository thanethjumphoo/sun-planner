const { DataSource } = require('typeorm');

const dataSource = new DataSource({
  type: 'mssql', // or whatever they are using
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 1433,
  username: 'sa',
  password: 'Your_password123',
  database: 'sun_planner',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
});

async function run() {
  await dataSource.initialize();
  
  const headers = await dataSource.query(`SELECT COUNT(*) as count FROM stg_erp_order_headers`);
  console.log('Headers:', headers[0].count);

  const lines = await dataSource.query(`SELECT COUNT(*) as count FROM stg_erp_order_lines`);
  console.log('Lines:', lines[0].count);

  await dataSource.destroy();
}

run().catch(console.error);
