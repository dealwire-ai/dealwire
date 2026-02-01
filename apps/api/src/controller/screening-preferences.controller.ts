import {
  Controller,
  Get,
  Query,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ScreeningPreferencesService } from '../service/preferences/screening-preferences.service';
import { ClerkAuthGuard } from '../guard/clerk-auth.guard';

@Controller('screening-preferences')
@UseGuards(ClerkAuthGuard)
export class ScreeningPreferencesController {
  constructor(
    private readonly screeningPreferencesService: ScreeningPreferencesService,
  ) {}

  @Get()
  async getScreeningPreferences(@Query('organizationId') organizationId?: string) {
    if (!organizationId) {
      throw new HttpException(
        'organizationId query parameter is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const prefs = await this.screeningPreferencesService.getPreferences(
      organizationId,
    );

    if (Object.keys(prefs).length === 0) {
      throw new HttpException(
        'Screening preferences not found for this organization',
        HttpStatus.NOT_FOUND,
      );
    }

    return prefs;
  }
}
