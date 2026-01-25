import { Test, TestingModule } from '@nestjs/testing';
import { DealDigestService } from './deal-digest.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailSenderService } from '../email/email-sender.service';
import { ScreeningPreferencesService } from '../preferences/screening-preferences.service';

describe('DealDigestService', () => {
  let service: DealDigestService;
  let prismaService: jest.Mocked<PrismaService>;
  let emailSenderService: jest.Mocked<EmailSenderService>;
  let screeningPreferencesService: jest.Mocked<ScreeningPreferencesService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DealDigestService,
        {
          provide: PrismaService,
          useValue: {
            organization: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
            },
            initialScreening: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              updateMany: jest.fn(),
            },
          },
        },
        {
          provide: EmailSenderService,
          useValue: {
            sendEmail: jest.fn().mockResolvedValue('email-id-123'),
          },
        },
        {
          provide: ScreeningPreferencesService,
          useValue: {
            getPreferences: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DealDigestService>(DealDigestService);
    prismaService = module.get(PrismaService);
    emailSenderService = module.get(EmailSenderService);
    screeningPreferencesService = module.get(ScreeningPreferencesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendDigestForOrganization()', () => {
    it('should send email when screenings exist', async () => {
      // Arrange
      const orgId = 'org123';
      const mockOrg = {
        id: orgId,
        name: 'Test Org',
        users: [{ email: 'user1@example.com' }, { email: 'user2@example.com' }],
      };

      const mockScreenings = [
        {
          id: 'screening1',
          decision: 'NO' as const,
          reason: 'Location not in target area',
          screenedAt: new Date('2026-01-24T10:00:00Z'),
          deal: {
            sourceSubject: 'Property Opportunity',
            sourceFrom: 'broker@example.com',
            asset: {
              address: '123 Main St',
              city: 'New York',
              state: 'NY',
            },
            receivedByUser: {
              email: 'user@example.com',
              firstName: 'Test',
              lastName: 'User',
            },
          },
        },
        {
          id: 'screening2',
          decision: 'YES' as const,
          reason: 'Meets all criteria',
          screenedAt: new Date('2026-01-24T11:00:00Z'),
          deal: {
            sourceSubject: 'Great Deal',
            sourceFrom: 'seller@example.com',
            asset: null,
            receivedByUser: null,
          },
        },
      ];

      const mockPreferences = {
        companyName: 'Test Company',
        brandColor: '#FF0000',
        logoUrl: 'https://example.com/logo.png',
      };

      (prismaService.organization.findUnique as jest.Mock).mockResolvedValue(mockOrg);
      (prismaService.initialScreening.findFirst as jest.Mock).mockResolvedValue(null); // No previous digest
      (prismaService.initialScreening.findMany as jest.Mock).mockResolvedValue(mockScreenings);
      (screeningPreferencesService.getPreferences as jest.Mock).mockResolvedValue(mockPreferences);
      (prismaService.initialScreening.updateMany as jest.Mock).mockResolvedValue({ count: 2 });

      // Act
      await (service as any).sendDigestForOrganization(orgId);

      // Assert
      expect(emailSenderService.sendEmail).toHaveBeenCalledWith({
        to: ['user1@example.com', 'user2@example.com'],
        subject: 'Deal Digest: 2 Deals Screened (1 Yes, 1 No)',
        html: expect.stringContaining('Deal Digest'),
      });

      expect(emailSenderService.sendEmail).toHaveBeenCalledTimes(1);
      expect(prismaService.initialScreening.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['screening1', 'screening2'] },
        },
        data: {
          digestSent: true,
          digestSentAt: expect.any(Date),
        },
      });
    });

    it('should skip when no screenings found', async () => {
      // Arrange
      const orgId = 'org123';
      const mockOrg = {
        id: orgId,
        name: 'Test Org',
        users: [{ email: 'user@example.com' }],
      };

      (prismaService.organization.findUnique as jest.Mock).mockResolvedValue(mockOrg);
      (prismaService.initialScreening.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.initialScreening.findMany as jest.Mock).mockResolvedValue([]);

      // Act
      await (service as any).sendDigestForOrganization(orgId);

      // Assert
      expect(emailSenderService.sendEmail).not.toHaveBeenCalled();
      expect(prismaService.initialScreening.updateMany).not.toHaveBeenCalled();
    });

    it('should skip when no valid emails', async () => {
      // Arrange
      const orgId = 'org123';
      const mockOrg = {
        id: orgId,
        name: 'Test Org',
        users: [{ email: null }, { email: null }],
      };

      (prismaService.organization.findUnique as jest.Mock).mockResolvedValue(mockOrg);
      (prismaService.initialScreening.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.initialScreening.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'screening1',
          decision: 'NO' as const,
          reason: 'Test reason',
          screenedAt: new Date(),
          deal: {
            sourceSubject: 'Test',
            sourceFrom: 'test@example.com',
            asset: null,
            receivedByUser: null,
          },
        },
      ]);

      // Act
      await (service as any).sendDigestForOrganization(orgId);

      // Assert
      expect(emailSenderService.sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('formatDigestEmail()', () => {
    it('should format email with screenings and preferences', () => {
      // Arrange
      const screenings = [
        {
          id: 'screening1',
          decision: 'YES' as const,
          reason: 'Meets all criteria',
          screenedAt: new Date('2026-01-24T10:00:00Z'),
          deal: {
            sourceSubject: 'Property Opportunity',
            sourceFrom: 'broker@example.com',
            asset: {
              address: '123 Main St',
              city: 'New York',
              state: 'NY',
            },
            receivedByUser: null,
          },
        },
        {
          id: 'screening2',
          decision: 'NO' as const,
          reason: 'Location not in target area',
          screenedAt: new Date('2026-01-24T11:00:00Z'),
          deal: {
            sourceSubject: 'Deal Offering',
            sourceFrom: 'seller@example.com',
            asset: null,
            receivedByUser: null,
          },
        },
      ];

      const preferences = {
        companyName: 'Test Company',
        brandColor: '#FF0000',
        logoUrl: 'https://example.com/logo.png',
      };

      // Act
      const html = (service as any).formatDigestEmail(screenings, preferences);

      // Assert
      expect(html).toContain('Deal Digest');
      expect(html).toContain('Test Company');
      expect(html).toContain('#FF0000');
      expect(html).toContain('https://example.com/logo.png');
      expect(html).toContain('Property Opportunity');
      expect(html).toContain('broker@example.com');
      expect(html).toContain('123 Main St, New York, NY');
      expect(html).toContain('Meets all criteria');
      expect(html).toContain('Location not in target area');
      expect(html).toContain('YES');
      expect(html).toContain('NO');
    });

    it('should handle missing deal fields', () => {
      // Arrange
      const screenings = [
        {
          id: 'screening1',
          decision: 'NO' as const,
          reason: 'No reason provided',
          screenedAt: new Date('2026-01-24T10:00:00Z'),
          deal: {
            sourceSubject: null,
            sourceFrom: null,
            asset: null,
            receivedByUser: null,
          },
        },
      ];

      const preferences = {
        companyName: 'Test Company',
        brandColor: '#FF0000',
        logoUrl: null,
      };

      // Act
      const html = (service as any).formatDigestEmail(screenings, preferences);

      // Assert
      expect(html).toContain('No subject');
      expect(html).toContain('Unknown sender');
      expect(html).toContain('Location not specified');
      expect(html).toContain('No reason provided');
    });

    it('should escape HTML in deal content', () => {
      // Arrange
      const screenings = [
        {
          id: 'screening1',
          decision: 'NO' as const,
          reason: 'Reason with "quotes"',
          screenedAt: new Date('2026-01-24T10:00:00Z'),
          deal: {
            sourceSubject: 'Deal <script>alert("xss")</script>',
            sourceFrom: 'broker@example.com & Co.',
            asset: null,
            receivedByUser: null,
          },
        },
      ];

      // Act
      const html = (service as any).formatDigestEmail(screenings, null);

      // Assert
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&amp;');
      expect(html).toContain('&quot;quotes&quot;');
      expect(html).not.toContain('<script>');
    });
  });

  describe('escapeHtml()', () => {
    it('should escape HTML special characters', () => {
      // Arrange
      const testCases = [
        { input: 'Test & Company', expected: 'Test &amp; Company' },
        { input: 'Price < 100', expected: 'Price &lt; 100' },
        { input: 'Price > 50', expected: 'Price &gt; 50' },
        { input: 'Say "hello"', expected: 'Say &quot;hello&quot;' },
        { input: "It's a deal", expected: 'It&#039;s a deal' },
        { input: 'All: <>&"\'', expected: 'All: &lt;&gt;&amp;&quot;&#039;' },
      ];

      testCases.forEach(({ input, expected }) => {
        // Act
        const result = (service as any).escapeHtml(input);

        // Assert
        expect(result).toBe(expected);
      });
    });

    it('should not escape safe characters', () => {
      // Arrange
      const input = 'Regular text 123 ABC';

      // Act
      const result = (service as any).escapeHtml(input);

      // Assert
      expect(result).toBe(input);
    });
  });
});
