import { Module } from '@nestjs/common';
import { UnderwritingListenerService } from '../service/underwriting/underwriting-listener.service';
import { UnderwritingOrchestratorService } from '../service/underwriting/underwriting-orchestrator.service';
import { DocumentClassifierService } from '../service/underwriting/document-classifier.service';
import { PrismaModule } from './prisma.module';
import { S3Module } from './s3.module';

@Module({
  imports: [PrismaModule, S3Module],
  providers: [UnderwritingListenerService, UnderwritingOrchestratorService, DocumentClassifierService],
  exports: [UnderwritingOrchestratorService],
})
export class UnderwritingModule {}
