import { Module } from '@nestjs/common';
import { AppController } from './controller/app.controller';
import { MetricsController } from './controller/metrics.controller';
import { AppService } from './service/app.service';
import { PrismaModule } from './module/prisma.module';
import { WebhookModule } from './module/webhook.module';
import { MetricsModule } from './module/metrics.module';

@Module({
  imports: [PrismaModule, WebhookModule, MetricsModule],
  controllers: [AppController, MetricsController],
  providers: [AppService],
})
export class AppModule {}
