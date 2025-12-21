import { Module } from '@nestjs/common';
import { AppController } from './controller/app.controller';
import { AppService } from './service/app.service';
import { PrismaModule } from './module/prisma.module';
import { WebhookModule } from './module/webhook.module';

@Module({
  imports: [PrismaModule, WebhookModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
