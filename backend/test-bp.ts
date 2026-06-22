import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { DataSource } from 'typeorm';

async function test() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const ds = app.get(DataSource);
  
  const nodes = await ds.query(`SELECT id, parentId, type, name, yieldPercentage FROM master_yield`);
  console.log(`Total nodes: ${nodes.length}`);
  
  const byproducts = nodes.filter((n: any) => n.type === 'BY-PRODUCT');
  console.log(`By-products found: ${byproducts.length}`);
  for (const bp of byproducts) {
    const parent = nodes.find((n: any) => n.id === bp.parentId);
    console.log(`Byproduct: ${bp.name} (Yield: ${bp.yieldPercentage}) (ID: ${bp.id}), Parent: ${parent?.name} (ID: ${parent?.id}, Type: ${parent?.type})`);
    
    // Find the category of this byproduct
    let current = parent;
    while(current && current.type !== 'CATEGORY') {
      current = nodes.find((n: any) => n.id === current.parentId);
    }
    console.log(`  -> Category: ${current?.name}`);
  }
  
  await app.close();
}

test().catch(console.error);
