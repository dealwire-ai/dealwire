import { Test, TestingModule } from '@nestjs/testing';
import { DealProcessorService } from './deal-processor.service';
import { EmailProcessingService } from '../email/email-processing.service';
import { EmailTemplateService } from '../email/email-template.service';
import { MicrosoftGraphService } from '../microsoft/microsoft-graph.service';
import { ClientPreferencesService } from '../preferences/client-preferences.service';
import { DealSummaryService } from './deal-summary.service';
import { DealDecisionService } from './deal-decision.service';
import { DealDetectionService } from './deal-detection.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { NormalizedEmailEvent } from '../../dto/normalized-email-event.dto';

// Mock marked module to avoid ES module issues
jest.mock('marked', () => ({
  marked: jest.fn((text: string) => text),
}));

describe('DealProcessorService', () => {
  let service: DealProcessorService;
  let s3Service: jest.Mocked<S3Service>;
  let prismaService: jest.Mocked<PrismaService>;
  let microsoftGraphService: jest.Mocked<MicrosoftGraphService>;
  let dealDetectionService: jest.Mocked<DealDetectionService>;
  let dealSummaryService: jest.Mocked<DealSummaryService>;
  let dealDecisionService: jest.Mocked<DealDecisionService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DealProcessorService,
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
          provide: MicrosoftGraphService,
          useValue: {
            getAttachmentContent: jest.fn(),
            replyToSelf: jest.fn().mockResolvedValue(true),
            moveMessageToPassedFolder: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: ClientPreferencesService,
          useValue: {
            getPreferences: jest.fn().mockReturnValue({
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
          provide: DealDecisionService,
          useValue: {
            makeDecision: jest.fn().mockResolvedValue({
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
            },
            document: {
              create: jest.fn(),
              createMany: jest.fn(),
            },
          },
        },
        {
          provide: S3Service,
          useValue: {
            uploadDealAttachment: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DealProcessorService>(DealProcessorService);
    s3Service = module.get(S3Service);
    prismaService = module.get(PrismaService);
    microsoftGraphService = module.get(MicrosoftGraphService);
    dealDetectionService = module.get(DealDetectionService);
    dealSummaryService = module.get(DealSummaryService);
    dealDecisionService = module.get(DealDecisionService);
  });

  it('should upload attachments to S3 and create Document records', async () => {
    // Arrange
    const attachmentContent = Buffer.from('fake pdf content');
    const s3Key = 'deals/deal123/1234567890-test.pdf';

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
    };

    // Mock Prisma deal creation
    (prismaService.deal.create as jest.Mock).mockResolvedValue({
      id: 'deal123',
    });

    // Mock Microsoft Graph attachment download
    (microsoftGraphService.getAttachmentContent as jest.Mock).mockResolvedValue(
      attachmentContent,
    );

    // Mock S3 upload
    (s3Service.uploadDealAttachment as jest.Mock).mockResolvedValue(s3Key);

    // Mock Document creation
    (prismaService.document.create as jest.Mock).mockResolvedValue({
      id: 'doc123',
    });

    // Act
    const result = await service.processDeal(ctx);

    // Assert
    expect(result.processed).toBe(true);
    expect(result.dealId).toBe('deal123');

    // Verify S3 upload was called
    expect(s3Service.uploadDealAttachment).toHaveBeenCalledWith(
      attachmentContent,
      'test.pdf',
      'deal123',
    );

    // Verify Document was created with S3 key
    expect(prismaService.document.create).toHaveBeenCalledWith({
      data: {
        dealId: 'deal123',
        filename: 'test.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
        s3Key: s3Key,
        extractedText: 'extracted pdf text',
      },
    });
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
    const result = await service.processDeal(ctx);

    // Assert
    expect(result.processed).toBe(true);
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
});
