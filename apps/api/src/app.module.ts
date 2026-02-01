import { Module } from '@nestjs/common';
import { AppController } from './controller/app.controller';
import { MetricsController } from './controller/metrics.controller';
import { DealController } from './controller/deal.controller';
import { ContactController } from './controller/contact.controller';
import { AssetController } from './controller/asset.controller';
import { ScreeningPreferencesController } from './controller/screening-preferences.controller';
import { EmailEventController } from './controller/email-event.controller';
import { AppService } from './service/app.service';
import { PrismaModule } from './module/prisma.module';
import { WebhookModule } from './module/webhook.module';
import { MetricsModule } from './module/metrics.module';
import { EmailProcessorModule } from './module/email-processor.module';
import { NotificationsModule } from './module/notifications.module';
import { DealDigestModule } from './module/deal-digest.module';
import { ClerkAuthGuard } from './guard/clerk-auth.guard';
import { ScreeningPreferencesService } from './service/preferences/screening-preferences.service';

@Module({
  imports: [PrismaModule, WebhookModule, MetricsModule, EmailProcessorModule, NotificationsModule, DealDigestModule],
  controllers: [
    AppController,
    MetricsController,
    DealController,
    ContactController,
    AssetController,
    ScreeningPreferencesController,
    EmailEventController,
  ],
  providers: [AppService, ClerkAuthGuard, ScreeningPreferencesService],
})
export class AppModule {}
