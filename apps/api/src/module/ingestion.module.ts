import { Module } from '@nestjs/common';
import { HistoricalIngestionController } from '../controller/historical-ingestion.controller';
import { HistoricalIngestionService } from '../service/ingestion/historical-ingestion.service';
import { MicrosoftGraphListService } from '../service/microsoft/microsoft-graph-list.service';
import { PrismaModule } from './prisma.module';
import { MicrosoftModule } from './microsoft.module';
import { AIModule } from './ai.module';
import { EmailProcessorModule } from './email-processor.module';
import { S3Module } from './s3.module';
import { ClerkAuthGuard } from '../guard/clerk-auth.guard';

@Module({
  imports: [
    PrismaModule,
    MicrosoftModule,
    AIModule,
    EmailProcessorModule,
    S3Module,
  ],
  controllers: [HistoricalIngestionController],
  providers: [
    HistoricalIngestionService,
    MicrosoftGraphListService,
    ClerkAuthGuard,
  ],
  exports: [HistoricalIngestionService],
})
export class IngestionModule {}
