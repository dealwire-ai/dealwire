import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ScreeningPreferences {
  dealCriteria?: string;
  organizationImageUrl?: string;
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
        include: {
          organization: {
            select: {
              imageUrl: true,
            },
          },
        },
      });

      if (!prefs) {
        this.logger.warn(`No preferences found for organization ${organizationId}`);
        return {};
      }

      return {
        dealCriteria: prefs.dealCriteria || undefined,
        organizationImageUrl: prefs.organization.imageUrl || undefined,
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

  /**
   * Update preferences for an organization (partial update)
   * @param organizationId - The organization ID
   * @param partial - Partial preferences to update (dealCriteria, alwaysSkip, passedFolderName, digestSchedule, digestTimeZone, companyName, brandColor)
   */
  async updatePreferences(
    organizationId: string,
    partial: Partial<
      Pick<
        ScreeningPreferences,
        | 'dealCriteria'
        | 'alwaysSkip'
        | 'passedFolderName'
        | 'digestSchedule'
        | 'digestTimeZone'
        | 'companyName'
        | 'brandColor'
      >
    >,
  ): Promise<ScreeningPreferences> {
    if (!organizationId) {
      throw new Error('organizationId is required');
    }

    const data: Record<string, unknown> = {};
    if (partial.dealCriteria !== undefined) data.dealCriteria = partial.dealCriteria;
    if (partial.alwaysSkip !== undefined) data.alwaysSkip = partial.alwaysSkip;
    if (partial.passedFolderName !== undefined)
      data.passedFolderName = partial.passedFolderName;
    if (partial.digestSchedule !== undefined)
      data.digestSchedule = partial.digestSchedule;
    if (partial.digestTimeZone !== undefined)
      data.digestTimeZone = partial.digestTimeZone;
    if (partial.companyName !== undefined) data.companyName = partial.companyName;
    if (partial.brandColor !== undefined) data.brandColor = partial.brandColor;

    if (Object.keys(data).length === 0) {
      return this.getPreferences(organizationId) as Promise<ScreeningPreferences>;
    }

    const updated = await this.prisma.screeningPreferences.upsert({
      where: { organizationId },
      create: {
        organizationId,
        ...data,
      } as never,
      update: data as never,
      include: {
        organization: { select: { imageUrl: true } },
      },
    });

    return {
      dealCriteria: updated.dealCriteria || undefined,
      organizationImageUrl: updated.organization.imageUrl || undefined,
      companyName: updated.companyName || undefined,
      brandColor: updated.brandColor || undefined,
      passedFolderName: updated.passedFolderName || undefined,
      alwaysSkip: updated.alwaysSkip || undefined,
      digestSchedule: updated.digestSchedule || undefined,
      digestTimeZone: updated.digestTimeZone || undefined,
    };
  }
}
