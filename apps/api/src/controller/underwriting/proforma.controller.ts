import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  HttpException,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ClerkAuthGuard } from '../../guard/clerk-auth.guard';
import { AuthUser } from '../../decorator/auth-user.decorator';
import { ProformaService, ProformaPatch } from '../../service/underwriting/proforma.service';

@Controller('underwriting/proforma')
@UseGuards(ClerkAuthGuard)
export class ProformaController {
  constructor(private readonly proformaService: ProformaService) {}

  @Get()
  list(@AuthUser('organizationId') orgId: string | null) {
    if (!orgId) throw new HttpException('User not in organization', HttpStatus.FORBIDDEN);
    return this.proformaService.list(orgId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @AuthUser('organizationId') orgId: string | null,
    @Body('name') name: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!orgId) throw new HttpException('User not in organization', HttpStatus.FORBIDDEN);
    if (!file) throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    if (!name) throw new HttpException('name is required', HttpStatus.BAD_REQUEST);
    return this.proformaService.create(orgId, name, file.buffer, file.originalname);
  }

  @Patch(':id')
  update(
    @AuthUser('organizationId') orgId: string | null,
    @Param('id') id: string,
    @Body() patch: ProformaPatch,
  ) {
    if (!orgId) throw new HttpException('User not in organization', HttpStatus.FORBIDDEN);
    return this.proformaService.update(orgId, id, patch);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @AuthUser('organizationId') orgId: string | null,
    @Param('id') id: string,
  ) {
    if (!orgId) throw new HttpException('User not in organization', HttpStatus.FORBIDDEN);
    return this.proformaService.remove(orgId, id);
  }
}
