import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { DataSource } from 'typeorm';

async function test() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const ds = app.get(DataSource);
  
  // Find recent LEG plans
  const plans = await ds.query(`SELECT id, part_type, target_month FROM mps_plans WHERE part_type = 'leg' ORDER BY id DESC`);
  console.log('Recent LEG plans:', plans);
  
  if (plans.length > 0) {
    const planId = plans[0].id;
    const orders = await ds.query(`
      SELECT o.id, o.item_code, o.item_desc, o.product_type, o.quantity_kg, o.planned_production_date
      FROM mps_plan_orders o
      WHERE o.mps_plan_id = ${planId}
      ORDER BY o.id ASC
    `);
    
    let bilCount = 0;
    let blCount = 0;
    
    orders.forEach((o: any) => {
      const desc = (o.item_desc || '').toUpperCase();
      const isBl = desc.includes('BL ') || desc.includes('BLK') || desc.includes('BL-') || desc.startsWith('BL');
      if (isBl) blCount++; else bilCount++;
    });
    
    console.log(`Plan ID ${planId} has ${orders.length} orders. BIL: ${bilCount}, BL: ${blCount}`);
    if (bilCount > 0) {
      console.log('Sample BIL orders:', orders.filter((o: any) => {
        const desc = (o.item_desc || '').toUpperCase();
        return !(desc.includes('BL ') || desc.includes('BLK') || desc.includes('BL-') || desc.startsWith('BL'));
      }).slice(0, 5));
    }
  }
  
  await app.close();
}

test().catch(console.error);
