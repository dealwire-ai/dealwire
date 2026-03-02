import { Module } from '@nestjs/common';
import { ClerkWebhookController } from '../controller/webhook/clerk-webhook.controller';
import { ResendWebhookController } from '../controller/webhook/resend-webhook.controller';
import { ClerkWebhookService } from '../service/clerk/clerk-webhook.service';
import { ResendWebhookService } from '../service/resend/resend-webhook.service';
import { UnderwritingInboundService } from '../service/underwriting/underwriting-inbound.service';
import { ScreeningInboundService } from '../service/screening/screening-inbound.service';
import { EmailServicesModule } from './email.module';
import { DealAnalysisModule } from './ai.module';
import { PrismaModule } from './prisma.module';
import { MicrosoftModule } from './microsoft.module';
import { SQSModule } from './sqs.module';
import { S3Module } from './s3.module';
import { PreferencesModule } from './preferences.module';
import { AgentModule } from './agent.module';

@Module({
  imports: [EmailServicesModule, DealAnalysisModule, PrismaModule, MicrosoftModule, SQSModule, S3Module, PreferencesModule, AgentModule],
  controllers: [ClerkWebhookController, ResendWebhookController],
  providers: [ClerkWebhookService, ResendWebhookService, UnderwritingInboundService, ScreeningInboundService],
})
export class WebhookModule {}
