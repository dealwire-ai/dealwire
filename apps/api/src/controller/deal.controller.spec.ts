import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { DealController } from './deal.controller';
import { PrismaService } from '../service/prisma/prisma.service';
import { ClerkAuthGuard } from '../guard/clerk-auth.guard';
import { RequireOrgGuard } from '../guard/require-org.guard';

describe('DealController', () => {
  let controller: DealController;
  let prisma: {
    deal: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock };
  };

  beforeEach(async () => {
    const mockDealFindMany = jest.fn();
    const mockDealCount = jest.fn();
    const mockDealFindUnique = jest.fn();
    prisma = {
      deal: {
        findMany: mockDealFindMany,
        count: mockDealCount,
        findUnique: mockDealFindUnique,
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DealController],
      providers: [
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    })
      .overrideGuard(ClerkAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RequireOrgGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(DealController);
  });

  describe('getDeal', () => {
    it('should return deal with contact and initialScreening when found', async () => {
      // Arrange
      const deal = {
        id: 'd1',
        organizationId: 'org-1',
        contact: { id: 'c1', email: 'a@b.com' },
        initialScreening: { decision: 'YES', reason: 'Good fit' },
      };
      prisma.deal.findUnique.mockResolvedValue(deal);

      // Act
      const result = await controller.getDeal('org-1', 'd1');

      // Assert
      expect(prisma.deal.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'd1' },
          include: expect.objectContaining({
            contact: true,
            initialScreening: true,
          }),
        }),
      );
      expect(result).toEqual(deal);
    });

    it('should throw NOT_FOUND when deal does not exist', async () => {
      // Arrange
      prisma.deal.findUnique.mockResolvedValue(null);

      // Act / Assert
      await expect(
        controller.getDeal('org-1', 'nonexistent'),
      ).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        message: 'Deal not found',
      });
    });

    it('should throw NOT_FOUND when deal belongs to different org', async () => {
      // Arrange
      const deal = { id: 'd1', organizationId: 'org-other' };
      prisma.deal.findUnique.mockResolvedValue(deal);

      // Act / Assert
      await expect(controller.getDeal('org-1', 'd1')).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        message: 'Deal not found',
      });
    });
  });

  describe('getDeals', () => {
    it('should return paginated deals', async () => {
      // Arrange
      prisma.deal.findMany.mockResolvedValue([{ id: 'd1' }]);
      prisma.deal.count.mockResolvedValue(1);

      // Act
      const result = await controller.getDeals('org-1', 'user-1', 1, 20);

      // Assert
      expect(prisma.deal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1' },
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });
  });
});
