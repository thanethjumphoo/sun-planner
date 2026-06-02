import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { DataSource } from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  const allMonthlyIntakesRaw = await dataSource.query(`
    SELECT * FROM chicken_receiving_plan_monthly
    WHERE receive_date >= '2026-05-31' AND receive_date <= '2026-06-30'
  `);

  const allWeeklyIntakesRaw = await dataSource.query(`
    SELECT * FROM chicken_receiving_plan_weekly
    WHERE receive_date >= '2026-05-31' AND receive_date <= '2026-06-30'
  `);

  const parseLocalDate = (val: any): string | null => {
    if (!val) return null;
    if (typeof val === 'string') return val.split('T')[0];
    if (val instanceof Date) {
      return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}-${String(val.getDate()).padStart(2, '0')}`;
    }
    return null;
  };

  const monthlySums: Record<string, number> = {};
  allMonthlyIntakesRaw.forEach((m: any) => {
    const d = parseLocalDate(m.receive_date);
    if (!d) return;
    monthlySums[d] = (monthlySums[d] || 0) + Number(m.chicken_count || 0);
  });

  const weeklySums: Record<string, number> = {};
  allWeeklyIntakesRaw.forEach((w: any) => {
    const d = parseLocalDate(w.receive_date);
    if (!d) return;
    weeklySums[d] = (weeklySums[d] || 0) + Number(w.chicken_count || 0);
  });

  console.log('--- DATE COMPARISON ---');
  console.log('Date | Monthly Birds | Weekly Birds');
  for (let i = 1; i <= 7; i++) {
    const d = `2026-06-0${i}`;
    console.log(`${d} | ${monthlySums[d] || 0} | ${weeklySums[d] || 0}`);
  }

  await app.close();
}
bootstrap();
