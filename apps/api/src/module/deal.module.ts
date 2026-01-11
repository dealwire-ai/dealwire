import { Module, forwardRef } from '@nestjs/common';
import { EmailProcessorService } from '../service/email/email-processor.service';
import { NormalizedEmailListenerService } from '../service/email/normalized-email-listener.service';
import { AIModule } from './ai.module';
import { EmailModule as EmailServicesModule } from './email.module';
import { PrismaModule } from './prisma.module';
import { MicrosoftModule } from './microsoft.module';
import { S3Module } from './s3.module';
import { SQSModule } from './sqs.module';

@Module({
  imports: [
    AIModule,
    EmailServicesModule,
    PrismaModule,
    S3Module,
    SQSModule,
    forwardRef(() => MicrosoftModule), // For MicrosoftGraphService
  ],
  providers: [EmailProcessorService, NormalizedEmailListenerService],
  exports: [EmailProcessorService],
})
export class EmailModule {}
