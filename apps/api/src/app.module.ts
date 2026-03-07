import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './controller/app.controller';
import { FeatureFlagsController } from './controller/feature-flags.controller';
import { AppService } from './service/app.service';
import { ClerkAuthGuard } from './guard/clerk-auth.guard';
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
import { PublicDataModule } from './module/public-data.module';
import { SqsRegistrationModule } from './module/sqs-registration.module';
import { UnderwritingModule } from './module/underwriting.module';
import { CorrelationIdMiddleware } from './middleware/correlation-id.middleware';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    SqsRegistrationModule,
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
    PublicDataModule,
    UnderwritingModule,
  ],
  controllers: [AppController, FeatureFlagsController],
  providers: [AppService, ClerkAuthGuard],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*path');
  }
}
