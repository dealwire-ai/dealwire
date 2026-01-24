import { Module } from '@nestjs/common';
import { ClerkWebhookController } from '../controller/webhook/clerk-webhook.controller';
import { ResendWebhookController } from '../controller/webhook/resend-webhook.controller';
import { ClerkWebhookService } from '../service/clerk/clerk-webhook.service';
import { ResendWebhookService } from '../service/resend/resend-webhook.service';
import { EmailModule } from './email.module';
import { AIModule } from './ai.module';
import { PrismaModule } from './prisma.module';
import { MicrosoftModule } from './microsoft.module';
import { SQSModule } from './sqs.module';
import { S3Module } from './s3.module';
import { ScreeningPreferencesService } from '../service/preferences/screening-preferences.service';

@Module({
  imports: [EmailModule, AIModule, PrismaModule, MicrosoftModule, SQSModule, S3Module],
  controllers: [ClerkWebhookController, ResendWebhookController],
  providers: [ClerkWebhookService, ResendWebhookService, ScreeningPreferencesService],
})
export class WebhookModule {}

