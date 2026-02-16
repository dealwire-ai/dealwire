import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { load } from 'cheerio';
import { EmailSenderService } from './email-sender.service';
import { extractPdfText } from '../../util/pdf-parser';
import { ImageProcessorService } from './image-processor.service';

const execAsync = promisify(exec);

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

  constructor(
    private readonly emailSender: EmailSenderService,
    private readonly imageProcessorService: ImageProcessorService,
  ) {}

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

      // Parse PDFs using system pdftotext (fuck npm libraries)
      if (attachmentInfo.contentType === 'application/pdf' ||
          attachmentInfo.filename.toLowerCase().endsWith('.pdf')) {
        return this.processPdfBuffer(Buffer.from(buffer), attachmentInfo.filename);
      }

      // Process images using OpenAI Vision API
      if (this.isImageType(attachmentInfo.contentType, attachmentInfo.filename)) {
        return this.imageProcessorService.extractTextFromImage(
          Buffer.from(buffer),
          attachmentInfo.filename,
        );
      }

      // For other attachment types, return empty for now
      this.logger.debug(
        `Skipping unsupported attachment: ${attachmentInfo.filename} (${attachmentInfo.contentType})`,
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

  /**
   * Process a PDF buffer and extract text.
   * Falls back to Vision API OCR for scanned/image-only PDFs.
   */
  async processPdfBuffer(buffer: Buffer, filename?: string): Promise<string> {
    const name = filename || 'attachment.pdf';
    try {
      const trimmedText = await extractPdfText(buffer);

      if (trimmedText && trimmedText.trim().length >= 50) {
        this.logger.log(
          `Extracted ${trimmedText.length} characters from PDF: ${name}`,
        );
        return trimmedText;
      }

      // Text extraction returned empty/minimal — likely a scanned PDF
      this.logger.log(`PDF text extraction returned <50 chars for ${name}, falling back to Vision OCR`);
      const ocrText = await this.ocrPdfViaVision(buffer, name);
      if (ocrText) {
        return ocrText;
      }

      // Return whatever pdftotext gave us (even if minimal)
      return trimmedText || '';
    } catch (pdfError) {
      const errorMessage = pdfError instanceof Error ? pdfError.message : String(pdfError);
      this.logger.error(`PDF parsing failed for ${name}: ${errorMessage}`);

      // Try Vision OCR as last resort
      try {
        const ocrText = await this.ocrPdfViaVision(buffer, name);
        if (ocrText) return ocrText;
      } catch {
        // Already logged in ocrPdfViaVision
      }
      return '';
    }
  }

  /**
   * Convert PDF pages to PNG images using pdftoppm and OCR each page via Vision API.
   * Caps at first 10 pages to control costs.
   */
  private async ocrPdfViaVision(buffer: Buffer, filename: string): Promise<string> {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-ocr-'));
    const tmpPdf = path.join(tmpDir, 'input.pdf');

    try {
      await fs.writeFile(tmpPdf, buffer);

      // Convert PDF pages to PNG (first 10 pages, 200 DPI for good OCR quality)
      const outputPrefix = path.join(tmpDir, 'page');
      await execAsync(
        `pdftoppm -png -r 200 -l 10 "${tmpPdf}" "${outputPrefix}"`,
        { timeout: 30000 },
      );

      // Find generated page images
      const files = await fs.readdir(tmpDir);
      const pageFiles = files
        .filter((f) => f.startsWith('page-') && f.endsWith('.png'))
        .sort();

      if (pageFiles.length === 0) {
        this.logger.warn(`pdftoppm produced no images for ${filename}`);
        return '';
      }

      this.logger.log(`Converting ${pageFiles.length} pages of ${filename} via Vision OCR`);

      // Process each page through Vision API
      const pageTexts: string[] = [];
      for (const pageFile of pageFiles) {
        const pagePath = path.join(tmpDir, pageFile);
        const pageBuffer = await fs.readFile(pagePath);
        const pageText = await this.imageProcessorService.extractTextFromImage(
          pageBuffer,
          `${filename}-${pageFile}`,
        );
        if (pageText) {
          pageTexts.push(pageText);
        }
      }

      const result = pageTexts.join('\n\n--- Page Break ---\n\n');
      this.logger.log(`Vision OCR extracted ${result.length} chars from ${pageFiles.length} pages of ${filename}`);
      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Vision OCR fallback failed for ${filename}: ${msg}`);
      return '';
    } finally {
      // Cleanup temp directory
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  /**
   * Process an image buffer and extract text using OpenAI Vision API
   * Exposed for use by Microsoft webhook service
   */
  async processImageBuffer(buffer: Buffer, filename?: string): Promise<string> {
    const name = filename || 'attachment.png';
    return this.imageProcessorService.extractTextFromImage(buffer, name);
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

  /**
   * Check if attachment is an image type
   */
  private isImageType(contentType: string, filename: string): boolean {
    const imageContentTypes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/gif',
      'image/webp',
    ];
    const imageExtensions = /\.(png|jpg|jpeg|gif|webp)$/i;

    return (
      imageContentTypes.includes(contentType) ||
      imageExtensions.test(filename)
    );
  }
}

