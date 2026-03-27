import {
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
import { UnderwritingOrchestratorService } from '../../service/underwriting/underwriting-orchestrator.service';

/**
 * Endpoint for testing the underwriting pipeline.
 * Bypasses email → SQS intake — upload files directly and run the pipeline.
 *
 * Protected by Clerk auth in all environments.
 *
 * Usage:
 *   curl -X POST https://api.dealwire.ai/underwriting/dev/run \
 *     -H "Authorization: Bearer <clerk-token>" \
 *     -F "files=@rent_roll.xlsx" \
 *     -F "files=@t12.pdf" \
 *     -F "files=@om.pdf"
 *
 * Optional query params:
 *   ?deliver=you@example.com  — also send the delivery email
 */
@Controller('underwriting/dev')
@UseGuards(ClerkAuthGuard)
export class UnderwritingDevController {
  private readonly logger = new Logger(UnderwritingDevController.name);

  constructor(
    private readonly s3: S3Service,
    private readonly orchestrator: UnderwritingOrchestratorService,
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
  ) {
    if (!files?.length) {
      throw new HttpException(
        'Upload at least one file (rent roll, T-12, or OM)',
        HttpStatus.BAD_REQUEST,
      );
    }

    const dealId = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const effectiveOrgId = orgId ?? 'dev-org';

    this.logger.log(
      `Dev run: dealId=${dealId} orgId=${effectiveOrgId} files=${files.map((f) => f.originalname).join(', ')}`,
    );

    // Upload files to S3 (same path as real pipeline — extractors pull from S3)
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

    const result = await this.orchestrator.run({
      dealId,
      orgId: effectiveOrgId,
      senderEmail: deliverTo ?? '',
      documents,
    });

    // Generate a presigned download URL for the filled pro forma if produced
    let proformaDownloadUrl: string | null = null;
    if (result.proformaS3Key) {
      proformaDownloadUrl = await this.s3.getPresignedUrl(
        result.proformaS3Key,
        3600,
      );
    }

    return {
      ...result,
      proformaDownloadUrl,
      uploadedDocuments: documents.map((d) => ({
        filename: d.filename,
        s3Key: d.s3Key,
      })),
    };
  }
}
