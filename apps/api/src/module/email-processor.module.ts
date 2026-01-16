import { Module, forwardRef } from '@nestjs/common';
import { SqsModule } from '@ssut/nestjs-sqs';
import { EmailProcessorService } from '../service/email/email-processor.service';
import { NormalizedEmailListenerService } from '../service/email/normalized-email-listener.service';
import { SQSService } from '../service/sqs/sqs.service';
import { AIModule } from './ai.module';
import { EmailModule as EmailServicesModule } from './email.module'; // Email services (EmailProcessingService, etc.)
import { PrismaModule } from './prisma.module';
import { MicrosoftModule } from './microsoft.module';
import { S3Module } from './s3.module';
import { NotificationsModule } from './notifications.module';
import { sqsConfig } from '../config/sqs.config';

@Module({
  imports: [
    AIModule,
    EmailServicesModule,
    PrismaModule,
    S3Module,
    NotificationsModule,
    SqsModule.register({
      consumers: [
        {
          name: 'normalized-email',
          queueUrl: sqsConfig().normalizedEmailQueueUrl,
          region: sqsConfig().region,
          waitTimeSeconds: 20, // Long polling
          visibilityTimeout: 60, // 60 seconds to process
        },
      ],
      producers: [
        {
          name: 'normalized-email',
          queueUrl: sqsConfig().normalizedEmailQueueUrl,
          region: sqsConfig().region,
        },
      ],
    }),
    forwardRef(() => MicrosoftModule), // For MicrosoftGraphService
  ],
  providers: [EmailProcessorService, NormalizedEmailListenerService, SQSService],
  exports: [EmailProcessorService, SQSService],
})
export class EmailProcessorModule {}
