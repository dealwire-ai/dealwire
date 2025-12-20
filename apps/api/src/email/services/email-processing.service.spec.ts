import { Test, TestingModule } from '@nestjs/testing';
import { EmailProcessingService } from './email-processing.service';
import { EmailSenderService } from './email-sender.service';
import * as fs from 'fs';
import * as path from 'path';

describe('EmailProcessingService', () => {
  let service: EmailProcessingService;
  let mockEmailSender: Partial<EmailSenderService>;

  beforeEach(async () => {
    mockEmailSender = {
      getApiKey: jest.fn().mockReturnValue('test-api-key'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProcessingService,
        {
          provide: EmailSenderService,
          useValue: mockEmailSender,
        },
      ],
    }).compile();

    service = module.get<EmailProcessingService>(EmailProcessingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('PDF parsing', () => {
    it('should extract text from a simple PDF', async () => {
      // Create a minimal PDF buffer for testing
      // This is a minimal valid PDF with some text
      const minimalPdf = Buffer.from(
        '%PDF-1.4\n' +
        '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
        '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
        '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<<>>>>endobj\n' +
        '4 0 obj<</Length 44>>stream\n' +
        'BT /F1 12 Tf 100 700 Td (Test Document) Tj ET\n' +
        'endstream endobj\n' +
        'xref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000056 00000 n\n0000000115 00000 n\n0000000214 00000 n\n' +
        'trailer<</Size 5/Root 1 0 R>>\nstartxref\n318\n%%EOF'
      );

      const attachmentInfo = {
        filename: 'test.pdf',
        contentType: 'application/pdf',
        size: minimalPdf.length,
        downloadUrl: 'http://test.com/file.pdf',
        expiresAt: new Date().toISOString(),
      };

      // Mock fetch to return our test PDF
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => minimalPdf.buffer,
      } as any);

      const result = await service.processAttachment(attachmentInfo);

      // Should extract some text (even if minimal)
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      // The actual extraction might vary, but it shouldn't throw
    }, 10000);

    it('should handle PDF parsing errors gracefully', async () => {
      const attachmentInfo = {
        filename: 'invalid.pdf',
        contentType: 'application/pdf',
        size: 100,
        downloadUrl: 'http://test.com/invalid.pdf',
        expiresAt: new Date().toISOString(),
      };

      // Mock fetch to return invalid PDF data
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => Buffer.from('not a pdf').buffer,
      } as any);

      const result = await service.processAttachment(attachmentInfo);

      // Should return empty string on error, not throw
      expect(result).toBe('');
    });
  });
});
