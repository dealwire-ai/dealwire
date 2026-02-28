import { Module } from '@nestjs/common';
import { UnderwritingListenerService } from '../service/underwriting/underwriting-listener.service';
import { UnderwritingOrchestratorService } from '../service/underwriting/underwriting-orchestrator.service';
import { DocumentClassifierService } from '../service/underwriting/document-classifier.service';
import { OMExtractorService } from '../service/underwriting/om-extractor.service';
import { RentRollExtractorService } from '../service/underwriting/rent-roll-extractor.service';
import { T12ExtractorService } from '../service/underwriting/t12-extractor.service';
import { PrismaModule } from './prisma.module';
import { S3Module } from './s3.module';

@Module({
  imports: [PrismaModule, S3Module],
  providers: [
    UnderwritingListenerService,
    UnderwritingOrchestratorService,
    DocumentClassifierService,
    OMExtractorService,
    RentRollExtractorService,
    T12ExtractorService,
  ],
  exports: [UnderwritingOrchestratorService],
})
export class UnderwritingModule {}
