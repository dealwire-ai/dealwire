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
import { RequireOrgGuard } from '../../guard/require-org.guard';
import { AuthUser } from '../../decorator/auth-user.decorator';
import {
  ProformaService,
  ProformaPatch,
} from '../../service/underwriting/proforma.service';

@Controller('underwriting/proforma')
@UseGuards(ClerkAuthGuard, RequireOrgGuard)
export class ProformaController {
  constructor(private readonly proformaService: ProformaService) {}

  @Get()
  list(@AuthUser('organizationId') orgId: string) {
    return this.proformaService.list(orgId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @AuthUser('organizationId') orgId: string,
    @Body('name') name: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file)
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    if (!name)
      throw new HttpException('name is required', HttpStatus.BAD_REQUEST);
    return this.proformaService.create(
      orgId,
      name,
      file.buffer,
      file.originalname,
    );
  }

  @Patch(':id')
  update(
    @AuthUser('organizationId') orgId: string,
    @Param('id') id: string,
    @Body() patch: ProformaPatch,
  ) {
    return this.proformaService.update(orgId, id, patch);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@AuthUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.proformaService.remove(orgId, id);
  }
}
