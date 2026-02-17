import { Module } from '@nestjs/common';
import { SqsModule, SqsService } from '@ssut/nestjs-sqs';
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
import { sqsConfig } from '../config/sqs.config';

// Only enable SQS in production or when explicitly configured
const enableSqs = process.env.ENABLE_SQS === 'true' || process.env.NODE_ENV === 'production';

const sqsImports = enableSqs
  ? [SqsModule.register({
      consumers: [
        {
          name: 'normalized-email',
          queueUrl: sqsConfig().normalizedEmailQueueUrl,
          region: sqsConfig().region,
          waitTimeSeconds: 20, // Long polling
          visibilityTimeout: 300, // 5 minutes to process (AI calls are serialized)
        },
      ],
      producers: [
        {
          name: 'normalized-email',
          queueUrl: sqsConfig().normalizedEmailQueueUrl,
          region: sqsConfig().region,
        },
      ],
    })]
  : [];

@Module({
  imports: [
    DealAnalysisModule,
    AgentModule,
    EmailServicesModule,
    PrismaModule,
    S3Module,
    NotificationsModule,
    PreferencesModule,
    ...sqsImports,
    MicrosoftModule, // No longer needs forwardRef — circular dep broken
  ],
  providers: [
    EmailProcessorService,
    NormalizedEmailListenerService,
    SQSService,
    ...(enableSqs ? [] : [{ provide: SqsService, useValue: null }]),
  ],
  exports: [EmailProcessorService, SQSService],
})
export class EmailProcessorModule {}
