import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../service/prisma/prisma.service';
import { S3Service } from '../../service/s3/s3.service';
import { ClerkAuthGuard } from '../../guard/clerk-auth.guard';
import { RequireOrgGuard } from '../../guard/require-org.guard';
import { AuthUser } from '../../decorator/auth-user.decorator';

const VALID_STATUSES = ['RUNNING', 'COMPLETED', 'FAILED'] as const;

@Controller('underwriting/runs')
@UseGuards(ClerkAuthGuard, RequireOrgGuard)
export class UnderwritingRunsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  @Get()
  async list(
    @AuthUser('organizationId') orgId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const cappedLimit = Math.min(Math.max(limit, 1), 100);
    const skip = (page - 1) * cappedLimit;
    const where: Prisma.UnderwritingRunWhereInput = { organizationId: orgId };

    if (status) {
      if (!VALID_STATUSES.includes(status as any)) {
        throw new HttpException(
          'Invalid status filter',
          HttpStatus.BAD_REQUEST,
        );
      }
      where.status = status as Prisma.EnumUnderwritingStatusFilter['equals'];
    }
    if (search) {
      where.OR = [
        { emailSubject: { contains: search, mode: 'insensitive' } },
        { senderEmail: { contains: search, mode: 'insensitive' } },
        { jobId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [runs, total] = await Promise.all([
      this.prisma.underwritingRun.findMany({
        where,
        skip,
        take: cappedLimit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          organizationId: true,
          dealId: true,
          proformaId: true,
          jobId: true,
          senderEmail: true,
          emailSubject: true,
          status: true,
          filledProformaModelS3Key: true,
          humanReviewFlags: true,
          confidence: true,
          durationMs: true,
          error: true,
          startedAt: true,
          completedAt: true,
          createdAt: true,
          updatedAt: true,
          // analysisData intentionally excluded — can be 50-200KB per row.
          // Fetch via GET /underwriting/runs/:id for full detail.
        },
      }),
      this.prisma.underwritingRun.count({ where }),
    ]);

    return {
      data: runs,
      pagination: {
        page,
        limit: cappedLimit,
        total,
        totalPages: Math.ceil(total / cappedLimit),
      },
    };
  }

  @Get(':id')
  async get(
    @AuthUser('organizationId') orgId: string,
    @Param('id') id: string,
  ) {
    const run = await this.prisma.underwritingRun.findUnique({ where: { id } });
    if (!run || run.organizationId !== orgId) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }

    return run;
  }

  @Get(':id/proforma-url')
  async getProformaUrl(
    @AuthUser('organizationId') orgId: string,
    @Param('id') id: string,
  ) {
    const run = await this.prisma.underwritingRun.findUnique({
      where: { id },
      select: { organizationId: true, filledProformaModelS3Key: true },
    });

    if (!run || run.organizationId !== orgId) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }
    if (!run.filledProformaModelS3Key) {
      throw new HttpException('No proforma available', HttpStatus.NOT_FOUND);
    }

    const url = await this.s3.getPresignedUrl(
      run.filledProformaModelS3Key,
      3600,
    );
    return { url };
  }

  /**
   * Delete an underwriting run and its full re-run thread (children cascade
   * via the parentRunId FK). UnderwritingRunMessage rows cascade via their
   * own onDelete: Cascade. The S3 objects are intentionally not deleted —
   * cleanup of orphaned proforma/document blobs is a separate concern.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @AuthUser('organizationId') orgId: string,
    @Param('id') id: string,
  ): Promise<void> {
    const run = await this.prisma.underwritingRun.findUnique({
      where: { id },
      select: { organizationId: true },
    });
    if (!run || run.organizationId !== orgId) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }

    await this.prisma.underwritingRun.delete({ where: { id } });
  }
}
