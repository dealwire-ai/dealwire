import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MicrosoftGraphService } from '../service/microsoft/microsoft-graph.service';
import { MicrosoftSubscriptionService } from '../service/microsoft/microsoft-subscription.service';
import { MicrosoftWebhookService } from '../service/microsoft/microsoft-webhook.service';
import { MicrosoftSchedulerService } from '../service/microsoft/microsoft-scheduler.service';
import { MicrosoftWebhookController } from '../controller/webhook/microsoft-webhook.controller';
import { PrismaModule } from './prisma.module';
import { EmailModule } from './email.module';
import { AIModule } from './ai.module';
import { ClientPreferencesService } from '../service/preferences/client-preferences.service';

@Module({
  imports: [PrismaModule, EmailModule, AIModule, ScheduleModule.forRoot()],
  controllers: [MicrosoftWebhookController],
  providers: [
    MicrosoftGraphService,
    MicrosoftSubscriptionService,
    MicrosoftWebhookService,
    MicrosoftSchedulerService,
    ClientPreferencesService,
  ],
  exports: [MicrosoftGraphService, MicrosoftSubscriptionService],
})
export class MicrosoftModule {}

