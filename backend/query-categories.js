const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const manager = app.get('DataSource').manager;
  const yields = await manager.query("SELECT * FROM master_yield WHERE type = 'CATEGORY'");
  console.log(JSON.stringify(yields, null, 2));
  await app.close();
}

run().catch(console.error);
