import { Module } from '@nestjs/common';
import { EmailProcessorService } from '../service/email/email-processor.service';
import { NormalizedEmailListenerService } from '../service/email/normalized-email-listener.service';
import { SQSService } from '../service/sqs/sqs.service';
import { DealAnalysisModule } from './ai.module';
import { AgentModule } from './agent.module';
import { EmailServicesModule } from './email.module';
import { PrismaModule } from './prisma.module';
import { MicrosoftModule } from './microsoft.module';
import { S3Module } from './s3.module';
import { NotificationsModule } from './notifications.module';
import { PreferencesModule } from './preferences.module';

@Module({
  imports: [
    DealAnalysisModule,
    AgentModule,
    EmailServicesModule,
    PrismaModule,
    S3Module,
    NotificationsModule,
    PreferencesModule,
    MicrosoftModule,
  ],
  providers: [
    EmailProcessorService,
    NormalizedEmailListenerService,
    SQSService,
  ],
  exports: [EmailProcessorService, SQSService],
})
export class EmailProcessorModule {}
