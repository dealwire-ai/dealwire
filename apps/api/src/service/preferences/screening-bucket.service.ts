import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { BucketAction, ScreeningBucket } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ScreeningBucketService {
  private readonly logger = new Logger(ScreeningBucketService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string): Promise<ScreeningBucket[]> {
    return this.prisma.screeningBucket.findMany({
      where: { organizationId },
      orderBy: { rank: 'asc' },
    });
  }

  async create(
    organizationId: string,
    data: {
      name: string;
      description: string;
      isPass: boolean;
      action?: BucketAction;
      folderName?: string;
      generateSummary?: boolean;
      color?: string;
    },
  ): Promise<ScreeningBucket> {
    if (data.action === BucketAction.MOVE_TO_FOLDER && !data.folderName) {
      throw new HttpException(
        'folderName is required when action is MOVE_TO_FOLDER',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Auto-assign rank as max+1
    const maxRank = await this.prisma.screeningBucket.aggregate({
      where: { organizationId },
      _max: { rank: true },
    });
    const rank = (maxRank._max.rank ?? 0) + 1;

    return this.prisma.screeningBucket.create({
      data: {
        organizationId,
        name: data.name,
        description: data.description,
        rank,
        isPass: data.isPass,
        action: data.action ?? BucketAction.NONE,
        folderName: data.folderName,
        generateSummary: data.generateSummary ?? false,
        color: data.color,
      },
    });
  }

  async update(
    organizationId: string,
    bucketId: string,
    data: {
      name?: string;
      description?: string;
      isPass?: boolean;
      action?: BucketAction;
      folderName?: string;
      generateSummary?: boolean;
      color?: string;
    },
  ): Promise<ScreeningBucket> {
    const bucket = await this.prisma.screeningBucket.findFirst({
      where: { id: bucketId, organizationId },
    });

    if (!bucket) {
      throw new HttpException('Bucket not found', HttpStatus.NOT_FOUND);
    }

    const newAction = data.action ?? bucket.action;
    if (newAction === BucketAction.MOVE_TO_FOLDER) {
      const newFolderName = data.folderName ?? bucket.folderName;
      if (!newFolderName) {
        throw new HttpException(
          'folderName is required when action is MOVE_TO_FOLDER',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    return this.prisma.screeningBucket.update({
      where: { id: bucketId },
      data,
    });
  }

  async delete(organizationId: string, bucketId: string): Promise<void> {
    const count = await this.prisma.screeningBucket.count({
      where: { organizationId },
    });

    if (count <= 1) {
      throw new HttpException(
        'Cannot delete the last bucket',
        HttpStatus.BAD_REQUEST,
      );
    }

    const bucket = await this.prisma.screeningBucket.findFirst({
      where: { id: bucketId, organizationId },
    });

    if (!bucket) {
      throw new HttpException('Bucket not found', HttpStatus.NOT_FOUND);
    }

    await this.prisma.screeningBucket.delete({ where: { id: bucketId } });
  }

  async reorder(organizationId: string, bucketIds: string[]): Promise<ScreeningBucket[]> {
    await this.prisma.$transaction(
      bucketIds.map((id, index) =>
        this.prisma.screeningBucket.updateMany({
          where: { id, organizationId },
          data: { rank: index + 1 },
        }),
      ),
    );

    return this.findAll(organizationId);
  }

  async ensureDefaultBuckets(organizationId: string): Promise<void> {
    const count = await this.prisma.screeningBucket.count({
      where: { organizationId },
    });

    if (count > 0) return;

    this.logger.log(`Creating default buckets for organization ${organizationId}`);

    await this.prisma.screeningBucket.createMany({
      data: [
        {
          organizationId,
          name: 'Yes',
          description: 'Meets investment criteria',
          rank: 1,
          isPass: true,
          action: BucketAction.REPLY_TO_SELF,
          generateSummary: true,
        },
        {
          organizationId,
          name: 'No',
          description: 'Does not meet investment criteria',
          rank: 2,
          isPass: false,
          action: BucketAction.MOVE_TO_FOLDER,
          folderName: 'Passed Deals',
          generateSummary: false,
        },
      ],
    });
  }
}
