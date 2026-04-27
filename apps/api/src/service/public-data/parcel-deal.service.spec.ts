import { ParcelActivityType } from '@prisma/client';
import { ParcelDealService } from './parcel-deal.service';

describe('ParcelDealService', () => {
  let service: ParcelDealService;
  let prisma: {
    parcel: { findUnique: jest.Mock; findMany: jest.Mock };
    parcelDealStage: { findFirst: jest.Mock };
    parcelDeal: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
    };
    parcelActivity: { create: jest.Mock; createMany: jest.Mock };
    user: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let stages: { getDefaultStageId: jest.Mock };

  beforeEach(() => {
    prisma = {
      parcel: { findUnique: jest.fn(), findMany: jest.fn() },
      parcelDealStage: { findFirst: jest.fn() },
      parcelDeal: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      parcelActivity: { create: jest.fn(), createMany: jest.fn() },
      user: { findUnique: jest.fn() },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
    stages = {
      getDefaultStageId: jest.fn().mockResolvedValue('default_stage'),
    };
    service = new ParcelDealService(prisma as any, stages as any);
  });

  describe('assign', () => {
    beforeEach(() => {
      prisma.parcel.findUnique.mockResolvedValue({ id: 'p1' });
      prisma.parcelDeal.upsert.mockResolvedValue({ id: 'd1', parcelId: 'p1' });
      prisma.parcelDeal.update.mockResolvedValue({ id: 'd1' });
      prisma.user.findUnique.mockResolvedValue({
        firstName: 'David',
        lastName: 'Smith',
        organizationId: 'org_1',
      });
    });

    it('writes an ASSIGNED activity when assigning to a user', async () => {
      await service.assign({
        bbl: '3000010001',
        organizationId: 'org_1',
        actingUserId: 'u_acting',
        assignedToUserId: 'u_target',
      });

      expect(prisma.parcelActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: ParcelActivityType.ASSIGNED,
            metadata: { toUserId: 'u_target' },
          }),
        }),
      );
    });

    it('writes an UNASSIGNED activity when assignedToUserId is null', async () => {
      await service.assign({
        bbl: '3000010001',
        organizationId: 'org_1',
        actingUserId: 'u_acting',
        assignedToUserId: null,
      });

      expect(prisma.parcelActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: ParcelActivityType.UNASSIGNED,
          }),
        }),
      );
    });

    it('rejects assigning to a user from a different org', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        organizationId: 'other_org',
      });

      await expect(
        service.assign({
          bbl: '3000010001',
          organizationId: 'org_1',
          actingUserId: 'u_acting',
          assignedToUserId: 'u_target',
        }),
      ).rejects.toMatchObject({ status: 400 });
    });
  });

  describe('moveStage', () => {
    it('writes a STAGE_CHANGED activity carrying the target stage', async () => {
      prisma.parcelDealStage.findFirst.mockResolvedValue({
        id: 's_new',
        name: 'Contacted',
      });
      prisma.parcel.findUnique.mockResolvedValue({ id: 'p1' });
      prisma.parcelDeal.upsert.mockResolvedValue({ id: 'd1', parcelId: 'p1' });
      prisma.parcelDeal.findUnique.mockResolvedValue({ id: 'd1' });
      prisma.user.findUnique.mockResolvedValue({
        firstName: 'A',
        lastName: 'B',
      });

      await service.moveStage({
        bbl: '3000010001',
        organizationId: 'org_1',
        actingUserId: 'u_acting',
        toStageId: 's_new',
      });

      expect(prisma.parcelActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: ParcelActivityType.STAGE_CHANGED,
            metadata: { toStageId: 's_new', toStageName: 'Contacted' },
          }),
        }),
      );
    });

    it('rejects moving to a stage that belongs to a different org', async () => {
      prisma.parcelDealStage.findFirst.mockResolvedValue(null);

      await expect(
        service.moveStage({
          bbl: '3000010001',
          organizationId: 'org_1',
          actingUserId: 'u_acting',
          toStageId: 's_other',
        }),
      ).rejects.toMatchObject({ status: 400 });
    });
  });

  describe('bulkAssign', () => {
    it('writes one activity per parcel', async () => {
      prisma.parcel.findMany.mockResolvedValue([
        { id: 'p1', bbl: '3000010001' },
        { id: 'p2', bbl: '3000010002' },
        { id: 'p3', bbl: '3000010003' },
      ]);
      prisma.user.findUnique.mockResolvedValue({
        firstName: 'D',
        lastName: 'G',
        organizationId: 'org_1',
      });

      await service.bulkAssign({
        bbls: ['3000010001', '3000010002', '3000010003'],
        organizationId: 'org_1',
        actingUserId: 'u_acting',
        assignedToUserId: 'u_target',
      });

      expect(prisma.parcelActivity.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            parcelId: 'p1',
            type: ParcelActivityType.ASSIGNED,
            metadata: { toUserId: 'u_target', bulk: true },
          }),
          expect.objectContaining({ parcelId: 'p2' }),
          expect.objectContaining({ parcelId: 'p3' }),
        ]),
      });
    });

    it('returns updated:0 with no DB writes when bbls is empty', async () => {
      const result = await service.bulkAssign({
        bbls: [],
        organizationId: 'org_1',
        actingUserId: 'u_acting',
        assignedToUserId: 'u_target',
      });

      expect(result).toEqual({ updated: 0 });
      expect(prisma.parcel.findMany).not.toHaveBeenCalled();
      expect(prisma.parcelActivity.createMany).not.toHaveBeenCalled();
    });
  });
});
