import {
  Body,
  Controller,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ClerkAuthGuard } from '../../guard/clerk-auth.guard';
import { AuthUser } from '../../decorator/auth-user.decorator';
import { S3Service } from '../../service/s3/s3.service';
import { PrismaService } from '../../service/prisma/prisma.service';
import { AgenticUnderwritingService } from '../../service/underwriting/agentic/agentic-underwriting.service';
import {
  UserAssumptions,
  UserAssumptionsSchema,
} from '../../service/underwriting/agentic/assumption-types';

/**
 * Dev endpoint for testing the interactive underwriting pipeline.
 * Bypasses email intake — upload docs and (optionally) post assumptions.
 *
 * Without assumptions: runs analysis phase only → emails the investor with
 * the assumption question list and returns `{ runId, status: 'waiting_for_assumptions' }`.
 *
 * With assumptions: runs analysis then fill, returns the filled run.
 *
 * Protected by Clerk auth.
 */
@Controller('underwriting/dev')
@UseGuards(ClerkAuthGuard)
export class UnderwritingDevController {
  private readonly logger = new Logger(UnderwritingDevController.name);

  constructor(
    private readonly s3: S3Service,
    private readonly prisma: PrismaService,
    private readonly agenticOrchestrator: AgenticUnderwritingService,
  ) {}

  onModuleInit() {
    this.logger.log(
      'UnderwritingDevController active — POST /underwriting/dev/run',
    );
  }

  @Post('run')
  @UseInterceptors(FilesInterceptor('files', 10))
  async run(
    @AuthUser('organizationId') orgId: string | null,
    @UploadedFiles() files: Express.Multer.File[],
    @Query('deliver') deliverTo?: string,
    @Body('assumptions') assumptionsJson?: string,
  ) {
    if (!files?.length) {
      throw new HttpException(
        'Upload at least one file (rent roll, T-12, or OM)',
        HttpStatus.BAD_REQUEST,
      );
    }

    const dealId = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const effectiveOrgId = orgId ?? 'dev-org';
    const senderEmail = deliverTo ?? '';

    this.logger.log(
      `Dev run: dealId=${dealId} orgId=${effectiveOrgId} files=${files.map((f) => f.originalname).join(', ')}`,
    );

    const documents: Array<{
      s3Key: string;
      filename: string;
      contentType: string;
    }> = [];
    for (const file of files) {
      const s3Key = await this.s3.uploadDealAttachment(
        file.buffer,
        file.originalname,
        dealId,
      );
      documents.push({
        s3Key,
        filename: file.originalname,
        contentType: file.mimetype,
      });
    }

    // Parse optional inline assumptions (so a dev run can go end-to-end)
    let assumptions: UserAssumptions | null = null;
    if (assumptionsJson) {
      try {
        const parsed = JSON.parse(assumptionsJson);
        assumptions = UserAssumptionsSchema.parse(parsed);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new HttpException(
          `Invalid assumptions JSON: ${msg}`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const run = await this.prisma.underwritingRun.create({
      data: {
        jobId: dealId,
        organizationId: effectiveOrgId,
        senderEmail,
        status: 'RUNNING',
      },
    });

    await this.agenticOrchestrator.runAnalysisPhase({
      dealId,
      orgId: effectiveOrgId,
      senderEmail,
      documents,
    });

    if (!assumptions) {
      return {
        runId: run.id,
        status: 'waiting_for_assumptions',
        uploadedDocuments: documents.map((d) => ({
          filename: d.filename,
          s3Key: d.s3Key,
        })),
      };
    }

    const fillResult = await this.agenticOrchestrator.runFillPhase(
      run.id,
      assumptions,
      { senderEmail },
    );

    let proformaDownloadUrl: string | null = null;
    if (fillResult.filledProformaModelS3Key) {
      proformaDownloadUrl = await this.s3.getPresignedUrl(
        fillResult.filledProformaModelS3Key,
        3600,
      );
    }

    return {
      ...fillResult,
      runId: run.id,
      proformaDownloadUrl,
      uploadedDocuments: documents.map((d) => ({
        filename: d.filename,
        s3Key: d.s3Key,
      })),
    };
  }
}
