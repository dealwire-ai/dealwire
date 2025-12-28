import { Module } from '@nestjs/common';
import { ClerkWebhookController } from '../controller/webhook/clerk-webhook.controller';
import { ResendWebhookController } from '../controller/webhook/resend-webhook.controller';
import { ClerkWebhookService } from '../service/clerk/clerk-webhook.service';
import { ResendWebhookService } from '../service/resend/resend-webhook.service';
import { EmailModule } from './email.module';
import { AIModule } from './ai.module';
import { PrismaModule } from './prisma.module';
import { MicrosoftModule } from './microsoft.module';
import { ClientPreferencesService } from '../service/preferences/client-preferences.service';

@Module({
  imports: [EmailModule, AIModule, PrismaModule, MicrosoftModule],
  controllers: [ClerkWebhookController, ResendWebhookController],
  providers: [ClerkWebhookService, ResendWebhookService, ClientPreferencesService],
})
export class WebhookModule {}

