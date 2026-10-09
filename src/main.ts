import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './config/configure-app';
import { configureSwagger } from './config/configure-swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const corsOrigins = configService
    .getOrThrow<string>('CORS_ORIGINS')
    .split(',')
    .map((origin) => origin.trim());

  // Configure global prefix, CORS, validation, and serializers
  configureApp(app, corsOrigins);

  // Configure Swagger documentation at /api/docs
  configureSwagger(app);

  app.enableShutdownHooks();

  const port = configService.getOrThrow<number>('PORT');
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
