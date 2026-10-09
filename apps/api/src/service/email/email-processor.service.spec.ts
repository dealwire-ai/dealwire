import { Test, TestingModule } from '@nestjs/testing';
import { EmailProcessorService } from '../email/email-processor.service';
import { EmailProcessingService } from '../email/email-processing.service';
import { EmailTemplateService } from '../email/email-template.service';
import { MicrosoftGraphService } from '../microsoft/microsoft-graph.service';
import { ScreeningPreferencesService } from '../preferences/screening-preferences.service';
import { ScreeningBucketService } from '../preferences/screening-bucket.service';
import { DealSummaryService } from '../deal/deal-summary.service';
import { InitialScreeningService } from '../deal/initial-screening.service';
import { DealDetectionService } from '../deal/deal-detection.service';
import { DataExtractionService } from '../deal/data-extraction.service';
import { BrokerIntelligenceService } from '../deal/broker-intelligence.service';
import { MetricsService } from '../metrics/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { NotificationService } from '../notifications/notification.service';
import { ImageProcessorService } from '../email/image-processor.service';
import { EmailSenderService } from '../email/email-sender.service';
import { NormalizedEmailEvent } from '../../dto/normalized-email-event.dto';

const mockBuckets = [
  {
    id: 'bucket-yes',
    organizationId: 'org123',
    name: 'Yes',
    description: 'Test criteria',
    rank: 1,
    isPass: true,
    action: 'REPLY_TO_SELF' as const,
    folderName: null,
    generateSummary: true,
    color: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'bucket-no',
    organizationId: 'org123',
    name: 'No',
    description: 'Does not meet criteria',
    rank: 2,
    isPass: false,
    action: 'MOVE_TO_FOLDER' as const,
    folderName: 'Passed Deals',
    generateSummary: false,
    color: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Mock marked module to avoid ES module issues
jest.mock('marked', () => ({
  marked: jest.fn((text: string) => text),
}));

describe('EmailProcessorService', () => {
  let service: EmailProcessorService;
  let s3Service: jest.Mocked<S3Service>;
  let prismaService: jest.Mocked<PrismaService>;
  let microsoftGraphService: jest.Mocked<MicrosoftGraphService>;
  let dealDetectionService: jest.Mocked<DealDetectionService>;
  let dealSummaryService: jest.Mocked<DealSummaryService>;
  let initialScreeningService: jest.Mocked<InitialScreeningService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProcessorService,
        {
          provide: EmailProcessingService,
          useValue: {
            processPdfBuffer: jest.fn().mockResolvedValue('extracted pdf text'),
          },
        },
        {
          provide: EmailTemplateService,
          useValue: {
            formatSummaryAsHtml: jest
              .fn()
              .mockReturnValue('<html>summary</html>'),
          },
        },
        {
          provide: EmailSenderService,
          useValue: {
            sendEmail: jest.fn().mockResolvedValue('email-id-123'),
          },
        },
        {
          provide: MicrosoftGraphService,
          useValue: {
            getAttachmentContent: jest.fn(),
            replyInThreadToSelf: jest.fn().mockResolvedValue(true),
            getOrCreateFolder: jest.fn().mockResolvedValue('folder-id-123'),
            getMessage: jest
              .fn()
              .mockResolvedValue({ conversationId: 'conv-123' }),
            moveMessage: jest.fn().mockResolvedValue(true),
            moveConversation: jest.fn().mockResolvedValue(true),
            forwardToAdmins: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: ScreeningPreferencesService,
          useValue: {
            getPreferences: jest.fn().mockResolvedValue({
              dealCriteria: 'Test criteria',
              passedFolderName: 'Passed Deals',
            }),
          },
        },
        {
          provide: ScreeningBucketService,
          useValue: {
            findAll: jest.fn().mockResolvedValue(mockBuckets),
            ensureDefaultBuckets: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: DealSummaryService,
          useValue: {
            summarizeDeal: jest.fn().mockResolvedValue('AI-generated summary'),
            generateDealNarrative: jest
              .fn()
              .mockResolvedValue('Deal narrative text'),
            summarizeDealWithNarrative: jest
              .fn()
              .mockResolvedValue({
                summary: 'AI-generated summary',
                narrative: 'Deal narrative text',
              }),
          },
        },
        {
          provide: InitialScreeningService,
          useValue: {
            screen: jest.fn().mockResolvedValue({
              decision: 'yes',
              reason: 'Good deal',
              bucketId: 'bucket-yes',
              bucketName: 'Yes',
            }),
          },
        },
        {
          provide: DataExtractionService,
          useValue: {
            extract: jest.fn().mockResolvedValue({
              dealType: 'real_estate',
              extractedData: {
                askingPrice: 5000000,
                propertyType: 'multifamily',
                units: 50,
              },
            }),
          },
        },
        {
          provide: ImageProcessorService,
          useValue: {
            extractTextFromImage: jest.fn().mockResolvedValue(''),
            extractTextFromMultipleImages: jest.fn().mockResolvedValue(''),
          },
        },
        {
          provide: DealDetectionService,
          useValue: {
            isDealEmail: jest.fn().mockResolvedValue({
              isDeal: true,
              confidence: 'high',
              reason: 'Contains deal offering',
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            deal: {
              create: jest.fn(),
              upsert: jest.fn(),
              update: jest.fn(),
            },
            document: {
              create: jest.fn(),
              createMany: jest.fn(),
            },
            organization: {
              findUnique: jest.fn().mockResolvedValue({ name: 'Test Org' }),
            },
          },
        },
        {
          provide: S3Service,
          useValue: {
            uploadDealAttachment: jest.fn(),
            downloadDealAttachment: jest.fn(),
          },
        },
        {
          provide: MetricsService,
          useValue: {
            recordAICall: jest.fn(),
            recordDealSkipped: jest.fn(),
            recordDealProcessed: jest.fn(),
            recordProcessingError: jest.fn(),
            recordEmailEvent: jest.fn(),
            recordDealProcessingDuration: jest.fn(),
            recordFolderMove: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            notifyDealProcessed: jest.fn().mockResolvedValue(undefined),
            notifyError: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: BrokerIntelligenceService,
          useValue: {
            getBrokerStats: jest.fn().mockResolvedValue(null),
          },
        },
      ],
    }).compile();

    service = module.get<EmailProcessorService>(EmailProcessorService);
    s3Service = module.get(S3Service);
    prismaService = module.get(PrismaService);
    microsoftGraphService = module.get(MicrosoftGraphService);
    dealDetectionService = module.get(DealDetectionService);
    dealSummaryService = module.get(DealSummaryService);
    initialScreeningService = module.get(InitialScreeningService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create Document records for attachments already in S3', async () => {
    // Arrange
    const s3Key = 'deals/deal123/1234567890-test.pdf';
    const attachmentContent = Buffer.from('fake pdf content');

    const emailEvent: NormalizedEmailEvent = {
      source: 'microsoft',
      messageId: 'msg123',
      userId: 'user123',
      from: 'broker@example.com',
      to: ['user@example.com'],
      subject: 'Deal Opportunity',
      bodyText: 'Check out this property',
      attachments: [
        {
          filename: 'test.pdf',
          contentType: 'application/pdf',
          size: 1024,
          contentId: 'att123',
          s3Key: s3Key, // Already uploaded to S3 in webhook
        },
      ],
      receivedAt: new Date(),
    };

    const ctx = {
      event: emailEvent,
      accessToken: 'token123',
      inboxOwnerEmail: 'user@example.com',
      receivedByUserId: 'user123',
      organizationId: 'org123',
      dealId: 'deal123',
      detection: {
        isDeal: true,
        confidence: 'high' as const,
        reason: 'Contains deal offering',
      },
    };

    // Mock Prisma deal creation
    (prismaService.deal.upsert as jest.Mock).mockResolvedValue({
      id: 'deal123',
    });

    // Mock S3 download (for text extraction)
    (s3Service.downloadDealAttachment as jest.Mock) = jest
      .fn()
      .mockResolvedValue(attachmentContent);

    // Mock Document creation
    (prismaService.document.create as jest.Mock).mockResolvedValue({
      id: 'doc123',
    });

    // Act
    const result = await service.process(ctx);

    // Assert
    expect(result.processed).toBe(true);
    expect(result.dealId).toBe('deal123');

    // Verify InitialScreeningService.screen() was called with dealId, text, buckets, sender email, sender name, structured data, and org dealCriteria
    expect(initialScreeningService.screen).toHaveBeenCalledWith(
      'deal123',
      expect.stringContaining('extracted pdf text'),
      mockBuckets,
      'broker@example.com',
      undefined, // event has no fromName in this test
      { askingPrice: 5000000, propertyType: 'multifamily', units: 50 },
      'Test criteria',
    );

    // Verify Document was created with S3 key (attachments already in S3 from webhook)
    expect(prismaService.document.create).toHaveBeenCalledWith({
      data: {
        dealId: 'deal123',
        filename: 'test.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
        s3Key: s3Key,
      },
    });
  });

  it('should pass fromName to initial screening when present', async () => {
    // Arrange
    const emailEvent: NormalizedEmailEvent = {
      source: 'microsoft',
      messageId: 'msg123',
      userId: 'user123',
      from: 'broker@example.com',
      fromName: 'John Smith',
      to: ['user@example.com'],
      subject: 'Deal Opportunity',
      bodyText: 'Deal text',
      attachments: [],
      receivedAt: new Date(),
    };
    const ctx = {
      event: emailEvent,
      accessToken: 'token123',
      inboxOwnerEmail: 'user@example.com',
      receivedByUserId: 'user123',
      organizationId: 'org123',
      detection: {
        isDeal: true,
        confidence: 'high' as const,
        reason: 'Deal',
      },
    };
    (prismaService.deal.upsert as jest.Mock).mockResolvedValue({
      id: 'deal123',
    });

    // Act
    await service.process(ctx);

    // Assert
    expect(initialScreeningService.screen).toHaveBeenCalledWith(
      'deal123',
      expect.any(String),
      mockBuckets,
      'broker@example.com',
      'John Smith',
      { askingPrice: 5000000, propertyType: 'multifamily', units: 50 },
      'Test criteria',
    );
  });

  it('should handle S3 upload failure gracefully', async () => {
    // Arrange
    const emailEvent: NormalizedEmailEvent = {
      source: 'microsoft',
      messageId: 'msg123',
      userId: 'user123',
      from: 'broker@example.com',
      to: ['user@example.com'],
      subject: 'Deal Opportunity',
      bodyText: 'Check out this property',
      attachments: [
        {
          filename: 'test.pdf',
          contentType: 'application/pdf',
          size: 1024,
          contentId: 'att123',
        },
      ],
      receivedAt: new Date(),
    };

    const ctx = {
      event: emailEvent,
      accessToken: 'token123',
      inboxOwnerEmail: 'user@example.com',
      receivedByUserId: 'user123',
      organizationId: 'org123',
      detection: {
        isDeal: true,
        confidence: 'high' as const,
        reason: 'Contains deal offering',
      },
    };

    (prismaService.deal.upsert as jest.Mock).mockResolvedValue({
      id: 'deal123',
    });
    (microsoftGraphService.getAttachmentContent as jest.Mock).mockResolvedValue(
      Buffer.from('content'),
    );
    (s3Service.uploadDealAttachment as jest.Mock).mockRejectedValue(
      new Error('S3 upload failed'),
    );
    (prismaService.document.create as jest.Mock).mockResolvedValue({
      id: 'doc123',
    });

    // Act
    const result = await service.process(ctx);

    // Assert
    expect(result.processed).toBe(true);
    // Verify InitialScreeningService.screen() was called
    expect(initialScreeningService.screen).toHaveBeenCalled();
    // Should still create Document record without S3 key
    expect(prismaService.document.create).toHaveBeenCalledWith({
      data: {
        dealId: 'deal123',
        filename: 'test.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
      },
    });
  });

  it('should skip processing if detection indicates not a deal', async () => {
    // Arrange
    jest.clearAllMocks(); // Ensure clean state

    const emailEvent: NormalizedEmailEvent = {
      source: 'microsoft',
      messageId: 'msg123',
      userId: 'user123',
      from: 'broker@example.com',
      to: ['user@example.com'],
      subject: 'Not a deal',
      bodyText: 'Just a regular email',
      attachments: [],
      receivedAt: new Date(),
    };

    const ctx = {
      event: emailEvent,
      accessToken: 'token123',
      inboxOwnerEmail: 'user@example.com',
      receivedByUserId: 'user123',
      organizationId: 'org123',
      detection: {
        isDeal: false,
        confidence: 'high' as const,
        reason: 'Not a deal email',
      },
    };

    // Act
    const result = await service.process(ctx);

    // Assert
    expect(result.processed).toBe(false);
    expect(result.skippedReason).toBe('Not a deal email');
    expect(prismaService.deal.upsert).not.toHaveBeenCalled();
    expect(prismaService.document.create).not.toHaveBeenCalled();
    expect(
      dealSummaryService.summarizeDealWithNarrative,
    ).not.toHaveBeenCalled();
    expect(initialScreeningService.screen).not.toHaveBeenCalled();
  });

  describe('extractTextAndImagesFromHtml', () => {
    it('should extract text and filter out tracking pixels by dimension', async () => {
      // Arrange
      const html = `
        <html>
          <body>
            <p>Deal overview for 123 Main St</p>
            <img src="https://cdn.example.com/property.jpg" width="600" height="400" />
            <img src="https://track.mailchimp.com/open.gif" width="1" height="1" />
          </body>
        </html>
      `;

      // Mock fetch for external image download
      const originalFetch = global.fetch;
      const largePngBuffer = Buffer.alloc(10000, 0x89);
      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('cdn.example.com')) {
          return Promise.resolve({
            ok: true,
            headers: new Map([['content-type', 'image/jpeg']]) as any,
            arrayBuffer: () =>
              Promise.resolve(
                largePngBuffer.buffer.slice(
                  largePngBuffer.byteOffset,
                  largePngBuffer.byteOffset + largePngBuffer.byteLength,
                ),
              ),
          });
        }
        return Promise.resolve({ ok: false });
      }) as jest.Mock;

      // Act
      const result = await (service as any).extractTextAndImagesFromHtml(html);

      // Assert
      expect(result.text).toContain('Deal overview for 123 Main St');
      // Should have 1 image (property.jpg), tracking pixel filtered by 1x1 dimension
      expect(result.imageDataUrls).toHaveLength(1);
      expect(result.imageDataUrls[0]).toMatch(/^data:image\/jpeg;base64,/);

      global.fetch = originalFetch;
    });

    it('should filter out known tracking domains', async () => {
      // Arrange
      const html = `
        <html><body>
          <img src="https://open.trackingservice.com/pixel.png" width="100" height="100" />
          <img src="https://click.mailchimp.com/track/abc" width="100" height="100" />
        </body></html>
      `;

      // Act
      const result = await (service as any).extractTextAndImagesFromHtml(html);

      // Assert
      expect(result.imageDataUrls).toHaveLength(0);
    });

    it('should include base64 embedded images directly', async () => {
      // Arrange
      const base64Data = 'data:image/png;base64,iVBORw0KGgoAAAANS';
      const html = `<html><body><img src="${base64Data}" /></body></html>`;

      // Act
      const result = await (service as any).extractTextAndImagesFromHtml(html);

      // Assert
      expect(result.imageDataUrls).toHaveLength(1);
      expect(result.imageDataUrls[0]).toBe(base64Data);
    });

    it('should return plain text fallback when html is empty', async () => {
      // Act
      const result = await (service as any).extractTextAndImagesFromHtml(
        '',
        'Plain text body',
      );

      // Assert
      expect(result.text).toBe('Plain text body');
      expect(result.imageDataUrls).toHaveLength(0);
    });

    it('should skip images smaller than 5KB', async () => {
      // Arrange
      const html = `<html><body><img src="https://cdn.example.com/tiny.png" /></body></html>`;

      const tinyBuffer = Buffer.alloc(1000); // 1KB — too small
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'image/png']]) as any,
        arrayBuffer: () =>
          Promise.resolve(
            tinyBuffer.buffer.slice(
              tinyBuffer.byteOffset,
              tinyBuffer.byteOffset + tinyBuffer.byteLength,
            ),
          ),
      }) as jest.Mock;

      // Act
      const result = await (service as any).extractTextAndImagesFromHtml(html);

      // Assert
      expect(result.imageDataUrls).toHaveLength(0);

      global.fetch = originalFetch;
    });
  });

  it('should pass structured data to screening when extraction succeeds', async () => {
    // Arrange
    const emailEvent: NormalizedEmailEvent = {
      source: 'microsoft',
      messageId: 'msg123',
      userId: 'user123',
      from: 'broker@example.com',
      to: ['user@example.com'],
      subject: 'Deal Opportunity',
      bodyText: 'Deal text',
      attachments: [],
      receivedAt: new Date(),
    };
    const ctx = {
      event: emailEvent,
      accessToken: 'token123',
      inboxOwnerEmail: 'user@example.com',
      receivedByUserId: 'user123',
      organizationId: 'org123',
      detection: { isDeal: true, confidence: 'high' as const, reason: 'Deal' },
    };
    (prismaService.deal.upsert as jest.Mock).mockResolvedValue({
      id: 'deal123',
    });

    // Act
    await service.process(ctx);

    // Assert — screening receives the structured data from extraction
    expect(initialScreeningService.screen).toHaveBeenCalledWith(
      'deal123',
      expect.any(String),
      mockBuckets,
      'broker@example.com',
      undefined,
      { askingPrice: 5000000, propertyType: 'multifamily', units: 50 },
      'Test criteria',
    );
  });

  it('should still screen when data extraction fails', async () => {
    // Arrange
    const dataExtractionService = {
      extract: jest.fn().mockRejectedValue(new Error('extraction failed')),
    } as any;
    // Rebuild with failing data extraction
    const module2 = await Test.createTestingModule({
      providers: [
        EmailProcessorService,
        {
          provide: EmailProcessingService,
          useValue: { processPdfBuffer: jest.fn().mockResolvedValue('text') },
        },
        {
          provide: EmailTemplateService,
          useValue: {
            formatSummaryAsHtml: jest.fn().mockReturnValue('<html></html>'),
          },
        },
        { provide: EmailSenderService, useValue: { sendEmail: jest.fn() } },
        {
          provide: MicrosoftGraphService,
          useValue: {
            replyInThreadToSelf: jest.fn(),
            getOrCreateFolder: jest.fn(),
            getMessage: jest.fn(),
            moveMessage: jest.fn(),
            moveConversation: jest.fn(),
            forwardToAdmins: jest.fn(),
            getAttachmentContent: jest.fn(),
          },
        },
        {
          provide: ScreeningPreferencesService,
          useValue: { getPreferences: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: ScreeningBucketService,
          useValue: {
            findAll: jest.fn().mockResolvedValue(mockBuckets),
            ensureDefaultBuckets: jest.fn(),
          },
        },
        {
          provide: DealSummaryService,
          useValue: {
            summarizeDeal: jest.fn().mockResolvedValue('summary'),
            generateDealNarrative: jest.fn().mockResolvedValue('narrative'),
            summarizeDealWithNarrative: jest
              .fn()
              .mockResolvedValue({
                summary: 'summary',
                narrative: 'narrative',
              }),
          },
        },
        {
          provide: InitialScreeningService,
          useValue: {
            screen: jest
              .fn()
              .mockResolvedValue({
                decision: 'yes',
                reason: 'ok',
                bucketId: 'bucket-yes',
                bucketName: 'Yes',
              }),
          },
        },
        { provide: DataExtractionService, useValue: dataExtractionService },
        {
          provide: ImageProcessorService,
          useValue: {
            extractTextFromMultipleImages: jest.fn().mockResolvedValue(''),
          },
        },
        { provide: DealDetectionService, useValue: {} },
        {
          provide: PrismaService,
          useValue: {
            deal: {
              create: jest.fn(),
              upsert: jest.fn().mockResolvedValue({ id: 'd1' }),
              update: jest.fn(),
            },
            document: { create: jest.fn() },
          },
        },
        { provide: S3Service, useValue: { downloadDealAttachment: jest.fn() } },
        {
          provide: MetricsService,
          useValue: {
            recordAICall: jest.fn(),
            recordDealSkipped: jest.fn(),
            recordDealProcessed: jest.fn(),
            recordProcessingError: jest.fn(),
            recordEmailEvent: jest.fn(),
            recordDealProcessingDuration: jest.fn(),
            recordFolderMove: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: { notifyDealProcessed: jest.fn(), notifyError: jest.fn() },
        },
        {
          provide: BrokerIntelligenceService,
          useValue: { getBrokerStats: jest.fn().mockResolvedValue(null) },
        },
      ],
    }).compile();

    const svc2 = module2.get<EmailProcessorService>(EmailProcessorService);
    const screening2 = module2.get(
      InitialScreeningService,
    ) as jest.Mocked<InitialScreeningService>;

    const ctx = {
      event: {
        source: 'microsoft' as const,
        messageId: 'm1',
        userId: 'u1',
        from: 'b@x.com',
        to: ['u@x.com'],
        subject: 'Deal',
        bodyText: 'text',
        attachments: [],
        receivedAt: new Date(),
      },
      accessToken: 'tok',
      inboxOwnerEmail: 'u@x.com',
      receivedByUserId: 'u1',
      organizationId: 'org1',
      detection: { isDeal: true, confidence: 'high' as const, reason: 'deal' },
    };

    // Act
    const result = await svc2.process(ctx);

    // Assert — screening still runs, with undefined structured data
    expect(result.processed).toBe(true);
    expect(screening2.screen).toHaveBeenCalledWith(
      'd1',
      expect.any(String),
      mockBuckets,
      'b@x.com',
      undefined,
      undefined,
      undefined,
    );
  });
});
