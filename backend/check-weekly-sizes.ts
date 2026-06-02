import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { DataSource } from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);
  
  const sizes = await dataSource.query(`
    SELECT * FROM chicken_receiving_plan_weekly_size
    WHERE receive_date = '2026-06-04' OR receive_date = '2026-06-03'
  `);
  
  console.log('--- WEEKLY SIZES ---');
  console.log('Total rows:', sizes.length);
  const map = new Map<string, number>();
  sizes.forEach((s: any) => {
    map.set(s.group_size, (map.get(s.group_size) || 0) + Number(s.quantity_kg));
  });
  console.log(map);
  
  await app.close();
}
bootstrap();
