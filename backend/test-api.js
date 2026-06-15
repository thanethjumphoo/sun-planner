const { DataSource } = require('typeorm');
require('dotenv').config({ path: '.env.development' });

async function run() {
  const dataSource = new DataSource({
    type: 'mssql',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '1433'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    options: { encrypt: false, trustServerCertificate: true },
  });
  
  try {
    await dataSource.initialize();
    const result = await dataSource.query(`
      SELECT * FROM mps_plan_supply_size
      WHERE sizeName = '240-260' OR groupSize = '240-260' OR size_name = '240-260'
      ORDER BY id DESC
    `);
    console.log(result);
  } catch (err) {
    console.error(err);
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}
run();
