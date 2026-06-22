import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { DataSource } from 'typeorm';

async function test() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const ds = app.get(DataSource);
  
  const sizes = await ds.query(`
    SELECT DISTINCT group_size 
    FROM external_rm_supply_sizes
  `);
  console.log('External Supply Sizes:', sizes);
  
  const supply = await ds.query(`
    SELECT DISTINCT group_size 
    FROM supply_sizes
  `);
  console.log('Supply Sizes:', supply);

  await app.close();
}

test().catch(console.error);
