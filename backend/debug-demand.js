const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { OracleIntegrationService } = require('./dist/oracle-integration.service');

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const oracleService = app.get(OracleIntegrationService);

  console.log('Fetching demand orders...');
  const shipStartDate = new Date(2026, 2, 1).toISOString(); // March 1, 2026
  const shipEndDate = new Date(2026, 7, 0).toISOString(); // July 31, 2026

  const headers = await oracleService.getDemandOrders({
    shipStartDate,
    shipEndDate,
  });

  console.log(`Fetched ${headers.length} headers`);
  const targetHeader = headers.find(h => h.erpOrderNumber === '1411062600486');
  if (targetHeader) {
    console.log('FOUND TARGET HEADER:', JSON.stringify(targetHeader, null, 2));
  } else {
    console.log('TARGET HEADER NOT FOUND in getDemandOrders!');
  }

  await app.close();
}
bootstrap();
