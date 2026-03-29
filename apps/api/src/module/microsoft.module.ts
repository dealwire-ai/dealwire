import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MicrosoftGraphService } from '../service/microsoft/microsoft-graph.service';
import { MicrosoftSubscriptionService } from '../service/microsoft/microsoft-subscription.service';
import { MicrosoftWebhookService } from '../service/microsoft/microsoft-webhook.service';
import { MicrosoftRenewalSchedulerService } from '../service/microsoft/microsoft-renewal-scheduler.service';
import { MicrosoftWebhookController } from '../controller/webhook/microsoft-webhook.controller';
import { PrismaModule } from './prisma.module';
import { SqsModule } from './sqs.module';
import { S3Module } from './s3.module';
import { DealAnalysisModule } from './ai.module';
import { PreferencesModule } from './preferences.module';

@Module({
  imports: [
    PrismaModule,
    ScheduleModule,
    SqsModule, // For SQSService (was EmailProcessorModule — broke circular dep)
    S3Module,
    DealAnalysisModule, // For DealDetectionService
    PreferencesModule, // For ScreeningPreferencesService
  ],
  controllers: [MicrosoftWebhookController],
  providers: [
    MicrosoftGraphService,
    MicrosoftSubscriptionService,
    MicrosoftWebhookService,
    MicrosoftRenewalSchedulerService,
  ],
  exports: [MicrosoftGraphService, MicrosoftSubscriptionService],
})
export class MicrosoftModule {}
