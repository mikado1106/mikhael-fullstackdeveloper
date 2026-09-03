import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import type { Express } from 'express';
import { AppModule } from './app.module';
import type { EnvConfig } from './config/env.validation';

// Shared by the long-running server (main.ts) and the serverless entry point
// (api/), so both apply exactly the same prefix, CORS and validation rules.
export async function createApp(server?: Express): Promise<INestApplication> {
  const app = server
    ? await NestFactory.create(AppModule, new ExpressAdapter(server))
    : await NestFactory.create(AppModule);

  const config = app.get(ConfigService<EnvConfig, true>);

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: config
      .get('CORS_ORIGIN', { infer: true })
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  });

  // Reject unknown fields and coerce primitives so DTOs are the single source of truth.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  return app;
}
