import { Module } from '@nestjs/common';
import { AppController } from './controller/app.controller';
import { MetricsController } from './controller/metrics.controller';
import { DealController } from './controller/deal.controller';
import { EmailEventController } from './controller/email-event.controller';
import { AppService } from './service/app.service';
import { PrismaModule } from './module/prisma.module';
import { WebhookModule } from './module/webhook.module';
import { MetricsModule } from './module/metrics.module';
import { EmailProcessorModule } from './module/email-processor.module';
import { NotificationsModule } from './module/notifications.module';

@Module({
  imports: [PrismaModule, WebhookModule, MetricsModule, EmailProcessorModule, NotificationsModule],
  controllers: [AppController, MetricsController, DealController, EmailEventController],
  providers: [AppService],
})
export class AppModule {}
