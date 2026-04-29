import { Module } from '@nestjs/common';
import { UnderwritingListenerService } from '../service/underwriting/underwriting-listener.service';
import { ProformaService } from '../service/underwriting/proforma.service';
import { UnderwritingWorkflowService } from '../service/underwriting/workflow/underwriting-workflow.service';
import { DealAnalyzerService } from '../service/underwriting/workflow/deal-analyzer.service';
import { TemplateFillerService } from '../service/underwriting/workflow/template-filler.service';
import { ProformaValidatorService } from '../service/underwriting/workflow/proforma-validator.service';
import { DeliveryService } from '../service/underwriting/workflow/delivery.service';
import { AssumptionAskerService } from '../service/underwriting/workflow/assumption-asker.service';
import { AssumptionEmailService } from '../service/underwriting/workflow/assumption-email.service';
import { ReplyRouterService } from '../service/underwriting/workflow/reply-router.service';
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
    UnderwritingWorkflowService,
    DealAnalyzerService,
    TemplateFillerService,
    ProformaValidatorService,
    DeliveryService,
    AssumptionAskerService,
    AssumptionEmailService,
    ReplyRouterService,
  ],
  exports: [UnderwritingWorkflowService],
})
export class UnderwritingModule {}
