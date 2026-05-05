import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SqsModule } from '@ssut/nestjs-sqs';
import { AppController } from './controller/app.controller';
import { FeatureFlagsController } from './controller/feature-flags.controller';
import { AppService } from './service/app.service';
import { ClerkAuthGuard } from './guard/clerk-auth.guard';
import { PrismaModule } from './module/prisma.module';
import { MetricsModule } from './module/metrics.module';
import { LlmObservabilityModule } from './module/llm-observability.module';
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
import { UnderwritingModule } from './module/underwriting.module';
import { CorrelationIdMiddleware } from './middleware/correlation-id.middleware';
import { sqsConfig } from './config/sqs.config';

// SqsModule is registered directly (not via a wrapper module). The lib's
// @ssut/nestjs-sqs SqsModule is already @Global(); wrapping it inside another
// module created two SqsModule instances and confused @golevelup discovery,
// so the @SqsMessageHandler-decorated methods were never wired to the
// consumer. Producers worked because they're populated directly from the
// register() options, but consumers silently never started polling.
//
// Gating on RAILWAY_ENVIRONMENT_NAME (not NODE_ENV) keeps PR environments
// off the prod queues. Railway sets RAILWAY_ENVIRONMENT_NAME per environment
// and never inherits it across env-var copies, so it's the only reliable
// signal that we're actually running in production. NODE_ENV is "production"
// in PR envs too because they run the production build, which is what made
// 26 PR replicas all race the prod consumer for the same queue.
const enableSqs =
  process.env.ENABLE_SQS === 'true' ||
  process.env.RAILWAY_ENVIRONMENT_NAME === 'production';

const sqsImports = enableSqs
  ? [
      SqsModule.register({
        consumers: [
          {
            name: 'normalized-email',
            queueUrl: sqsConfig().normalizedEmailQueueUrl,
            region: sqsConfig().region,
            waitTimeSeconds: 5,
            visibilityTimeout: 300,
          },
          {
            name: 'underwriting',
            queueUrl: sqsConfig().underwritingQueueUrl,
            region: sqsConfig().region,
            waitTimeSeconds: 5,
            visibilityTimeout: 600,
          },
        ],
        producers: [
          {
            name: 'normalized-email',
            queueUrl: sqsConfig().normalizedEmailQueueUrl,
            region: sqsConfig().region,
          },
          {
            name: 'underwriting',
            queueUrl: sqsConfig().underwritingQueueUrl,
            region: sqsConfig().region,
          },
        ],
      }),
    ]
  : [];

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ...sqsImports,
    PrismaModule,
    MetricsModule,
    LlmObservabilityModule,
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
