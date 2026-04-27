import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ParcelActivityType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ParcelDealStageService } from './parcel-deal-stage.service';
import { userInitials } from './parcel-crm-defaults';

type DealRow = Prisma.ParcelDealGetPayload<{
  include: {
    stage: { select: { id: true; name: true; color: true; isTerminal: true } };
    assignedToUser: {
      select: { id: true; firstName: true; lastName: true; email: true };
    };
    parcel: {
      select: {
        bbl: true;
        address: true;
        borough: true;
        zipCode: true;
        buildingClass: true;
        distressScore: true;
      };
    };
  };
}>;

const DEAL_INCLUDE = {
  stage: { select: { id: true, name: true, color: true, isTerminal: true } },
  assignedToUser: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  parcel: {
    select: {
      bbl: true,
      address: true,
      borough: true,
      zipCode: true,
      buildingClass: true,
      distressScore: true,
    },
  },
} as const;

@Injectable()
export class ParcelDealService {
  private readonly logger = new Logger(ParcelDealService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stages: ParcelDealStageService,
  ) {}

  // Pulls every deal for the org with optional filters. The board reads this.
  async list(params: {
    organizationId: string;
    stageId?: string;
    assignedToUserId?: string | 'unassigned';
  }): Promise<DealRow[]> {
    return this.prisma.parcelDeal.findMany({
      where: {
        organizationId: params.organizationId,
        ...(params.stageId && { stageId: params.stageId }),
        ...(params.assignedToUserId === 'unassigned'
          ? { assignedToUserId: null }
          : params.assignedToUserId
            ? { assignedToUserId: params.assignedToUserId }
            : {}),
      },
      include: DEAL_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getByBbl(bbl: string, organizationId: string): Promise<DealRow | null> {
    const parcel = await this.prisma.parcel.findUnique({
      where: { bbl },
      select: { id: true },
    });
    if (!parcel) return null;
    return this.prisma.parcelDeal.findUnique({
      where: {
        parcelId_organizationId: {
          parcelId: parcel.id,
          organizationId,
        },
      },
      include: DEAL_INCLUDE,
    });
  }

  async moveStage(params: {
    bbl: string;
    organizationId: string;
    actingUserId: string;
    toStageId: string;
  }) {
    const stage = await this.prisma.parcelDealStage.findFirst({
      where: {
        id: params.toStageId,
        organizationId: params.organizationId,
      },
    });
    if (!stage) {
      throw new HttpException(
        'Target stage not found in this organization',
        HttpStatus.BAD_REQUEST,
      );
    }
    const deal = await this.upsertDeal({
      bbl: params.bbl,
      organizationId: params.organizationId,
      stageId: params.toStageId,
    });

    await this.writeActivity({
      parcelId: deal.parcelId,
      organizationId: params.organizationId,
      userId: params.actingUserId,
      type: ParcelActivityType.STAGE_CHANGED,
      metadata: {
        toStageId: params.toStageId,
        toStageName: stage.name,
      },
    });

    return this.prisma.parcelDeal.findUnique({
      where: { id: deal.id },
      include: DEAL_INCLUDE,
    });
  }

  async assign(params: {
    bbl: string;
    organizationId: string;
    actingUserId: string;
    assignedToUserId: string | null; // null = unassign
  }) {
    if (params.assignedToUserId) {
      await this.assertUserInOrg(
        params.assignedToUserId,
        params.organizationId,
      );
    }

    const deal = await this.upsertDeal({
      bbl: params.bbl,
      organizationId: params.organizationId,
    });

    const updated = await this.prisma.parcelDeal.update({
      where: { id: deal.id },
      data: {
        assignedToUserId: params.assignedToUserId,
        assignedByUserId: params.assignedToUserId ? params.actingUserId : null,
        assignedAt: params.assignedToUserId ? new Date() : null,
      },
      include: DEAL_INCLUDE,
    });

    await this.writeActivity({
      parcelId: deal.parcelId,
      organizationId: params.organizationId,
      userId: params.actingUserId,
      type:
        params.assignedToUserId === null
          ? ParcelActivityType.UNASSIGNED
          : ParcelActivityType.ASSIGNED,
      metadata: {
        toUserId: params.assignedToUserId,
      },
    });

    return updated;
  }

  // Bulk path. Each row gets its own activity entry so the timeline is preserved.
  async bulkAssign(params: {
    bbls: string[];
    organizationId: string;
    actingUserId: string;
    assignedToUserId: string | null;
  }): Promise<{ updated: number }> {
    if (params.bbls.length === 0) return { updated: 0 };

    if (params.assignedToUserId) {
      await this.assertUserInOrg(
        params.assignedToUserId,
        params.organizationId,
      );
    }

    const parcels = await this.prisma.parcel.findMany({
      where: { bbl: { in: params.bbls } },
      select: { id: true, bbl: true },
    });
    if (parcels.length === 0) return { updated: 0 };

    const defaultStageId = await this.stages.getDefaultStageId(
      params.organizationId,
    );

    // Upsert deal rows for any parcel that doesn't yet have one in this org.
    await this.prisma.$transaction(
      parcels.map((p) =>
        this.prisma.parcelDeal.upsert({
          where: {
            parcelId_organizationId: {
              parcelId: p.id,
              organizationId: params.organizationId,
            },
          },
          create: {
            parcelId: p.id,
            organizationId: params.organizationId,
            stageId: defaultStageId,
            assignedToUserId: params.assignedToUserId,
            assignedByUserId: params.assignedToUserId
              ? params.actingUserId
              : null,
            assignedAt: params.assignedToUserId ? new Date() : null,
          },
          update: {
            assignedToUserId: params.assignedToUserId,
            assignedByUserId: params.assignedToUserId
              ? params.actingUserId
              : null,
            assignedAt: params.assignedToUserId ? new Date() : null,
          },
        }),
      ),
    );

    const initials = await this.resolveInitials(params.actingUserId);
    await this.prisma.parcelActivity.createMany({
      data: parcels.map((p) => ({
        parcelId: p.id,
        organizationId: params.organizationId,
        userId: params.actingUserId,
        userInitials: initials,
        type:
          params.assignedToUserId === null
            ? ParcelActivityType.UNASSIGNED
            : ParcelActivityType.ASSIGNED,
        metadata: { toUserId: params.assignedToUserId, bulk: true },
      })),
    });

    return { updated: parcels.length };
  }

  async setFollowUp(params: {
    bbl: string;
    organizationId: string;
    actingUserId: string;
    followUpAt: Date | null;
  }) {
    const deal = await this.upsertDeal({
      bbl: params.bbl,
      organizationId: params.organizationId,
    });

    const updated = await this.prisma.parcelDeal.update({
      where: { id: deal.id },
      data: { nextFollowUpAt: params.followUpAt },
      include: DEAL_INCLUDE,
    });

    await this.writeActivity({
      parcelId: deal.parcelId,
      organizationId: params.organizationId,
      userId: params.actingUserId,
      type:
        params.followUpAt === null
          ? ParcelActivityType.FOLLOWUP_COMPLETED
          : ParcelActivityType.FOLLOWUP_SCHEDULED,
      metadata: {
        followUpAt: params.followUpAt?.toISOString() ?? null,
      },
    });

    return updated;
  }

  // Internal: ensure a ParcelDeal row exists. New rows land on the default stage.
  private async upsertDeal(params: {
    bbl: string;
    organizationId: string;
    stageId?: string;
  }) {
    const parcel = await this.prisma.parcel.findUnique({
      where: { bbl: params.bbl },
      select: { id: true },
    });
    if (!parcel) {
      throw new HttpException('Parcel not found', HttpStatus.NOT_FOUND);
    }
    const stageId =
      params.stageId ??
      (await this.stages.getDefaultStageId(params.organizationId));

    return this.prisma.parcelDeal.upsert({
      where: {
        parcelId_organizationId: {
          parcelId: parcel.id,
          organizationId: params.organizationId,
        },
      },
      create: {
        parcelId: parcel.id,
        organizationId: params.organizationId,
        stageId,
      },
      update: params.stageId ? { stageId: params.stageId } : {},
    });
  }

  private async assertUserInOrg(userId: string, organizationId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!user || user.organizationId !== organizationId) {
      throw new HttpException(
        'Assignee is not a member of this organization',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async resolveInitials(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    return userInitials(user);
  }

  // Single-row activity write used by stage/assign/follow-up paths.
  private async writeActivity(params: {
    parcelId: string;
    organizationId: string;
    userId: string;
    type: ParcelActivityType;
    metadata?: Prisma.InputJsonValue;
  }) {
    const initials = await this.resolveInitials(params.userId);
    await this.prisma.parcelActivity.create({
      data: {
        parcelId: params.parcelId,
        organizationId: params.organizationId,
        userId: params.userId,
        userInitials: initials,
        type: params.type,
        metadata: params.metadata ?? Prisma.JsonNull,
      },
    });
  }
}
