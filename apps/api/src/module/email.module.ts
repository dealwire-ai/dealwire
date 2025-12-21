import { Module } from '@nestjs/common';
import { EmailSenderService } from '../service/email/email-sender.service';
import { EmailProcessingService } from '../service/email/email-processing.service';
import { EmailTemplateService } from '../service/email/email-template.service';

@Module({
  providers: [EmailSenderService, EmailProcessingService, EmailTemplateService],
  exports: [EmailSenderService, EmailProcessingService, EmailTemplateService],
})
export class EmailModule {}

