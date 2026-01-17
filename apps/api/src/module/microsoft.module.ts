import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MicrosoftGraphService } from '../service/microsoft/microsoft-graph.service';
import { MicrosoftSubscriptionService } from '../service/microsoft/microsoft-subscription.service';
import { MicrosoftWebhookService } from '../service/microsoft/microsoft-webhook.service';
import { MicrosoftRenewalSchedulerService } from '../service/microsoft/microsoft-renewal-scheduler.service';
import { MicrosoftWebhookController } from '../controller/webhook/microsoft-webhook.controller';
import { PrismaModule } from './prisma.module';
import { EmailProcessorModule } from './email-processor.module';
import { S3Module } from './s3.module';
import { AIModule } from './ai.module';
import { ScreeningPreferencesService } from '../service/preferences/screening-preferences.service';

@Module({
  imports: [
    PrismaModule,
    ScheduleModule.forRoot(),
    EmailProcessorModule, // For SQSService
    S3Module, // For S3Service
    AIModule, // For DealDetectionService
  ],
  controllers: [MicrosoftWebhookController],
  providers: [
    MicrosoftGraphService,
    MicrosoftSubscriptionService,
    MicrosoftWebhookService,
    MicrosoftRenewalSchedulerService,
    ScreeningPreferencesService,
  ],
  exports: [MicrosoftGraphService, MicrosoftSubscriptionService, ScreeningPreferencesService],
})
export class MicrosoftModule {}

