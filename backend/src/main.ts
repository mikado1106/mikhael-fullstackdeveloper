import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createApp } from './bootstrap';
import type { EnvConfig } from './config/env.validation';

async function bootstrap(): Promise<void> {
  const app = await createApp();
  app.enableShutdownHooks();

  const port = app.get(ConfigService<EnvConfig, true>).get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(`API listening on http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
