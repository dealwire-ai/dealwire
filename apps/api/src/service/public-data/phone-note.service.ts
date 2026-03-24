import { Injectable, Logger } from '@nestjs/common';
import { PhoneStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PhoneNoteService {
  private readonly logger = new Logger(PhoneNoteService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getNotesForParcel(parcelId: string, organizationId: string) {
    return this.prisma.phoneNote.findMany({
      where: { parcelId, organizationId },
      select: {
        id: true,
        phoneNumber: true,
        status: true,
        note: true,
        userInitials: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async upsertNote(params: {
    bbl: string;
    phoneNumber: string;
    organizationId: string;
    userId: string;
    status?: PhoneStatus;
    note?: string;
  }) {
    const parcel = await this.prisma.parcel.findUnique({
      where: { bbl: params.bbl },
      select: { id: true },
    });
    if (!parcel) {
      throw new Error(`Parcel not found: ${params.bbl}`);
    }

    // Derive initials from User record
    const user = await this.prisma.user.findUnique({
      where: { id: params.userId },
      select: { firstName: true, lastName: true },
    });
    const initials =
      (
        (user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '')
      ).toUpperCase() || '??';

    const phoneNote = await this.prisma.phoneNote.upsert({
      where: {
        parcelId_phoneNumber_organizationId: {
          parcelId: parcel.id,
          phoneNumber: params.phoneNumber,
          organizationId: params.organizationId,
        },
      },
      create: {
        parcelId: parcel.id,
        phoneNumber: params.phoneNumber,
        organizationId: params.organizationId,
        userId: params.userId,
        userInitials: initials,
        status: params.status ?? PhoneStatus.UNKNOWN,
        note: params.note ?? null,
      },
      update: {
        userId: params.userId,
        userInitials: initials,
        ...(params.status !== undefined && { status: params.status }),
        ...(params.note !== undefined && { note: params.note }),
      },
      select: {
        id: true,
        phoneNumber: true,
        status: true,
        note: true,
        userInitials: true,
        updatedAt: true,
      },
    });

    return { phoneNote };
  }
}
