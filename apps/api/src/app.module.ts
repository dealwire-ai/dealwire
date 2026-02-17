import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './controller/app.controller';
import { AppService } from './service/app.service';
import { PrismaModule } from './module/prisma.module';
import { MetricsModule } from './module/metrics.module';
import { PreferencesModule } from './module/preferences.module';
import { DealModule } from './module/deal.module';
import { ContactModule } from './module/contact.module';
import { AssetModule } from './module/asset.module';
import { AgentModule } from './module/agent.module';
import { WebhookModule } from './module/webhook.module';
import { EmailProcessorModule } from './module/email-processor.module';
import { NotificationsModule } from './module/notifications.module';
import { DealDigestModule } from './module/deal-digest.module';
import { IngestionModule } from './module/ingestion.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    MetricsModule,
    PreferencesModule,
    DealModule,
    ContactModule,
    AssetModule,
    AgentModule,
    WebhookModule,
    EmailProcessorModule,
    NotificationsModule,
    DealDigestModule,
    IngestionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
