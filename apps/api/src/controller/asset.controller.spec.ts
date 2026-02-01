import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { AssetController } from './asset.controller';
import { PrismaService } from '../service/prisma/prisma.service';
import { ClerkAuthGuard } from '../guard/clerk-auth.guard';

describe('AssetController', () => {
  let controller: AssetController;
  let prisma: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock };

  beforeEach(async () => {
    const mockFindMany = jest.fn();
    const mockCount = jest.fn();
    const mockFindUnique = jest.fn();
    prisma = { findMany: mockFindMany, count: mockCount, findUnique: mockFindUnique };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssetController],
      providers: [
        {
          provide: PrismaService,
          useValue: { asset: prisma },
        },
      ],
    })
      .overrideGuard(ClerkAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AssetController);
  });

  describe('getAssets', () => {
    it('should return paginated assets and call prisma with correct where', async () => {
      // Arrange
      prisma.findMany.mockResolvedValue([
        { id: 'a1', address: '123 Main St', city: 'Boston', state: 'MA' },
      ]);
      prisma.count.mockResolvedValue(1);

      // Act
      const result = await controller.getAssets(1, 20, 'org-1', undefined);

      // Assert
      expect(prisma.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deals: { some: { organizationId: 'org-1' } } },
          skip: 0,
          take: 20,
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(prisma.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deals: { some: { organizationId: 'org-1' } } },
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it('should apply search filter when search is provided', async () => {
      // Arrange
      prisma.findMany.mockResolvedValue([]);
      prisma.count.mockResolvedValue(0);

      // Act
      await controller.getAssets(1, 20, undefined, 'boston');

      // Assert
      expect(prisma.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { address: { contains: 'boston', mode: 'insensitive' } },
              { city: { contains: 'boston', mode: 'insensitive' } },
              { state: { contains: 'boston', mode: 'insensitive' } },
              { normalizedAddress: { contains: 'boston', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });
  });

  describe('getAsset', () => {
    it('should return asset when found', async () => {
      // Arrange
      const asset = { id: 'a1', address: '123 Main St', city: 'Boston', state: 'MA' };
      prisma.findUnique.mockResolvedValue(asset);

      // Act
      const result = await controller.getAsset('a1');

      // Assert
      expect(prisma.findUnique).toHaveBeenCalledWith({ where: { id: 'a1' } });
      expect(result).toEqual(asset);
    });

    it('should throw NOT_FOUND when asset does not exist', async () => {
      // Arrange
      prisma.findUnique.mockResolvedValue(null);

      // Act / Assert
      await expect(controller.getAsset('nonexistent')).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        message: 'Asset not found',
      });
    });
  });
});
