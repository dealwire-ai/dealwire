import { Module } from '@nestjs/common';
import { EmailSenderService } from './services/email-sender.service';
import { EmailProcessingService } from './services/email-processing.service';
import { EmailTemplateService } from './services/email-template.service';

@Module({
  providers: [EmailSenderService, EmailProcessingService, EmailTemplateService],
  exports: [EmailSenderService, EmailProcessingService, EmailTemplateService],
})
export class EmailModule {}
