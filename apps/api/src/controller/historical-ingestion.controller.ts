import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../guard/clerk-auth.guard';
import { AuthUser } from '../decorator/auth-user.decorator';
import { HistoricalIngestionService } from '../service/ingestion/historical-ingestion.service';
import { PrismaService } from '../service/prisma/prisma.service';
import { StartIngestionDto } from '../dto/start-ingestion.dto';

@Controller('historical-ingestion')
@UseGuards(ClerkAuthGuard)
export class HistoricalIngestionController {
  constructor(
    private readonly ingestionService: HistoricalIngestionService,
    private readonly prisma: PrismaService,
  ) {}

  /** Start a new historical ingestion job */
  @Post()
  async start(
    @AuthUser('organizationId') organizationId: string | null,
    @AuthUser('userId') userId: string | null,
    @Body() body: StartIngestionDto,
  ) {
    if (!organizationId || !userId) {
      throw new HttpException('User not in organization', HttpStatus.FORBIDDEN);
    }

    try {
      const result = await this.ingestionService.startIngestion({
        organizationId,
        triggeredByUserId: userId,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        folderName: body.folderName,
      });

      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('already')) {
        throw new HttpException(msg, HttpStatus.CONFLICT);
      }
      throw new HttpException(msg, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /** List all ingestion jobs for this organization */
  @Get()
  async list(@AuthUser('organizationId') organizationId: string | null) {
    if (!organizationId) {
      throw new HttpException('User not in organization', HttpStatus.FORBIDDEN);
    }

    return this.prisma.historicalIngestion.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        folderName: true,
        startDate: true,
        endDate: true,
        totalMessages: true,
        scannedCount: true,
        detectedCount: true,
        processedCount: true,
        skippedCount: true,
        errorCount: true,
        lastError: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
      },
    });
  }

  /** Get status/progress for a specific ingestion job */
  @Get(':id')
  async getStatus(
    @AuthUser('organizationId') organizationId: string | null,
    @Param('id') id: string,
  ) {
    if (!organizationId) {
      throw new HttpException('User not in organization', HttpStatus.FORBIDDEN);
    }

    const job = await this.prisma.historicalIngestion.findUnique({
      where: { id },
    });

    if (!job || job.organizationId !== organizationId) {
      throw new HttpException('Ingestion job not found', HttpStatus.NOT_FOUND);
    }

    return job;
  }

  /** Pause a running ingestion job */
  @Post(':id/pause')
  async pause(
    @AuthUser('organizationId') organizationId: string | null,
    @Param('id') id: string,
  ) {
    if (!organizationId) {
      throw new HttpException('User not in organization', HttpStatus.FORBIDDEN);
    }

    const job = await this.prisma.historicalIngestion.findUnique({
      where: { id },
      select: { organizationId: true },
    });

    if (!job || job.organizationId !== organizationId) {
      throw new HttpException('Ingestion job not found', HttpStatus.NOT_FOUND);
    }

    try {
      await this.ingestionService.pauseIngestion(id);
      return { id, status: 'PAUSED' };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new HttpException(msg, HttpStatus.BAD_REQUEST);
    }
  }

  /** Resume a paused or failed ingestion job */
  @Post(':id/resume')
  async resume(
    @AuthUser('organizationId') organizationId: string | null,
    @Param('id') id: string,
  ) {
    if (!organizationId) {
      throw new HttpException('User not in organization', HttpStatus.FORBIDDEN);
    }

    const job = await this.prisma.historicalIngestion.findUnique({
      where: { id },
      select: { organizationId: true },
    });

    if (!job || job.organizationId !== organizationId) {
      throw new HttpException('Ingestion job not found', HttpStatus.NOT_FOUND);
    }

    try {
      const result = await this.ingestionService.resumeIngestion(id);
      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new HttpException(msg, HttpStatus.BAD_REQUEST);
    }
  }
}
