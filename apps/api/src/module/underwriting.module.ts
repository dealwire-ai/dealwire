import { Module } from '@nestjs/common';
import { UnderwritingListenerService } from '../service/underwriting/underwriting-listener.service';
import { UnderwritingOrchestratorService } from '../service/underwriting/underwriting-orchestrator.service';
import { DocumentClassifierService } from '../service/underwriting/extractors/document-classifier.service';
import { OMExtractorService } from '../service/underwriting/extractors/om-extractor.service';
import { RentRollExtractorService } from '../service/underwriting/extractors/rent-roll-extractor.service';
import { T12ExtractorService } from '../service/underwriting/extractors/t12-extractor.service';
import { GenericExtractorService } from '../service/underwriting/extractors/generic-extractor.service';
import { ProformaService } from '../service/underwriting/proforma.service';
import { ExtractionReconcilerService } from '../service/underwriting/steps/extraction-reconciler.service';
import { ProformaFillService } from '../service/underwriting/steps/proforma-fill.service';
import { DeliveryService } from '../service/underwriting/steps/delivery.service';
import { AgenticUnderwritingService } from '../service/underwriting/agentic/agentic-underwriting.service';
import { DealAnalyzerService } from '../service/underwriting/agentic/deal-analyzer.service';
import { TemplateFillerService } from '../service/underwriting/agentic/template-filler.service';
import { AgenticDeliveryService } from '../service/underwriting/agentic/agentic-delivery.service';
import { ProformaController } from '../controller/underwriting/proforma.controller';
import { UnderwritingDevController } from '../controller/underwriting/underwriting-dev.controller';
import { ClerkAuthGuard } from '../guard/clerk-auth.guard';
import { PrismaModule } from './prisma.module';
import { S3Module } from './s3.module';
import { EmailModule } from './email.module';

@Module({
  imports: [PrismaModule, S3Module, EmailModule],
  controllers: [ProformaController, UnderwritingDevController],
  providers: [
    ClerkAuthGuard,
    // Legacy pipeline
    UnderwritingListenerService,
    UnderwritingOrchestratorService,
    DocumentClassifierService,
    OMExtractorService,
    RentRollExtractorService,
    T12ExtractorService,
    GenericExtractorService,
    ProformaService,
    ExtractionReconcilerService,
    ProformaFillService,
    DeliveryService,
    // Agentic pipeline (env: AGENTIC_UNDERWRITING_ENABLED=true)
    AgenticUnderwritingService,
    DealAnalyzerService,
    TemplateFillerService,
    AgenticDeliveryService,
  ],
  exports: [UnderwritingOrchestratorService, AgenticUnderwritingService],
})
export class UnderwritingModule {}
