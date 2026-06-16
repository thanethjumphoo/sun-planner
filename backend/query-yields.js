const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { MasterYield } = require('./dist/master-yield.entity');
const { getRepositoryToken } = require('@nestjs/typeorm');

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const repo = app.get(getRepositoryToken(MasterYield));
  const yields = await repo.find({ where: { type: 'CATEGORY' } });
  console.log(JSON.stringify(yields, null, 2));
  await app.close();
}

run().catch(console.error);
