import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { DataSource } from 'typeorm';

async function test() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const ds = app.get(DataSource);
  
  const masterYieldRepo = ds.getRepository('MasterYield');
  const bilChildren = await masterYieldRepo.find({ where: { parentId: '25C3423E-F36B-1410-8FBD-004B1A6D4ABE' } });
  console.log('BIL Children:', bilChildren.map((c: any) => ({ id: c.id, name: c.name, type: c.type })));
  await app.close();
}

test().catch(console.error);
