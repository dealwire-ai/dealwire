import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json } from 'express';

async function bootstrap() {
  console.log(`
    ___    _   _____    __  __  ____________ 
   /   |  / | / /   |  / / /\\ \\/ /__  / ____/
  / /| | /  |/ / /| | / /  \\  /  / / / __/   
 / ___ |/ /|  / ___ |/ /___/ /  / /_/ /___   
/_/  |_/_/ |_/_/  |_/_____/_/  /___/_____/   
  `);
  console.log('Starting Nest application...');
  
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
}

bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});

