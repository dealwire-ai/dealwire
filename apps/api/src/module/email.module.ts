import { Module } from '@nestjs/common';
import { EmailSenderService } from '../service/email/email-sender.service';
import { EmailProcessingService } from '../service/email/email-processing.service';
import { EmailTemplateService } from '../service/email/email-template.service';
import { ImageProcessorService } from '../service/email/image-processor.service';
import { MetricsModule } from './metrics.module';

@Module({
  imports: [MetricsModule],
  providers: [
    EmailSenderService,
    EmailProcessingService,
    EmailTemplateService,
    ImageProcessorService,
  ],
  exports: [
    EmailSenderService,
    EmailProcessingService,
    EmailTemplateService,
    ImageProcessorService,
  ],
})
export class EmailModule {}
