import { Test, TestingModule } from '@nestjs/testing';
import { MicrosoftSubscriptionService } from './microsoft-subscription.service';
import { PrismaService } from '../prisma/prisma.service';
import { MicrosoftGraphService } from './microsoft-graph.service';

describe('MicrosoftSubscriptionService', () => {
  let service: MicrosoftSubscriptionService;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MicrosoftSubscriptionService,
        {
          provide: PrismaService,
          useValue: {
            screeningPreferences: {
              findUnique: jest.fn(),
            },
            user: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
            },
            microsoftSubscription: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {
          provide: MicrosoftGraphService,
          useValue: {
            getMicrosoftOAuthTokenFromClerk: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MicrosoftSubscriptionService>(
      MicrosoftSubscriptionService,
    );
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveMonitoredInboxEmailsForOrganization', () => {
    it('returns designated emails when set and users have valid subscriptions', async () => {
      (
        prismaService.screeningPreferences.findUnique as jest.Mock
      ).mockResolvedValue({
        designatedMonitoringInboxEmails: [
          'alice@example.com',
          'bob@example.com',
        ],
      });
      (prismaService.user.findMany as jest.Mock).mockResolvedValueOnce([
        { email: 'alice@example.com' },
        { email: 'bob@example.com' },
      ]);

      const result =
        await service.resolveMonitoredInboxEmailsForOrganization('org1');

      expect(result).toEqual(['alice@example.com', 'bob@example.com']);
      // Should not call the fallback query
      expect(prismaService.user.findFirst).not.toHaveBeenCalled();
    });

    it('returns only the designated users that have a live subscription', async () => {
      (
        prismaService.screeningPreferences.findUnique as jest.Mock
      ).mockResolvedValue({
        designatedMonitoringInboxEmails: [
          'alice@example.com',
          'bob@example.com',
        ],
      });
      // DB filter drops bob — only alice has a subscription
      (prismaService.user.findMany as jest.Mock).mockResolvedValueOnce([
        { email: 'alice@example.com' },
      ]);

      const result =
        await service.resolveMonitoredInboxEmailsForOrganization('org1');

      expect(result).toEqual(['alice@example.com']);
      expect(prismaService.user.findFirst).not.toHaveBeenCalled();
    });

    it('falls back to oldest user when none of the designated users have subscriptions', async () => {
      (
        prismaService.screeningPreferences.findUnique as jest.Mock
      ).mockResolvedValue({
        designatedMonitoringInboxEmails: ['missing@example.com'],
      });
      (prismaService.user.findMany as jest.Mock).mockResolvedValueOnce([]);
      (prismaService.user.findFirst as jest.Mock).mockResolvedValueOnce({
        email: 'oldest@example.com',
      });

      const result =
        await service.resolveMonitoredInboxEmailsForOrganization('org1');

      expect(result).toEqual(['oldest@example.com']);
      expect(prismaService.user.findFirst).toHaveBeenCalledTimes(1);
    });

    it('falls back to oldest user when no designated emails are set in prefs', async () => {
      (
        prismaService.screeningPreferences.findUnique as jest.Mock
      ).mockResolvedValue({
        designatedMonitoringInboxEmails: [],
      });
      (prismaService.user.findFirst as jest.Mock).mockResolvedValueOnce({
        email: 'oldest@example.com',
      });

      const result =
        await service.resolveMonitoredInboxEmailsForOrganization('org1');

      expect(result).toEqual(['oldest@example.com']);
      // findMany should not be called when the list is empty
      expect(prismaService.user.findMany).not.toHaveBeenCalled();
    });

    it('returns an empty array when no users in the org have a subscription', async () => {
      (
        prismaService.screeningPreferences.findUnique as jest.Mock
      ).mockResolvedValue({
        designatedMonitoringInboxEmails: [],
      });
      (prismaService.user.findFirst as jest.Mock).mockResolvedValueOnce(null);

      const result =
        await service.resolveMonitoredInboxEmailsForOrganization('org1');

      expect(result).toEqual([]);
    });

    it('passes the designated list to the DB with case-insensitive mode', async () => {
      (
        prismaService.screeningPreferences.findUnique as jest.Mock
      ).mockResolvedValue({
        designatedMonitoringInboxEmails: ['DESIGNATED@EXAMPLE.COM'],
      });
      (prismaService.user.findMany as jest.Mock).mockResolvedValueOnce([
        { email: 'designated@example.com' },
      ]);

      const result =
        await service.resolveMonitoredInboxEmailsForOrganization('org1');

      expect(result).toEqual(['designated@example.com']);
      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            email: { in: ['DESIGNATED@EXAMPLE.COM'], mode: 'insensitive' },
          }),
        }),
      );
    });
  });
});
