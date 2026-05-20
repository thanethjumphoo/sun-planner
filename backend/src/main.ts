import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const corsOrigin = configService.get<string>('CORS_ORIGIN');

  if (corsOrigin) {
    app.enableCors({ origin: corsOrigin, credentials: true });
  } else {
    app.enableCors(); // Enable CORS
  }

  const port = configService.get<number>('PORT') || process.env.PORT || 3333;
  await app.listen(port);
}
bootstrap();
