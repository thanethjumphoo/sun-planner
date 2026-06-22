import { DataSource } from 'typeorm';
import { AppModule } from './src/app.module';
import { NestFactory } from '@nestjs/core';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const ds = app.get(DataSource);
  
  // Find recent orders for November 2026
  const orders = await ds.query(`
    SELECT top 20 o.ERP_ORDER_NUMBER, o.ERP_ITEM_CODE, o.ERP_ITEM_DESC, o.ERP_ORDER_ITEM_QTY, o.ERP_ORDER_SHIP_DATE, p.MASTER_YIELD_IDS
    FROM stg_erp_order_lines o
    LEFT JOIN product_specs p ON o.ERP_ITEM_CODE = p.ERP_ITEM_CODE
    WHERE o.ERP_ITEM_DESC LIKE 'BIL%' AND o.ERP_ORDER_SHIP_DATE >= '2026-11-01'
  `);
  
  for (const o of orders) {
    if (!o.MASTER_YIELD_IDS) continue;
    const ids = o.MASTER_YIELD_IDS.split(',');
    for (const id of ids) {
      const yieldNode = await ds.query(`SELECT name, type FROM master_yield WHERE id = '${id.trim()}'`);
      if (yieldNode.length > 0) {
        console.log(`Order: ${o.ERP_ITEM_DESC} (Qty: ${o.ERP_ORDER_ITEM_QTY}) -> Yield: ${yieldNode[0].name} (${yieldNode[0].type})`);
      }
    }
  }
  
  await app.close();
}
run().catch(console.error);
