import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { BucketAction } from '@prisma/client';
import { ScreeningBucketService } from '../service/preferences/screening-bucket.service';
import { ClerkAuthGuard } from '../guard/clerk-auth.guard';
import { AuthUser } from '../decorator/auth-user.decorator';

@Controller('screening-buckets')
@UseGuards(ClerkAuthGuard)
export class ScreeningBucketController {
  constructor(
    private readonly screeningBucketService: ScreeningBucketService,
  ) {}

  @Get()
  async list(@AuthUser('organizationId') organizationId: string | null) {
    if (!organizationId) {
      throw new HttpException('User not in organization', HttpStatus.FORBIDDEN);
    }
    return this.screeningBucketService.findAll(organizationId);
  }

  @Post()
  async create(
    @AuthUser('organizationId') organizationId: string | null,
    @Body()
    body: {
      name: string;
      description: string;
      isPass: boolean;
      action?: BucketAction;
      folderName?: string;
      generateSummary?: boolean;
      color?: string;
    },
  ) {
    if (!organizationId) {
      throw new HttpException('User not in organization', HttpStatus.FORBIDDEN);
    }

    if (!body.name || !body.description) {
      throw new HttpException(
        'name and description are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.screeningBucketService.create(organizationId, body);
  }

  @Patch(':id')
  async update(
    @AuthUser('organizationId') organizationId: string | null,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      isPass?: boolean;
      action?: BucketAction;
      folderName?: string;
      generateSummary?: boolean;
      color?: string;
    },
  ) {
    if (!organizationId) {
      throw new HttpException('User not in organization', HttpStatus.FORBIDDEN);
    }
    return this.screeningBucketService.update(organizationId, id, body);
  }

  @Delete(':id')
  async delete(
    @AuthUser('organizationId') organizationId: string | null,
    @Param('id') id: string,
  ) {
    if (!organizationId) {
      throw new HttpException('User not in organization', HttpStatus.FORBIDDEN);
    }
    await this.screeningBucketService.delete(organizationId, id);
    return { deleted: true };
  }

  @Put('reorder')
  async reorder(
    @AuthUser('organizationId') organizationId: string | null,
    @Body() body: { bucketIds: string[] },
  ) {
    if (!organizationId) {
      throw new HttpException('User not in organization', HttpStatus.FORBIDDEN);
    }

    if (!body.bucketIds || !Array.isArray(body.bucketIds)) {
      throw new HttpException(
        'bucketIds array is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.screeningBucketService.reorder(organizationId, body.bucketIds);
  }
}
