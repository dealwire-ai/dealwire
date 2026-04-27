import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_PARCEL_DEAL_STAGES } from './parcel-crm-defaults';

@Injectable()
export class ParcelDealStageService {
  private readonly logger = new Logger(ParcelDealStageService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Lazy-seeds defaults for orgs created after the backfill migration ran.
  async listForOrg(organizationId: string) {
    const existing = await this.prisma.parcelDealStage.findMany({
      where: { organizationId },
      orderBy: { order: 'asc' },
    });
    if (existing.length > 0) return existing;

    await this.prisma.parcelDealStage.createMany({
      data: DEFAULT_PARCEL_DEAL_STAGES.map((s) => ({ ...s, organizationId })),
    });
    return this.prisma.parcelDealStage.findMany({
      where: { organizationId },
      orderBy: { order: 'asc' },
    });
  }

  async getDefaultStageId(organizationId: string): Promise<string> {
    const stages = await this.listForOrg(organizationId);
    const def = stages.find((s) => s.isDefault) ?? stages[0];
    if (!def) {
      throw new HttpException(
        'No stages configured for organization',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return def.id;
  }

  async create(params: {
    organizationId: string;
    name: string;
    color?: string | null;
    isTerminal?: boolean;
  }) {
    const stages = await this.listForOrg(params.organizationId);
    const nextOrder = (stages[stages.length - 1]?.order ?? -1) + 1;
    try {
      return await this.prisma.parcelDealStage.create({
        data: {
          organizationId: params.organizationId,
          name: params.name,
          color: params.color ?? null,
          order: nextOrder,
          isDefault: false,
          isTerminal: params.isTerminal ?? false,
        },
      });
    } catch (err) {
      // P2002 unique violation -> name already in use within org
      if ((err as { code?: string }).code === 'P2002') {
        throw new HttpException(
          `A stage named "${params.name}" already exists`,
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }
  }

  async update(params: {
    id: string;
    organizationId: string;
    name?: string;
    color?: string | null;
    isTerminal?: boolean;
    isDefault?: boolean;
  }) {
    const stage = await this.prisma.parcelDealStage.findFirst({
      where: { id: params.id, organizationId: params.organizationId },
    });
    if (!stage) {
      throw new HttpException('Stage not found', HttpStatus.NOT_FOUND);
    }

    // Promoting a stage to default demotes any other default in the same org.
    if (params.isDefault === true && !stage.isDefault) {
      await this.prisma.$transaction([
        this.prisma.parcelDealStage.updateMany({
          where: { organizationId: params.organizationId, isDefault: true },
          data: { isDefault: false },
        }),
        this.prisma.parcelDealStage.update({
          where: { id: params.id },
          data: {
            ...(params.name !== undefined && { name: params.name }),
            ...(params.color !== undefined && { color: params.color }),
            ...(params.isTerminal !== undefined && {
              isTerminal: params.isTerminal,
            }),
            isDefault: true,
          },
        }),
      ]);
      return this.prisma.parcelDealStage.findUnique({
        where: { id: params.id },
      });
    }

    return this.prisma.parcelDealStage.update({
      where: { id: params.id },
      data: {
        ...(params.name !== undefined && { name: params.name }),
        ...(params.color !== undefined && { color: params.color }),
        ...(params.isTerminal !== undefined && {
          isTerminal: params.isTerminal,
        }),
        ...(params.isDefault === false && { isDefault: false }),
      },
    });
  }

  // Reorder by passing an ordered list of stage IDs. Two-phase write so the
  // (organizationId, order) unique index doesn't collide mid-update.
  async reorder(params: { organizationId: string; orderedIds: string[] }) {
    const stages = await this.prisma.parcelDealStage.findMany({
      where: { organizationId: params.organizationId },
      select: { id: true },
    });
    const owned = new Set(stages.map((s) => s.id));
    if (
      params.orderedIds.length !== stages.length ||
      params.orderedIds.some((id) => !owned.has(id))
    ) {
      throw new HttpException(
        'orderedIds must list every stage belonging to this org exactly once',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Phase 1: park every stage at a high temporary slot to avoid collisions.
    const tempBase = stages.length + 1000;
    await this.prisma.$transaction(
      params.orderedIds.map((id, idx) =>
        this.prisma.parcelDealStage.update({
          where: { id },
          data: { order: tempBase + idx },
        }),
      ),
    );
    // Phase 2: write the real order.
    await this.prisma.$transaction(
      params.orderedIds.map((id, idx) =>
        this.prisma.parcelDealStage.update({
          where: { id },
          data: { order: idx },
        }),
      ),
    );

    return this.listForOrg(params.organizationId);
  }

  // Replacement-stage delete: any deals on the stage are first moved to the
  // replacement, then the stage is removed. Required because the FK is
  // onDelete: Restrict — deleting a stage with deals on it would fail.
  async remove(params: {
    id: string;
    organizationId: string;
    replacementStageId: string;
  }) {
    if (params.id === params.replacementStageId) {
      throw new HttpException(
        'replacementStageId must be a different stage',
        HttpStatus.BAD_REQUEST,
      );
    }

    const [stage, replacement] = await Promise.all([
      this.prisma.parcelDealStage.findFirst({
        where: { id: params.id, organizationId: params.organizationId },
      }),
      this.prisma.parcelDealStage.findFirst({
        where: {
          id: params.replacementStageId,
          organizationId: params.organizationId,
        },
      }),
    ]);
    if (!stage) {
      throw new HttpException('Stage not found', HttpStatus.NOT_FOUND);
    }
    if (!replacement) {
      throw new HttpException(
        'Replacement stage not found in this organization',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (stage.isDefault) {
      throw new HttpException(
        'Cannot delete the default stage. Promote another stage first.',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prisma.$transaction([
      this.prisma.parcelDeal.updateMany({
        where: { stageId: params.id },
        data: { stageId: params.replacementStageId },
      }),
      this.prisma.parcelDealStage.delete({ where: { id: params.id } }),
    ]);

    return { id: params.id, movedTo: params.replacementStageId };
  }
}
