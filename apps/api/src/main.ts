import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port);

  // test
  console.log(`🚀 API running on http://localhost:${port}`);
}
bootstrap();

