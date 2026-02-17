import { Module } from '@nestjs/common';
import { HistoricalIngestionController } from '../controller/historical-ingestion.controller';
import { HistoricalIngestionService } from '../service/ingestion/historical-ingestion.service';
import { MicrosoftGraphListService } from '../service/microsoft/microsoft-graph-list.service';
import { PrismaModule } from './prisma.module';
import { MicrosoftModule } from './microsoft.module';
import { DealAnalysisModule } from './ai.module';
import { EmailProcessorModule } from './email-processor.module';
import { S3Module } from './s3.module';
import { PreferencesModule } from './preferences.module';
import { ClerkAuthGuard } from '../guard/clerk-auth.guard';

@Module({
  imports: [
    PrismaModule,
    MicrosoftModule,
    DealAnalysisModule,
    EmailProcessorModule,
    S3Module,
    PreferencesModule,
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
