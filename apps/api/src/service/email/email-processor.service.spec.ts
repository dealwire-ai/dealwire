import { Test, TestingModule } from '@nestjs/testing';
import { EmailProcessorService } from '../email/email-processor.service';
import { EmailProcessingService } from '../email/email-processing.service';
import { EmailTemplateService } from '../email/email-template.service';
import { MicrosoftGraphService } from '../microsoft/microsoft-graph.service';
import { ScreeningPreferencesService } from '../preferences/screening-preferences.service';
import { DealSummaryService } from '../deal/deal-summary.service';
import { InitialScreeningService } from '../deal/initial-screening.service';
import { DealDetectionService } from '../deal/deal-detection.service';
import { MetricsService } from '../metrics/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { NotificationService } from '../notifications/notification.service';
import { EmailSenderService } from '../email/email-sender.service';
import { NormalizedEmailEvent } from '../../dto/normalized-email-event.dto';

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
            formatSummaryAsHtml: jest.fn().mockReturnValue('<html>summary</html>'),
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
            getMessage: jest.fn().mockResolvedValue({ conversationId: 'conv-123' }),
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
          provide: DealSummaryService,
          useValue: {
            summarizeDeal: jest.fn().mockResolvedValue('AI-generated summary'),
          },
        },
        {
          provide: InitialScreeningService,
          useValue: {
            screen: jest.fn().mockResolvedValue({
              decision: 'yes',
              reason: 'Good deal',
            }),
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
    (prismaService.deal.create as jest.Mock).mockResolvedValue({
      id: 'deal123',
    });

    // Mock S3 download (for text extraction)
    (s3Service.downloadDealAttachment as jest.Mock) = jest.fn().mockResolvedValue(attachmentContent);

    // Mock Document creation
    (prismaService.document.create as jest.Mock).mockResolvedValue({
      id: 'doc123',
    });

    // Act
    const result = await service.process(ctx);

    // Assert
    expect(result.processed).toBe(true);
    expect(result.dealId).toBe('deal123');

    // Verify InitialScreeningService.screen() was called with dealId, text, criteria, sender email, and sender name
    expect(initialScreeningService.screen).toHaveBeenCalledWith(
      'deal123',
      expect.stringContaining('extracted pdf text'),
      'Test criteria',
      'broker@example.com',
      undefined, // event has no fromName in this test
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
    (prismaService.deal.create as jest.Mock).mockResolvedValue({ id: 'deal123' });

    // Act
    await service.process(ctx);

    // Assert
    expect(initialScreeningService.screen).toHaveBeenCalledWith(
      'deal123',
      expect.any(String),
      'Test criteria',
      'broker@example.com',
      'John Smith',
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

    (prismaService.deal.create as jest.Mock).mockResolvedValue({ id: 'deal123' });
    (microsoftGraphService.getAttachmentContent as jest.Mock).mockResolvedValue(
      Buffer.from('content'),
    );
    (s3Service.uploadDealAttachment as jest.Mock).mockRejectedValue(
      new Error('S3 upload failed'),
    );
    (prismaService.document.create as jest.Mock).mockResolvedValue({ id: 'doc123' });

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
    expect(prismaService.deal.create).not.toHaveBeenCalled();
    expect(prismaService.document.create).not.toHaveBeenCalled();
    expect(dealSummaryService.summarizeDeal).not.toHaveBeenCalled();
      expect(initialScreeningService.screen).not.toHaveBeenCalled();
  });
});
