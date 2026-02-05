import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ScreeningPreferencesService } from '../service/preferences/screening-preferences.service';
import { ClerkAuthGuard } from '../guard/clerk-auth.guard';
import { AuthUser } from '../decorator/auth-user.decorator';

@Controller('screening-preferences')
@UseGuards(ClerkAuthGuard)
export class ScreeningPreferencesController {
  constructor(
    private readonly screeningPreferencesService: ScreeningPreferencesService,
  ) {}

  @Get()
  async getScreeningPreferences(
    @AuthUser('organizationId') organizationId: string | null,
  ) {
    if (!organizationId) {
      throw new HttpException(
        'User not in organization',
        HttpStatus.FORBIDDEN,
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
