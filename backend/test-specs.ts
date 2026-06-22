import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { DataSource } from 'typeorm';

async function test() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const ds = app.get(DataSource);
  
  const specs = await ds.query(`
    SELECT top 5 erp_item_code, product_size, erp_item_desc 
    FROM product_specs 
    WHERE erp_item_code = '111111140'
  `);
  console.log('Specs:', specs);
  
  await app.close();
}

test().catch(console.error);
