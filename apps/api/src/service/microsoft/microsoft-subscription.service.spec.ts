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

    service = module.get<MicrosoftSubscriptionService>(MicrosoftSubscriptionService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveDesignatedMonitoringInboxEmailForOrganization', () => {
    it('returns designated email when set and user has valid subscription', async () => {
      (prismaService.screeningPreferences.findUnique as jest.Mock).mockResolvedValue({
        designatedMonitoringInboxEmail: 'designated@example.com',
      });
      (prismaService.user.findFirst as jest.Mock).mockResolvedValueOnce({
        email: 'designated@example.com',
      });

      const result = await service.resolveDesignatedMonitoringInboxEmailForOrganization('org1');

      expect(result).toBe('designated@example.com');
      // Should not call the fallback query
      expect(prismaService.user.findFirst).toHaveBeenCalledTimes(1);
    });

    it('falls back to oldest user when designated email is set but user has no subscription', async () => {
      (prismaService.screeningPreferences.findUnique as jest.Mock).mockResolvedValue({
        designatedMonitoringInboxEmail: 'missing@example.com',
      });
      // First call: designated user lookup — returns null (no subscription)
      // Second call: fallback oldest user query
      (prismaService.user.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ email: 'oldest@example.com' });

      const result = await service.resolveDesignatedMonitoringInboxEmailForOrganization('org1');

      expect(result).toBe('oldest@example.com');
      expect(prismaService.user.findFirst).toHaveBeenCalledTimes(2);
    });

    it('falls back to oldest user when no designated email is set in prefs', async () => {
      (prismaService.screeningPreferences.findUnique as jest.Mock).mockResolvedValue({
        designatedMonitoringInboxEmail: null,
      });
      (prismaService.user.findFirst as jest.Mock).mockResolvedValueOnce({
        email: 'oldest@example.com',
      });

      const result = await service.resolveDesignatedMonitoringInboxEmailForOrganization('org1');

      expect(result).toBe('oldest@example.com');
      // Only the fallback query should run — no designated user lookup
      expect(prismaService.user.findFirst).toHaveBeenCalledTimes(1);
    });

    it('returns null when no users in the org have a subscription', async () => {
      (prismaService.screeningPreferences.findUnique as jest.Mock).mockResolvedValue({
        designatedMonitoringInboxEmail: null,
      });
      (prismaService.user.findFirst as jest.Mock).mockResolvedValueOnce(null);

      const result = await service.resolveDesignatedMonitoringInboxEmailForOrganization('org1');

      expect(result).toBeNull();
    });

    it('handles case-insensitive match on designated email', async () => {
      (prismaService.screeningPreferences.findUnique as jest.Mock).mockResolvedValue({
        designatedMonitoringInboxEmail: 'DESIGNATED@EXAMPLE.COM',
      });
      // Prisma mode: 'insensitive' handles the match on the DB side; simulate it returning the user
      (prismaService.user.findFirst as jest.Mock).mockResolvedValueOnce({
        email: 'designated@example.com',
      });

      const result = await service.resolveDesignatedMonitoringInboxEmailForOrganization('org1');

      expect(result).toBe('designated@example.com');
      expect(prismaService.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            email: { equals: 'DESIGNATED@EXAMPLE.COM', mode: 'insensitive' },
          }),
        }),
      );
    });
  });
});
