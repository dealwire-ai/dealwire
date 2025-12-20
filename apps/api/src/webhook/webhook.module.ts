import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { EmailModule } from '../email/email.module';
import { AIModule } from '../ai/ai.module';
import { ClientPreferencesService } from '../config/client-preferences.service';

@Module({
  imports: [EmailModule, AIModule],
  controllers: [WebhookController],
  providers: [ClientPreferencesService],
})
export class WebhookModule {}
