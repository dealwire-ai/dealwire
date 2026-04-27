import { HttpException } from '@nestjs/common';
import { ParcelDealStageService } from './parcel-deal-stage.service';
import { DEFAULT_PARCEL_DEAL_STAGES } from './parcel-crm-defaults';

describe('ParcelDealStageService', () => {
  let service: ParcelDealStageService;
  let prisma: {
    parcelDealStage: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      createMany: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      delete: jest.Mock;
    };
    parcelDeal: { updateMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      parcelDealStage: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      parcelDeal: { updateMany: jest.fn() },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
    service = new ParcelDealStageService(prisma as any);
  });

  describe('listForOrg', () => {
    it('lazy-seeds defaults when an org has no stages', async () => {
      prisma.parcelDealStage.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(
          DEFAULT_PARCEL_DEAL_STAGES.map((s, i) => ({ ...s, id: `s${i}` })),
        );

      const stages = await service.listForOrg('org_1');

      expect(prisma.parcelDealStage.createMany).toHaveBeenCalledWith({
        data: DEFAULT_PARCEL_DEAL_STAGES.map((s) => ({
          ...s,
          organizationId: 'org_1',
        })),
      });
      expect(stages).toHaveLength(DEFAULT_PARCEL_DEAL_STAGES.length);
    });

    it('does not reseed when stages already exist', async () => {
      prisma.parcelDealStage.findMany.mockResolvedValueOnce([
        { id: 's1', name: 'To Call', isDefault: true, order: 0 },
      ]);

      await service.listForOrg('org_1');

      expect(prisma.parcelDealStage.createMany).not.toHaveBeenCalled();
    });
  });

  describe('getDefaultStageId', () => {
    it('returns the stage marked isDefault', async () => {
      prisma.parcelDealStage.findMany.mockResolvedValue([
        { id: 's0', isDefault: false },
        { id: 's1', isDefault: true },
        { id: 's2', isDefault: false },
      ]);

      await expect(service.getDefaultStageId('org_1')).resolves.toBe('s1');
    });

    it('falls back to the first stage if none is marked default', async () => {
      prisma.parcelDealStage.findMany.mockResolvedValue([
        { id: 'sA', isDefault: false },
        { id: 'sB', isDefault: false },
      ]);

      await expect(service.getDefaultStageId('org_1')).resolves.toBe('sA');
    });
  });

  describe('create', () => {
    it('translates Prisma P2002 unique violation into a 409', async () => {
      prisma.parcelDealStage.findMany.mockResolvedValue([{ order: 7 }]);
      prisma.parcelDealStage.create.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.create({ organizationId: 'org_1', name: 'To Call' }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('appends the new stage to the end (next order)', async () => {
      prisma.parcelDealStage.findMany.mockResolvedValue([
        { order: 0 },
        { order: 1 },
        { order: 2 },
      ]);
      prisma.parcelDealStage.create.mockResolvedValue({ id: 'new' });

      await service.create({ organizationId: 'org_1', name: 'Custom' });

      expect(prisma.parcelDealStage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ order: 3 }),
        }),
      );
    });
  });

  describe('update', () => {
    it('demotes the existing default when promoting another stage', async () => {
      prisma.parcelDealStage.findFirst.mockResolvedValue({
        id: 's2',
        isDefault: false,
      });
      prisma.parcelDealStage.findUnique.mockResolvedValue({ id: 's2' });

      await service.update({
        id: 's2',
        organizationId: 'org_1',
        isDefault: true,
      });

      expect(prisma.parcelDealStage.updateMany).toHaveBeenCalledWith({
        where: { organizationId: 'org_1', isDefault: true },
        data: { isDefault: false },
      });
    });
  });

  describe('reorder', () => {
    it('rejects mismatched ID lists', async () => {
      prisma.parcelDealStage.findMany.mockResolvedValue([
        { id: 's1' },
        { id: 's2' },
      ]);

      await expect(
        service.reorder({ organizationId: 'org_1', orderedIds: ['s1', 's3'] }),
      ).rejects.toBeInstanceOf(HttpException);
    });
  });

  describe('remove', () => {
    it('refuses to delete the default stage', async () => {
      prisma.parcelDealStage.findFirst
        .mockResolvedValueOnce({ id: 's1', isDefault: true })
        .mockResolvedValueOnce({ id: 's2' });

      await expect(
        service.remove({
          id: 's1',
          organizationId: 'org_1',
          replacementStageId: 's2',
        }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('refuses if replacement equals the stage being deleted', async () => {
      await expect(
        service.remove({
          id: 's1',
          organizationId: 'org_1',
          replacementStageId: 's1',
        }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('moves deals onto the replacement before deleting', async () => {
      prisma.parcelDealStage.findFirst
        .mockResolvedValueOnce({ id: 's1', isDefault: false })
        .mockResolvedValueOnce({ id: 's2' });

      await service.remove({
        id: 's1',
        organizationId: 'org_1',
        replacementStageId: 's2',
      });

      // The parcelDeal updateMany call must precede the stage delete inside the same tx.
      const txArgs = prisma.$transaction.mock.calls[0][0];
      expect(txArgs).toHaveLength(2);
      expect(prisma.parcelDeal.updateMany).toHaveBeenCalledWith({
        where: { stageId: 's1' },
        data: { stageId: 's2' },
      });
      expect(prisma.parcelDealStage.delete).toHaveBeenCalledWith({
        where: { id: 's1' },
      });
    });
  });
});
