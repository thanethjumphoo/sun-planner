import { DataSource } from 'typeorm';
import { AppModule } from './src/app.module';
import { NestFactory } from '@nestjs/core';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const ds = app.get(DataSource);
  const res = await ds.query(`SELECT TOP 10 item_code, master_yield_ids FROM product_specs WHERE item_code LIKE 'BIL%'`);
  console.log(res);
  await app.close();
}
run().catch(console.error);
