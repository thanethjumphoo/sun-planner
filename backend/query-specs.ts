import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

const AppDataSource = new DataSource({
  type: 'mssql',
  host: process.env.DB_HOST,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  options: { encrypt: true, trustServerCertificate: true },
});

async function run() {
  await AppDataSource.initialize();
  const specs = await AppDataSource.query(`
    SELECT id, name, parent_id, type, yield_percentage 
    FROM master_yield 
    WHERE name LIKE N'%หนัง%'
  `);
  console.log('Nodes:', specs);
  process.exit();
}
run();
