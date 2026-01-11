import { Module } from '@nestjs/common';
import { AppController } from './controller/app.controller';
import { MetricsController } from './controller/metrics.controller';
import { AppService } from './service/app.service';
import { PrismaModule } from './module/prisma.module';
import { WebhookModule } from './module/webhook.module';
import { MetricsModule } from './module/metrics.module';
import { EmailProcessorModule } from './module/email-processor.module';

@Module({
  imports: [PrismaModule, WebhookModule, MetricsModule, EmailProcessorModule],
  controllers: [AppController, MetricsController],
  providers: [AppService],
})
export class AppModule {}
