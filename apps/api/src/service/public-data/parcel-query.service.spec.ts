import { ParcelQueryService } from './parcel-query.service';

describe('ParcelQueryService', () => {
  let service: ParcelQueryService;
  let prisma: {
    parcel: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      aggregate: jest.Mock;
      groupBy: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      parcel: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        aggregate: jest.fn(),
        groupBy: jest.fn(),
      },
    };
    service = new ParcelQueryService(prisma as any);
  });

  describe('queryParcels', () => {
    it('should return paginated results with default sort', async () => {
      // Arrange
      const mockParcels = [{ id: 'p1', bbl: '3001230045' }];
      prisma.parcel.findMany.mockResolvedValue(mockParcels);
      prisma.parcel.count.mockResolvedValue(1);

      // Act
      const result = await service.queryParcels({});

      // Assert
      expect(result.data).toEqual(mockParcels);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 50,
        total: 1,
        totalPages: 1,
      });
      expect(prisma.parcel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 50,
          orderBy: { distressScore: { sort: 'desc', nulls: 'last' } },
        }),
      );
    });

    it('should apply borough filter', async () => {
      // Arrange
      prisma.parcel.findMany.mockResolvedValue([]);
      prisma.parcel.count.mockResolvedValue(0);

      // Act
      await service.queryParcels({ boroughs: ['3', '4'] });

      // Assert
      expect(prisma.parcel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            borough: { in: ['3', '4'] },
          }),
        }),
      );
    });

    it('should apply excludeCoops filter', async () => {
      // Arrange
      prisma.parcel.findMany.mockResolvedValue([]);
      prisma.parcel.count.mockResolvedValue(0);

      // Act
      await service.queryParcels({ excludeCoops: true });

      // Assert
      expect(prisma.parcel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isCoopExcluded: false,
          }),
        }),
      );
    });

    it('should apply hasActiveLien filter', async () => {
      // Arrange
      prisma.parcel.findMany.mockResolvedValue([]);
      prisma.parcel.count.mockResolvedValue(0);

      // Act
      await service.queryParcels({ hasActiveLien: true });

      // Assert
      expect(prisma.parcel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            hasActiveLien: true,
          }),
        }),
      );
    });

    it('should apply minDistressScore filter', async () => {
      // Arrange
      prisma.parcel.findMany.mockResolvedValue([]);
      prisma.parcel.count.mockResolvedValue(0);

      // Act
      await service.queryParcels({ minDistressScore: 50 });

      // Assert
      expect(prisma.parcel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            distressScore: { gte: 50 },
          }),
        }),
      );
    });

    it('should apply search filter across address, bbl, and ownerName', async () => {
      // Arrange
      prisma.parcel.findMany.mockResolvedValue([]);
      prisma.parcel.count.mockResolvedValue(0);

      // Act
      await service.queryParcels({ search: 'broadway' });

      // Assert
      expect(prisma.parcel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { address: { contains: 'broadway', mode: 'insensitive' } },
              { bbl: { contains: 'broadway' } },
              { ownerName: { contains: 'broadway', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('should calculate pagination correctly for page 2', async () => {
      // Arrange
      prisma.parcel.findMany.mockResolvedValue([]);
      prisma.parcel.count.mockResolvedValue(120);

      // Act
      const result = await service.queryParcels({ page: 2, limit: 50 });

      // Assert
      expect(prisma.parcel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 50, take: 50 }),
      );
      expect(result.pagination.totalPages).toBe(3);
    });
  });

  describe('getParcelByBbl', () => {
    it('should find parcel by bbl', async () => {
      // Arrange
      const mockParcel = { id: 'p1', bbl: '3001230045' };
      prisma.parcel.findUnique.mockResolvedValue(mockParcel);

      // Act
      const result = await service.getParcelByBbl('3001230045');

      // Assert
      expect(prisma.parcel.findUnique).toHaveBeenCalledWith({
        where: { bbl: '3001230045' },
      });
      expect(result).toEqual(mockParcel);
    });
  });

  describe('getStats', () => {
    it('should return aggregate stats', async () => {
      // Arrange
      prisma.parcel.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(30) // withLiens
        .mockResolvedValueOnce(80) // withPlutoData
        .mockResolvedValueOnce(60) // withViolations
        .mockResolvedValueOnce(50) // withTaxBills
        .mockResolvedValueOnce(20) // withNyctlData
        .mockResolvedValueOnce(40) // withSkipTrace
        .mockResolvedValueOnce(15); // withCompleteData
      prisma.parcel.aggregate
        .mockResolvedValueOnce({
          _avg: { distressScore: 45.67 },
        })
        .mockResolvedValueOnce({
          _sum: { totalOutstandingBalance: 1234567.89 },
        });
      prisma.parcel.groupBy.mockResolvedValue([
        { borough: '3', _count: 60, _avg: { distressScore: 50 } },
        { borough: '4', _count: 40, _avg: { distressScore: 40 } },
      ]);

      // Act
      const result = await service.getStats({});

      // Assert
      expect(result.total).toBe(100);
      expect(result.withActiveLiens).toBe(30);
      expect(result.avgDistressScore).toBe(45.7);
      expect(result.byBorough).toHaveLength(2);
      expect(result.byBorough[0]).toEqual({
        borough: '3',
        count: 60,
        avgScore: 50,
      });
      expect(result.totalOutstandingDebt).toBe(1234567.89);
      expect(result.withPlutoData).toBe(80);
      expect(result.withViolations).toBe(60);
      expect(result.withTaxBills).toBe(50);
      expect(result.withNyctlData).toBe(20);
      expect(result.withSkipTrace).toBe(40);
      expect(result.withCompleteData).toBe(15);
    });
  });
});
