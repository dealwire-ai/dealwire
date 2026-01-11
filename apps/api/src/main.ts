// MUST be first import - initializes OTEL before NestJS
import './instrumentation';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json } from 'express';

async function bootstrap() {
  console.log('Starting Nest application...');
  
  try {
    const app = await NestFactory.create(AppModule, {
      rawBody: true,
      logger: ['error', 'warn', 'log'],
    });

  // Enable JSON parsing with raw body for webhook verification
  app.use(
    json({
      verify: (req: any, res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

    const port = process.env.PORT ? Number(process.env.PORT) : 3001;
    await app.listen(port, '0.0.0.0');

    console.log(`🚀 API running on port ${port}`);
    console.log(`📊 Metrics available at http://localhost:9464/metrics`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('Failed to start application:', msg);
    if (stack) {
      console.error(stack);
    }
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  console.error('Unhandled promise rejection:', msg);
  // Don't exit - let the app try to continue
});

bootstrap().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('Failed to start application:', msg);
  process.exit(1);
});

