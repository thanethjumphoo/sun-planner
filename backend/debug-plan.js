const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { MpsPlanOrder } = require('./dist/mps-plan.entity');
const { getRepository } = require('typeorm');

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const mpsRepo = app.get('MpsPlanOrderRepository'); // wait, I can use Connection or DataSource
  const ds = app.get('DataSource');
  
  const orders = await ds.getRepository(MpsPlanOrder).find({
    where: { soNumber: '1411062600486' }
  });
  
  console.log('FOUND IN PLAN:', orders);
  
  await app.close();
}
bootstrap();
