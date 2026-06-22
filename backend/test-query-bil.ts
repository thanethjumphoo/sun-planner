import { DataSource } from 'typeorm';
import { AppModule } from './src/app.module';
import { NestFactory } from '@nestjs/core';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const ds = app.get(DataSource);
  const res = await ds.query(`SELECT TOP 5 ERP_ITEM_CODE, ERP_ITEM_DESC, MASTER_YIELD_IDS FROM product_specs WHERE ERP_ITEM_CODE LIKE '111111%'`);
  console.log(res);
  await app.close();
}
run().catch(console.error);
