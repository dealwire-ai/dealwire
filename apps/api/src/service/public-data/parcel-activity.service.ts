import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ParcelActivityType, PhoneStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { userInitials } from './parcel-crm-defaults';

const USER_FACING_TYPES = new Set<ParcelActivityType>([
  ParcelActivityType.CALL,
  ParcelActivityType.NOTE,
  ParcelActivityType.PHONE_STATUS_CHANGED,
]);

@Injectable()
export class ParcelActivityService {
  private readonly logger = new Logger(ParcelActivityService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listForParcel(params: {
    bbl: string;
    organizationId: string;
    limit?: number;
  }) {
    const parcel = await this.prisma.parcel.findUnique({
      where: { bbl: params.bbl },
      select: { id: true },
    });
    if (!parcel) {
      throw new HttpException('Parcel not found', HttpStatus.NOT_FOUND);
    }

    return this.prisma.parcelActivity.findMany({
      where: {
        parcelId: parcel.id,
        organizationId: params.organizationId,
      },
      orderBy: { occurredAt: 'desc' },
      take: params.limit ?? 100,
      select: {
        id: true,
        type: true,
        body: true,
        phoneNumber: true,
        phoneStatus: true,
        userInitials: true,
        userId: true,
        metadata: true,
        occurredAt: true,
      },
    });
  }

  // Returns the latest non-null phoneStatus per phoneNumber for a parcel.
  // Replaces the read path that PhoneNote currently serves.
  async latestPhoneStatuses(params: { bbl: string; organizationId: string }) {
    const parcel = await this.prisma.parcel.findUnique({
      where: { bbl: params.bbl },
      select: { id: true },
    });
    if (!parcel) return [];

    const rows = await this.prisma.parcelActivity.findMany({
      where: {
        parcelId: parcel.id,
        organizationId: params.organizationId,
        phoneStatus: { not: null },
        phoneNumber: { not: null },
      },
      orderBy: { occurredAt: 'desc' },
      select: {
        phoneNumber: true,
        phoneStatus: true,
        body: true,
        userInitials: true,
        occurredAt: true,
      },
    });

    const seen = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (row.phoneNumber && !seen.has(row.phoneNumber)) {
        seen.set(row.phoneNumber, row);
      }
    }
    return Array.from(seen.values());
  }

  async create(params: {
    bbl: string;
    organizationId: string;
    userId: string;
    type: ParcelActivityType;
    body?: string | null;
    phoneNumber?: string | null;
    phoneStatus?: PhoneStatus | null;
    occurredAt?: Date;
  }) {
    if (!USER_FACING_TYPES.has(params.type)) {
      throw new HttpException(
        `Activity type ${params.type} is system-generated and cannot be created via this endpoint`,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (
      params.type === ParcelActivityType.PHONE_STATUS_CHANGED &&
      (!params.phoneNumber || !params.phoneStatus)
    ) {
      throw new HttpException(
        'PHONE_STATUS_CHANGED requires phoneNumber and phoneStatus',
        HttpStatus.BAD_REQUEST,
      );
    }

    const parcel = await this.prisma.parcel.findUnique({
      where: { bbl: params.bbl },
      select: { id: true },
    });
    if (!parcel) {
      throw new HttpException('Parcel not found', HttpStatus.NOT_FOUND);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: params.userId },
      select: { firstName: true, lastName: true },
    });
    const initials = userInitials(user);

    return this.prisma.parcelActivity.create({
      data: {
        parcelId: parcel.id,
        organizationId: params.organizationId,
        userId: params.userId,
        userInitials: initials,
        type: params.type,
        body: params.body ?? null,
        phoneNumber: params.phoneNumber ?? null,
        phoneStatus: params.phoneStatus ?? null,
        occurredAt: params.occurredAt ?? new Date(),
        metadata: Prisma.JsonNull,
      },
      select: {
        id: true,
        type: true,
        body: true,
        phoneNumber: true,
        phoneStatus: true,
        userInitials: true,
        userId: true,
        occurredAt: true,
      },
    });
  }
}
