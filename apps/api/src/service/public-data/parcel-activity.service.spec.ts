import { ParcelActivityType, PhoneStatus } from '@prisma/client';
import { ParcelActivityService } from './parcel-activity.service';

describe('ParcelActivityService', () => {
  let service: ParcelActivityService;
  let prisma: {
    parcel: { findUnique: jest.Mock };
    parcelActivity: { findMany: jest.Mock; create: jest.Mock };
    user: { findUnique: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      parcel: { findUnique: jest.fn() },
      parcelActivity: { findMany: jest.fn(), create: jest.fn() },
      user: { findUnique: jest.fn() },
    };
    service = new ParcelActivityService(prisma as any);
  });

  describe('create', () => {
    beforeEach(() => {
      prisma.parcel.findUnique.mockResolvedValue({ id: 'p1' });
      prisma.user.findUnique.mockResolvedValue({
        firstName: 'Daniel',
        lastName: 'Gabay',
      });
      prisma.parcelActivity.create.mockResolvedValue({ id: 'a1' });
    });

    it('rejects system-generated types like STAGE_CHANGED', async () => {
      await expect(
        service.create({
          bbl: '3000010001',
          organizationId: 'org_1',
          userId: 'u1',
          type: ParcelActivityType.STAGE_CHANGED,
        }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('requires phoneNumber and phoneStatus for PHONE_STATUS_CHANGED', async () => {
      await expect(
        service.create({
          bbl: '3000010001',
          organizationId: 'org_1',
          userId: 'u1',
          type: ParcelActivityType.PHONE_STATUS_CHANGED,
        }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('writes a NOTE with derived initials', async () => {
      await service.create({
        bbl: '3000010001',
        organizationId: 'org_1',
        userId: 'u1',
        type: ParcelActivityType.NOTE,
        body: 'left voicemail',
      });

      expect(prisma.parcelActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: ParcelActivityType.NOTE,
            body: 'left voicemail',
            userInitials: 'DG',
          }),
        }),
      );
    });
  });

  describe('latestPhoneStatuses', () => {
    it('returns the most recent row per phone number', async () => {
      prisma.parcel.findUnique.mockResolvedValue({ id: 'p1' });
      prisma.parcelActivity.findMany.mockResolvedValue([
        // findMany already orders by occurredAt desc — service dedups by phone
        {
          phoneNumber: '212-555-0001',
          phoneStatus: PhoneStatus.GOOD,
          body: 'newest',
          occurredAt: new Date('2026-04-25'),
          userInitials: 'DS',
        },
        {
          phoneNumber: '212-555-0001',
          phoneStatus: PhoneStatus.BAD,
          body: 'older',
          occurredAt: new Date('2026-04-20'),
          userInitials: 'DS',
        },
        {
          phoneNumber: '212-555-0002',
          phoneStatus: PhoneStatus.UNKNOWN,
          body: null,
          occurredAt: new Date('2026-04-22'),
          userInitials: 'DG',
        },
      ]);

      const result = await service.latestPhoneStatuses({
        bbl: '3000010001',
        organizationId: 'org_1',
      });

      expect(result).toHaveLength(2);
      expect(
        result.find((r) => r.phoneNumber === '212-555-0001'),
      ).toMatchObject({ phoneStatus: PhoneStatus.GOOD, body: 'newest' });
      expect(
        result.find((r) => r.phoneNumber === '212-555-0002'),
      ).toMatchObject({ phoneStatus: PhoneStatus.UNKNOWN });
    });
  });
});
