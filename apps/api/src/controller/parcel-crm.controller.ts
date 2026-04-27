import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ParcelActivityType, PhoneStatus } from '@prisma/client';
import { ClerkAuthGuard } from '../guard/clerk-auth.guard';
import { RequireOrgGuard } from '../guard/require-org.guard';
import { AuthUser } from '../decorator/auth-user.decorator';
import { PrismaService } from '../service/prisma/prisma.service';
import { ParcelDealStageService } from '../service/public-data/parcel-deal-stage.service';
import { ParcelDealService } from '../service/public-data/parcel-deal.service';
import { ParcelActivityService } from '../service/public-data/parcel-activity.service';
import { resolveFeatureFlags } from '../util/feature-flags';

@Controller('public-data/crm')
@UseGuards(ClerkAuthGuard, RequireOrgGuard)
export class ParcelCrmController {
  private readonly logger = new Logger(ParcelCrmController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stages: ParcelDealStageService,
    private readonly deals: ParcelDealService,
    private readonly activities: ParcelActivityService,
  ) {}

  // Mirrors the helper on PublicDataController. Three lines isn't worth a
  // shared abstraction yet — copy-paste is fine until a third caller appears.
  private async assertParcelsEnabled(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { featureFlags: true },
    });
    const flags = resolveFeatureFlags(org?.featureFlags);
    if (!flags.parcels) {
      throw new HttpException(
        'Parcels feature is not enabled for this organization',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  // ----- Stages -----

  @Get('stages')
  async listStages(@AuthUser('organizationId') organizationId: string) {
    await this.assertParcelsEnabled(organizationId);
    const stages = await this.stages.listForOrg(organizationId);
    return { stages };
  }

  @Post('stages')
  async createStage(
    @AuthUser('organizationId') organizationId: string,
    @Body() body: { name: string; color?: string | null; isTerminal?: boolean },
  ) {
    await this.assertParcelsEnabled(organizationId);
    if (!body.name?.trim()) {
      throw new HttpException('name is required', HttpStatus.BAD_REQUEST);
    }
    const stage = await this.stages.create({
      organizationId,
      name: body.name.trim(),
      color: body.color ?? null,
      isTerminal: body.isTerminal ?? false,
    });
    return { stage };
  }

  // Must come BEFORE PATCH stages/:id so 'reorder' isn't matched as :id.
  @Patch('stages/reorder')
  async reorderStages(
    @AuthUser('organizationId') organizationId: string,
    @Body() body: { orderedIds: string[] },
  ) {
    await this.assertParcelsEnabled(organizationId);
    if (!Array.isArray(body.orderedIds) || body.orderedIds.length === 0) {
      throw new HttpException('orderedIds is required', HttpStatus.BAD_REQUEST);
    }
    const stages = await this.stages.reorder({
      organizationId,
      orderedIds: body.orderedIds,
    });
    return { stages };
  }

  @Patch('stages/:id')
  async updateStage(
    @AuthUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      color?: string | null;
      isTerminal?: boolean;
      isDefault?: boolean;
    },
  ) {
    await this.assertParcelsEnabled(organizationId);
    const stage = await this.stages.update({
      id,
      organizationId,
      name: body.name?.trim(),
      color: body.color,
      isTerminal: body.isTerminal,
      isDefault: body.isDefault,
    });
    return { stage };
  }

  @Delete('stages/:id')
  async deleteStage(
    @AuthUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Query('replacementStageId') replacementStageId?: string,
  ) {
    await this.assertParcelsEnabled(organizationId);
    if (!replacementStageId) {
      throw new HttpException(
        'replacementStageId query param is required — pick another stage to move existing deals to',
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.stages.remove({
      id,
      organizationId,
      replacementStageId,
    });
  }

  // ----- Deals -----

  @Get('deals')
  async listDeals(
    @AuthUser('organizationId') organizationId: string,
    @Query('stageId') stageId?: string,
    @Query('assignedTo') assignedTo?: string,
  ) {
    await this.assertParcelsEnabled(organizationId);
    const deals = await this.deals.list({
      organizationId,
      stageId,
      assignedToUserId: assignedTo,
    });
    return { deals };
  }

  // Bulk path. Must come BEFORE deals/:bbl/* so 'bulk-assign' isn't matched as :bbl.
  @Post('deals/bulk-assign')
  async bulkAssign(
    @AuthUser('organizationId') organizationId: string,
    @AuthUser('userId') userId: string | null,
    @Body() body: { bbls: string[]; assignedToUserId: string | null },
  ) {
    await this.assertParcelsEnabled(organizationId);
    if (!Array.isArray(body.bbls)) {
      throw new HttpException('bbls is required', HttpStatus.BAD_REQUEST);
    }
    return this.deals.bulkAssign({
      bbls: body.bbls,
      organizationId,
      actingUserId: userId!,
      assignedToUserId: body.assignedToUserId ?? null,
    });
  }

  @Get('deals/:bbl')
  async getDeal(
    @AuthUser('organizationId') organizationId: string,
    @Param('bbl') bbl: string,
  ) {
    await this.assertParcelsEnabled(organizationId);
    const deal = await this.deals.getByBbl(bbl, organizationId);
    return { deal };
  }

  @Post('deals/:bbl/stage')
  async moveStage(
    @AuthUser('organizationId') organizationId: string,
    @AuthUser('userId') userId: string | null,
    @Param('bbl') bbl: string,
    @Body() body: { stageId: string },
  ) {
    await this.assertParcelsEnabled(organizationId);
    if (!body.stageId) {
      throw new HttpException('stageId is required', HttpStatus.BAD_REQUEST);
    }
    const deal = await this.deals.moveStage({
      bbl,
      organizationId,
      actingUserId: userId!,
      toStageId: body.stageId,
    });
    return { deal };
  }

  @Post('deals/:bbl/assign')
  async assignDeal(
    @AuthUser('organizationId') organizationId: string,
    @AuthUser('userId') userId: string | null,
    @Param('bbl') bbl: string,
    @Body() body: { assignedToUserId: string | null },
  ) {
    await this.assertParcelsEnabled(organizationId);
    const deal = await this.deals.assign({
      bbl,
      organizationId,
      actingUserId: userId!,
      assignedToUserId: body.assignedToUserId ?? null,
    });
    return { deal };
  }

  @Post('deals/:bbl/follow-up')
  async setFollowUp(
    @AuthUser('organizationId') organizationId: string,
    @AuthUser('userId') userId: string | null,
    @Param('bbl') bbl: string,
    @Body() body: { followUpAt: string | null },
  ) {
    await this.assertParcelsEnabled(organizationId);
    const followUpAt = body.followUpAt ? new Date(body.followUpAt) : null;
    if (followUpAt && isNaN(followUpAt.getTime())) {
      throw new HttpException(
        'followUpAt must be an ISO date string or null',
        HttpStatus.BAD_REQUEST,
      );
    }
    const deal = await this.deals.setFollowUp({
      bbl,
      organizationId,
      actingUserId: userId!,
      followUpAt,
    });
    return { deal };
  }

  // ----- Activities -----

  @Get('activities/:bbl')
  async listActivities(
    @AuthUser('organizationId') organizationId: string,
    @Param('bbl') bbl: string,
    @Query('limit') limit?: string,
  ) {
    await this.assertParcelsEnabled(organizationId);
    const parsed = limit
      ? Math.min(Math.max(parseInt(limit, 10), 1), 500)
      : undefined;
    const activities = await this.activities.listForParcel({
      bbl,
      organizationId,
      limit: parsed,
    });
    return { activities };
  }

  @Post('activities/:bbl')
  async createActivity(
    @AuthUser('organizationId') organizationId: string,
    @AuthUser('userId') userId: string | null,
    @Param('bbl') bbl: string,
    @Body()
    body: {
      type: 'CALL' | 'NOTE' | 'PHONE_STATUS_CHANGED';
      body?: string | null;
      phoneNumber?: string | null;
      phoneStatus?: 'GOOD' | 'BAD' | 'UNKNOWN' | null;
    },
  ) {
    await this.assertParcelsEnabled(organizationId);
    const type =
      ParcelActivityType[body.type as keyof typeof ParcelActivityType];
    if (!type) {
      throw new HttpException(
        `Invalid type: ${body.type}. Valid: CALL, NOTE, PHONE_STATUS_CHANGED`,
        HttpStatus.BAD_REQUEST,
      );
    }
    const activity = await this.activities.create({
      bbl,
      organizationId,
      userId: userId!,
      type,
      body: body.body ?? null,
      phoneNumber: body.phoneNumber ?? null,
      phoneStatus: body.phoneStatus
        ? PhoneStatus[body.phoneStatus as keyof typeof PhoneStatus]
        : null,
    });
    return { activity };
  }
}
