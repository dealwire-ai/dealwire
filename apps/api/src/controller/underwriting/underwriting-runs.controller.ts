import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  HttpException,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../service/prisma/prisma.service';
import { S3Service } from '../../service/s3/s3.service';
import { ClerkAuthGuard } from '../../guard/clerk-auth.guard';
import { AuthUser } from '../../decorator/auth-user.decorator';

@Controller('underwriting/runs')
@UseGuards(ClerkAuthGuard)
export class UnderwritingRunsController {
  private readonly logger = new Logger(UnderwritingRunsController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  @Get()
  async list(
    @AuthUser('organizationId') orgId: string | null,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    if (!orgId) {
      throw new HttpException('User not in organization', HttpStatus.FORBIDDEN);
    }

    const skip = (page - 1) * limit;
    const where: any = { organizationId: orgId };

    if (status) {
      where.status = status;
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
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          jobId: true,
          senderEmail: true,
          emailSubject: true,
          status: true,
          pipelineType: true,
          proformaS3Key: true,
          humanReviewFlags: true,
          confidence: true,
          durationMs: true,
          error: true,
          startedAt: true,
          completedAt: true,
          createdAt: true,
        },
      }),
      this.prisma.underwritingRun.count({ where }),
    ]);

    return {
      data: runs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  @Get(':id')
  async get(
    @AuthUser('organizationId') orgId: string | null,
    @Param('id') id: string,
  ) {
    if (!orgId) {
      throw new HttpException('User not in organization', HttpStatus.FORBIDDEN);
    }

    const run = await this.prisma.underwritingRun.findUnique({ where: { id } });
    if (!run || run.organizationId !== orgId) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }

    return run;
  }

  @Get(':id/proforma-url')
  async getProformaUrl(
    @AuthUser('organizationId') orgId: string | null,
    @Param('id') id: string,
  ) {
    if (!orgId) {
      throw new HttpException('User not in organization', HttpStatus.FORBIDDEN);
    }

    const run = await this.prisma.underwritingRun.findUnique({
      where: { id },
      select: { organizationId: true, proformaS3Key: true },
    });

    if (!run || run.organizationId !== orgId) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }
    if (!run.proformaS3Key) {
      throw new HttpException('No proforma available', HttpStatus.NOT_FOUND);
    }

    const url = await this.s3.getPresignedUrl(run.proformaS3Key, 3600);
    return { url };
  }
}
