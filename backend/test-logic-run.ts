import { DataSource } from 'typeorm';
import { AppModule } from './src/app.module';
import { NestFactory } from '@nestjs/core';
import { executeUnifiedLegPlanGeneration } from './src/unified-leg-logic.helper';
// no mps.service

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const ds = app.get(DataSource);
  
  console.log('Generating unified leg plan...');
  const res = await executeUnifiedLegPlanGeneration({
    startStr: '2026-06-01',
    endStr: '2026-06-30',
    workingDays: 26,
    simulateOnly: true
  } as any, ds.manager, {
    erpOrderLineRepo: ds.getRepository('StgErpOrderLine'),
    masterYieldRepo: ds.getRepository('MasterYield'),
    productSpecRepo: ds.getRepository('ProductSpec')
  } as any);
  
  console.log('Finished');
  await app.close();
}
run().catch(e => { console.error('CRASH:', e); process.exit(1); });
