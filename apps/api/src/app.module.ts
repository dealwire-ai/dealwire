import { Module } from '@nestjs/common';
import { AppController } from './controller/app.controller';
import { MetricsController } from './controller/metrics.controller';
import { DealController } from './controller/deal.controller';
import { ContactController } from './controller/contact.controller';
import { AssetController } from './controller/asset.controller';
import { ScreeningPreferencesController } from './controller/screening-preferences.controller';
import { ScreeningBucketController } from './controller/screening-bucket.controller';
import { ChatController } from './controller/chat.controller';
import { AppService } from './service/app.service';
import { PrismaModule } from './module/prisma.module';
import { WebhookModule } from './module/webhook.module';
import { MetricsModule } from './module/metrics.module';
import { EmailProcessorModule } from './module/email-processor.module';
import { NotificationsModule } from './module/notifications.module';
import { DealDigestModule } from './module/deal-digest.module';
import { AgentModule } from './module/agent.module';
import { IngestionModule } from './module/ingestion.module';
import { ClerkAuthGuard } from './guard/clerk-auth.guard';
import { ScreeningPreferencesService } from './service/preferences/screening-preferences.service';
import { ScreeningBucketService } from './service/preferences/screening-bucket.service';
import { BrokerIntelligenceService } from './service/deal/broker-intelligence.service';

@Module({
  imports: [PrismaModule, WebhookModule, MetricsModule, EmailProcessorModule, NotificationsModule, DealDigestModule, AgentModule, IngestionModule],
  controllers: [
    AppController,
    MetricsController,
    DealController,
    ContactController,
    AssetController,
    ScreeningPreferencesController,
    ScreeningBucketController,
    ChatController,
  ],
  providers: [AppService, ClerkAuthGuard, ScreeningPreferencesService, ScreeningBucketService, BrokerIntelligenceService],
})
export class AppModule {}
