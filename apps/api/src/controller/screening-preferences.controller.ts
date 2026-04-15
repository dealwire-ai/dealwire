import {
  Controller,
  Get,
  Patch,
  Body,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ScreeningPreferencesService } from '../service/preferences/screening-preferences.service';
import { ClerkAuthGuard } from '../guard/clerk-auth.guard';
import { RequireOrgGuard } from '../guard/require-org.guard';
import { AuthUser } from '../decorator/auth-user.decorator';

@Controller('screening-preferences')
@UseGuards(ClerkAuthGuard, RequireOrgGuard)
export class ScreeningPreferencesController {
  constructor(
    private readonly screeningPreferencesService: ScreeningPreferencesService,
  ) {}

  @Get()
  async getScreeningPreferences(
    @AuthUser('organizationId') organizationId: string,
  ) {
    const prefs =
      await this.screeningPreferencesService.getPreferences(organizationId);

    if (Object.keys(prefs).length === 0) {
      throw new HttpException(
        'Screening preferences not found for this organization',
        HttpStatus.NOT_FOUND,
      );
    }

    return prefs;
  }

  @Patch()
  async patchScreeningPreferences(
    @AuthUser('organizationId') organizationId: string,
    @Body()
    body: {
      dealCriteria?: string;
      skipCriteria?: string;
      knownProperties?: string;
      passedFolderName?: string;
      digestSchedule?: string;
      digestTimeZone?: string;
      companyName?: string;
      brandColor?: string;
      designatedMonitoringInboxEmails?: string[];
    },
  ) {
    return this.screeningPreferencesService.updatePreferences(
      organizationId,
      body,
    );
  }
}
