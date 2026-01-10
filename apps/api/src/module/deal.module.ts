import { Module, forwardRef } from '@nestjs/common';
import { DealProcessorService } from '../service/deal/deal-processor.service';
import { AIModule } from './ai.module';
import { EmailModule } from './email.module';
import { PrismaModule } from './prisma.module';
import { MicrosoftModule } from './microsoft.module';
import { S3Module } from './s3.module';

@Module({
  imports: [
    AIModule,
    EmailModule,
    PrismaModule,
    S3Module,
    forwardRef(() => MicrosoftModule), // For MicrosoftGraphService
  ],
  providers: [DealProcessorService],
  exports: [DealProcessorService],
})
export class DealModule {}
