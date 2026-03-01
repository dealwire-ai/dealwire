import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Config } from '../../config/s3.config';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly config = s3Config();
  private readonly s3Client: S3Client;

  constructor(private readonly metricsService: MetricsService) {
    if (!this.config.accessKeyId || !this.config.secretAccessKey) {
      this.logger.warn('AWS credentials not configured - S3 uploads will fail');
    }

    this.s3Client = new S3Client({
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
    });
  }

  /**
   * Upload a file to S3 and return the S3 key
   * @param buffer File content
   * @param filename Original filename
   * @param dealId Deal ID for organizing files
   * @returns S3 key (path) where file was stored
   */
  async uploadDealAttachment(
    buffer: Buffer,
    filename: string,
    dealId: string,
  ): Promise<string> {
    if (!this.config.dealAttachmentsBucket) {
      throw new Error('AWS_DEAL_ATTACHMENTS_S3_BUCKET_NAME not configured');
    }

    // Generate S3 key: deals/{dealId}/{timestamp}-{filename}
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const s3Key = `deals/${dealId}/${timestamp}-${sanitizedFilename}`;

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.config.dealAttachmentsBucket,
          Key: s3Key,
          Body: buffer,
          ContentType: this.getContentType(filename),
        }),
      );

      this.metricsService.recordS3Upload('success', buffer.length);
      this.logger.log(`Uploaded ${filename} to S3: ${s3Key}`);
      return s3Key;
    } catch (error) {
      this.metricsService.recordS3Upload('error');
      this.metricsService.recordS3Error('upload');
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to upload ${filename} to S3: ${msg}`);
      throw new Error(`S3 upload failed: ${msg}`);
    }
  }

  /**
   * Download a file from S3 by its key
   * @param s3Key S3 key (path) of the file
   * @returns File content as Buffer
   */
  async downloadDealAttachment(s3Key: string): Promise<Buffer> {
    if (!this.config.dealAttachmentsBucket) {
      throw new Error('AWS_DEAL_ATTACHMENTS_S3_BUCKET_NAME not configured');
    }

    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.config.dealAttachmentsBucket,
          Key: s3Key,
        }),
      );

      if (!response.Body) {
        throw new Error(`No content found for S3 key: ${s3Key}`);
      }

      // Convert stream to Buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      this.metricsService.recordS3Download('success');
      this.logger.debug(`Downloaded ${s3Key} from S3 (${buffer.length} bytes)`);
      return buffer;
    } catch (error) {
      this.metricsService.recordS3Download('error');
      this.metricsService.recordS3Error('download');
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to download ${s3Key} from S3: ${msg}`);
      throw new Error(`S3 download failed: ${msg}`);
    }
  }

  /**
   * Generate a pre-signed URL for downloading a file from S3
   * @param s3Key S3 key (path) of the file
   * @param expiresInSeconds URL expiry time in seconds (default: 7 days)
   * @returns Pre-signed URL for downloading the file
   */
  async getPresignedUrl(s3Key: string, expiresInSeconds: number = 604800): Promise<string> {
    if (!this.config.dealAttachmentsBucket) {
      throw new Error('AWS_DEAL_ATTACHMENTS_S3_BUCKET_NAME not configured');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.config.dealAttachmentsBucket,
        Key: s3Key,
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
      this.logger.debug(`Generated pre-signed URL for ${s3Key} (expires in ${expiresInSeconds}s)`);
      return url;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to generate pre-signed URL for ${s3Key}: ${msg}`);
      throw new Error(`S3 pre-signed URL generation failed: ${msg}`);
    }
  }

  /**
   * Upload a proforma template (.xlsx) to S3 and return the S3 key
   * @param buffer File content
   * @param filename Original filename
   * @param orgId Organization ID for organizing files
   * @returns S3 key (path) where file was stored
   */
  async uploadProformaTemplate(
    buffer: Buffer,
    filename: string,
    orgId: string,
  ): Promise<string> {
    if (!this.config.dealAttachmentsBucket) {
      throw new Error('AWS_DEAL_ATTACHMENTS_S3_BUCKET_NAME not configured');
    }

    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const s3Key = `proformas/${orgId}/${timestamp}-${sanitizedFilename}`;

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.config.dealAttachmentsBucket,
          Key: s3Key,
          Body: buffer,
          ContentType: this.getContentType(filename),
        }),
      );

      this.metricsService.recordS3Upload('success', buffer.length);
      this.logger.log(`Uploaded proforma template ${filename} to S3: ${s3Key}`);
      return s3Key;
    } catch (error) {
      this.metricsService.recordS3Upload('error');
      this.metricsService.recordS3Error('upload');
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to upload proforma template ${filename} to S3: ${msg}`);
      throw new Error(`S3 upload failed: ${msg}`);
    }
  }

  /**
   * Upload a filled proforma (.xlsx) to S3 and return the S3 key.
   * Key: deals/{dealId}/proforma_filled.xlsx
   */
  async uploadFilledProforma(buffer: Buffer, dealId: string): Promise<string> {
    if (!this.config.dealAttachmentsBucket) {
      throw new Error('AWS_DEAL_ATTACHMENTS_S3_BUCKET_NAME not configured');
    }

    const s3Key = `deals/${dealId}/proforma_filled.xlsx`;

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.config.dealAttachmentsBucket,
          Key: s3Key,
          Body: buffer,
          ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
      );

      this.metricsService.recordS3Upload('success', buffer.length);
      this.logger.log(`Uploaded filled proforma to S3: ${s3Key}`);
      return s3Key;
    } catch (error) {
      this.metricsService.recordS3Upload('error');
      this.metricsService.recordS3Error('upload');
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to upload filled proforma to S3: ${msg}`);
      throw new Error(`S3 upload failed: ${msg}`);
    }
  }

  /**
   * Get content type from filename extension
   */
  private getContentType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    const contentTypes: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      txt: 'text/plain',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    return contentTypes[ext || ''] || 'application/octet-stream';
  }
}
