import { DataSource } from 'typeorm';
import { AppModule } from './src/app.module';
import { NestFactory } from '@nestjs/core';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const ds = app.get(DataSource);
  const res = await ds.query(`SELECT ERP_ITEM_CODE, MASTER_YIELD_IDS FROM product_specs WHERE ERP_ITEM_CODE = '111119118'`);
  console.log(res);
  await app.close();
}
run().catch(console.error);
