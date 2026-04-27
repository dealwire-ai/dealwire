import { Module } from '@nestjs/common';
import { UnderwritingListenerService } from '../service/underwriting/underwriting-listener.service';
import { ProformaService } from '../service/underwriting/proforma.service';
import { AgenticUnderwritingService } from '../service/underwriting/agentic/agentic-underwriting.service';
import { DealAnalyzerService } from '../service/underwriting/agentic/deal-analyzer.service';
import { TemplateFillerService } from '../service/underwriting/agentic/template-filler.service';
import { ProformaValidatorService } from '../service/underwriting/agentic/proforma-validator.service';
import { AgenticDeliveryService } from '../service/underwriting/agentic/agentic-delivery.service';
import { AssumptionAskerService } from '../service/underwriting/agentic/assumption-asker.service';
import { AssumptionEmailService } from '../service/underwriting/agentic/assumption-email.service';
import { ReplyRouterService } from '../service/underwriting/agentic/reply-router.service';
import { ProformaController } from '../controller/underwriting/proforma.controller';
import { UnderwritingDevController } from '../controller/underwriting/underwriting-dev.controller';
import { UnderwritingRunsController } from '../controller/underwriting/underwriting-runs.controller';
import { ClerkAuthGuard } from '../guard/clerk-auth.guard';
import { PrismaModule } from './prisma.module';
import { S3Module } from './s3.module';
import { EmailModule } from './email.module';

@Module({
  imports: [PrismaModule, S3Module, EmailModule],
  controllers: [
    ProformaController,
    UnderwritingDevController,
    UnderwritingRunsController,
  ],
  providers: [
    ClerkAuthGuard,
    UnderwritingListenerService,
    ProformaService,
    AgenticUnderwritingService,
    DealAnalyzerService,
    TemplateFillerService,
    ProformaValidatorService,
    AgenticDeliveryService,
    AssumptionAskerService,
    AssumptionEmailService,
    ReplyRouterService,
  ],
  exports: [AgenticUnderwritingService],
})
export class UnderwritingModule {}
