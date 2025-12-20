import { Injectable, Logger } from '@nestjs/common';
import { load } from 'cheerio';
import { EmailSenderService } from './email-sender.service';

interface AttachmentMetadata {
  filename: string;
  contentType: string;
  size: number;
  downloadUrl: string;
  expiresAt: string;
}

@Injectable()
export class EmailProcessingService {
  private readonly logger = new Logger(EmailProcessingService.name);

  constructor(private readonly emailSender: EmailSenderService) {}

  async extractEmailBody(emailId: string): Promise<{ text: string; images: string[] }> {
    try {
      const response = await fetch(
        `https://api.resend.com/emails/receiving/${emailId}`,
        {
          headers: {
            Authorization: `Bearer ${this.emailSender.getApiKey()}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        this.logger.warn(
          `Failed to fetch email content for ${emailId}: ${response.status}`,
        );
        return { text: '', images: [] };
      }

      const emailData = await response.json();
      const emailHtml = emailData.html || '';
      const emailText = emailData.text || '';

      let extractedText = '';
      const images: string[] = [];

      if (emailHtml) {
        const $ = load(emailHtml);
        extractedText = $.text();

        // Extract embedded images
        $('img').each((_, element) => {
          const src = $(element).attr('src');
          if (src && src.startsWith('data:image')) {
            images.push(src);
          }
        });
      } else if (emailText) {
        extractedText = emailText;
      }

      return { text: extractedText, images };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Email body processing failed for ${emailId}: ${errorMessage}`,
      );
      return { text: '', images: [] };
    }
  }

  async fetchAttachments(emailId: string): Promise<AttachmentMetadata[]> {
    try {
      const response = await fetch(
        `https://api.resend.com/emails/receiving/${emailId}/attachments`,
        {
          headers: {
            Authorization: `Bearer ${this.emailSender.getApiKey()}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        this.logger.error(
          `Failed to fetch attachments for ${emailId}: ${response.status}`,
        );
        return [];
      }

      const data = await response.json();
      const attachments = data.data || [];

      return attachments.map((att: any) => ({
        filename: att.filename || 'unknown',
        contentType: att.content_type || 'unknown',
        size: att.size || 0,
        downloadUrl: att.download_url,
        expiresAt: att.expires_at,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to fetch attachments for ${emailId}: ${errorMessage}`,
      );
      return [];
    }
  }

  async processAttachment(attachmentInfo: AttachmentMetadata): Promise<string> {
    try {
      const response = await fetch(attachmentInfo.downloadUrl);

      if (!response.ok) {
        this.logger.error(
          `Failed to download attachment ${attachmentInfo.filename}: ${response.status}`,
        );
        return '';
      }

      const buffer = await response.arrayBuffer();
      this.logger.log(
        `Downloaded attachment: ${attachmentInfo.filename} (${buffer.byteLength} bytes)`,
      );

      // Parse PDFs
      if (attachmentInfo.contentType === 'application/pdf' ||
          attachmentInfo.filename.toLowerCase().endsWith('.pdf')) {
        try {
          const pdfBuffer = Buffer.from(buffer);

          // Import pdf-parse dynamically (CommonJS module)
          const pdfParseModule = await import('pdf-parse');

          // Debug: log what we got
          this.logger.debug(`pdfParseModule type: ${typeof pdfParseModule}`);
          this.logger.debug(`pdfParseModule.default type: ${typeof pdfParseModule.default}`);
          this.logger.debug(`pdfParseModule keys: ${Object.keys(pdfParseModule)}`);

          // Try different ways to get the function (CommonJS quirks)
          const parsePdf = (pdfParseModule.default || pdfParseModule) as any;

          const pdfData = await parsePdf(pdfBuffer);
          const extractedText = pdfData.text.trim();

          if (extractedText) {
            this.logger.log(
              `Extracted ${extractedText.length} characters from PDF: ${attachmentInfo.filename}`,
            );
            this.logger.log('=== OCR-EXTRACTED TEXT START ===');
            this.logger.log(extractedText);
            this.logger.log('=== OCR-EXTRACTED TEXT END ===');
            return extractedText;
          } else {
            this.logger.warn(`No text extracted from PDF: ${attachmentInfo.filename}`);
            return '';
          }
        } catch (pdfError) {
          const errorMessage = pdfError instanceof Error ? pdfError.message : String(pdfError);
          this.logger.error(
            `PDF parsing failed for ${attachmentInfo.filename}: ${errorMessage}`,
          );
          return '';
        }
      }

      // For non-PDF attachments, return empty for now
      this.logger.debug(
        `Skipping non-PDF attachment: ${attachmentInfo.filename} (${attachmentInfo.contentType})`,
      );
      return '';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Attachment processing failed for ${attachmentInfo.filename}: ${errorMessage}`,
      );
      return '';
    }
  }

  async extractAllText(
    emailId: string,
    attachmentsMetadata: any[],
  ): Promise<string[]> {
    const allExtractedText: string[] = [];

    // Extract email body text and embedded images
    const { text: emailBodyText, images: embeddedImages } =
      await this.extractEmailBody(emailId);

    if (emailBodyText) {
      allExtractedText.push(`--- Email Body Text ---\n${emailBodyText}`);
    }

    // TODO: Process embedded images with OCR if needed
    if (embeddedImages.length > 0) {
      this.logger.debug(
        `Found ${embeddedImages.length} embedded images (OCR not yet implemented)`,
      );
    }

    // Process attachments
    if (attachmentsMetadata && attachmentsMetadata.length > 0) {
      const attachments = await this.fetchAttachments(emailId);

      for (const attachmentInfo of attachments) {
        const attachmentText = await this.processAttachment(attachmentInfo);
        if (attachmentText) {
          allExtractedText.push(
            `--- ${attachmentInfo.filename} ---\n${attachmentText}`,
          );
        }
      }
    }

    return allExtractedText;
  }
}
