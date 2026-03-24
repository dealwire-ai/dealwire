import { Injectable, Logger } from '@nestjs/common';
import { ParcelListType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PropertyListService {
  private readonly logger = new Logger(PropertyListService.name);

  constructor(private readonly prisma: PrismaService) {}

  async assign(params: {
    bbl: string;
    organizationId: string;
    userId: string;
    listType: ParcelListType | null;
  }) {
    const parcel = await this.prisma.parcel.findUnique({
      where: { bbl: params.bbl },
      select: { id: true },
    });
    if (!parcel) {
      throw new Error(`Parcel not found: ${params.bbl}`);
    }

    // null = remove from list
    if (params.listType === null) {
      await this.prisma.parcelListAssignment.deleteMany({
        where: {
          parcelId: parcel.id,
          organizationId: params.organizationId,
        },
      });
      return null;
    }

    return this.prisma.parcelListAssignment.upsert({
      where: {
        parcelId_organizationId: {
          parcelId: parcel.id,
          organizationId: params.organizationId,
        },
      },
      create: {
        parcelId: parcel.id,
        organizationId: params.organizationId,
        listType: params.listType,
        assignedBy: params.userId,
      },
      update: {
        listType: params.listType,
        assignedBy: params.userId,
      },
      select: {
        listType: true,
        assignedBy: true,
        updatedAt: true,
      },
    });
  }

  async batchAssign(params: {
    bbls: string[];
    organizationId: string;
    userId: string;
    listType: ParcelListType | null;
  }): Promise<number> {
    const parcels = await this.prisma.parcel.findMany({
      where: { bbl: { in: params.bbls } },
      select: { id: true, bbl: true },
    });

    if (parcels.length === 0) return 0;

    const parcelIds = parcels.map((p) => p.id);

    if (params.listType === null) {
      const result = await this.prisma.parcelListAssignment.deleteMany({
        where: {
          parcelId: { in: parcelIds },
          organizationId: params.organizationId,
        },
      });
      return result.count;
    }

    // Use a transaction to upsert all assignments
    let count = 0;
    await this.prisma.$transaction(
      parcelIds.map((parcelId) =>
        this.prisma.parcelListAssignment.upsert({
          where: {
            parcelId_organizationId: {
              parcelId,
              organizationId: params.organizationId,
            },
          },
          create: {
            parcelId,
            organizationId: params.organizationId,
            listType: params.listType!,
            assignedBy: params.userId,
          },
          update: {
            listType: params.listType!,
            assignedBy: params.userId,
          },
        }),
      ),
    );
    count = parcelIds.length;
    return count;
  }
}
