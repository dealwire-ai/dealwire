import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json } from 'express';
import { JsonLogger } from './util/json-logger';

async function bootstrap() {
  const jsonLogger = new JsonLogger();
  jsonLogger.setLogLevels(['error', 'warn', 'log']);

  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: jsonLogger,
  });

  // Enable JSON parsing with raw body for webhook verification
  app.use(
    json({
      verify: (req: any, res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  // Enable CORS for frontend requests
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port, '0.0.0.0');

  jsonLogger.log(`🚀 API running on port ${port}`, 'Bootstrap');
  jsonLogger.log(
    `✅ Health check available at http://0.0.0.0:${port}/health`,
    'Bootstrap',
  );
}

bootstrap().catch((err) => {
  const errorMessage = err instanceof Error ? err.message : String(err);
  const errorStack = err instanceof Error ? err.stack : undefined;
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      context: 'Bootstrap',
      message: `Failed to start application: ${errorMessage}`,
      trace: errorStack,
    }),
  );
  process.exit(1);
});
