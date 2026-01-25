import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ScreeningPreferences {
  dealCriteria?: string;
  logoUrl?: string;
  companyName?: string;
  brandColor?: string;
  /** Folder name for passed/rejected deals (default: "Passed Deals") */
  passedFolderName?: string;
  /** Criteria for deals to always skip */
  alwaysSkip?: string;
  /** CRON expression for digest schedule (e.g., "0 12 * * *" for daily at noon) */
  digestSchedule?: string;
  /** Timezone for digest schedule (default: "America/New_York") */
  digestTimeZone?: string;
}

export const DEFAULT_PASSED_FOLDER = 'Passed Deals';

@Injectable()
export class ScreeningPreferencesService {
  private readonly logger = new Logger(ScreeningPreferencesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get preferences for an organization
   * @param organizationId - The organization ID
   * @returns ScreeningPreferences or empty object if not found
   */
  async getPreferences(organizationId: string | null | undefined): Promise<ScreeningPreferences> {
    if (!organizationId) {
      this.logger.debug('No organizationId provided, returning empty preferences');
      return {};
    }

    try {
      const prefs = await this.prisma.screeningPreferences.findUnique({
        where: { organizationId },
      });

      if (!prefs) {
        this.logger.warn(`No preferences found for organization ${organizationId}`);
        return {};
      }

      return {
        dealCriteria: prefs.dealCriteria || undefined,
        logoUrl: prefs.logoUrl || undefined,
        companyName: prefs.companyName || undefined,
        brandColor: prefs.brandColor || undefined,
        passedFolderName: prefs.passedFolderName || undefined,
        alwaysSkip: prefs.alwaysSkip || undefined,
        digestSchedule: prefs.digestSchedule || undefined,
        digestTimeZone: prefs.digestTimeZone || undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to load preferences for organization ${organizationId}: ${errorMessage}`,
      );
      return {};
    }
  }
}
