import { Module } from '@nestjs/common';
import { UnderwritingListenerService } from '../service/underwriting/underwriting-listener.service';
import { UnderwritingOrchestratorService } from '../service/underwriting/underwriting-orchestrator.service';
import { DocumentClassifierService } from '../service/underwriting/extractors/document-classifier.service';
import { OMExtractorService } from '../service/underwriting/extractors/om-extractor.service';
import { RentRollExtractorService } from '../service/underwriting/extractors/rent-roll-extractor.service';
import { T12ExtractorService } from '../service/underwriting/extractors/t12-extractor.service';
import { GenericExtractorService } from '../service/underwriting/extractors/generic-extractor.service';
import { ProformaService } from '../service/underwriting/proforma.service';
import { NormalizerService } from '../service/underwriting/steps/normalizer.service';
import { ProformaFillService } from '../service/underwriting/steps/proforma-fill.service';
import { DeliveryService } from '../service/underwriting/steps/delivery.service';
import { ProformaController } from '../controller/underwriting/proforma.controller';
import { ClerkAuthGuard } from '../guard/clerk-auth.guard';
import { PrismaModule } from './prisma.module';
import { S3Module } from './s3.module';
import { EmailServicesModule } from './email.module';

@Module({
  imports: [PrismaModule, S3Module, EmailServicesModule],
  controllers: [ProformaController],
  providers: [
    ClerkAuthGuard,
    UnderwritingListenerService,
    UnderwritingOrchestratorService,
    DocumentClassifierService,
    OMExtractorService,
    RentRollExtractorService,
    T12ExtractorService,
    GenericExtractorService,
    ProformaService,
    NormalizerService,
    ProformaFillService,
    DeliveryService,
  ],
  exports: [UnderwritingOrchestratorService],
})
export class UnderwritingModule {}
