import { Injectable, Logger } from '@nestjs/common';
import { CronExpressionParser } from 'cron-parser';
import { PrismaService } from '../prisma/prisma.service';

export interface ScreeningPreferences {
  dealCriteria?: string;
  organizationImageUrl?: string;
  companyName?: string;
  brandColor?: string;
  /** Folder name for passed/rejected deals (default: "Passed Deals") */
  passedFolderName?: string;
  /** Free-text criteria for the LLM to interpret (e.g. "retail deals", "deals under 40 units") */
  skipCriteria?: string;
  /** Structured list of property names/addresses to skip via regex (one per line) */
  knownProperties?: string;
  /** CRON expression for digest schedule (e.g., "0 12 * * *" for daily at noon) */
  digestSchedule?: string;
  /** Timezone for digest schedule (default: "America/New_York") */
  digestTimeZone?: string;
  /** If non-empty, only these users' inboxes are monitored; falls back to oldest connected user */
  designatedMonitoringInboxEmails?: string[];
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
  async getPreferences(
    organizationId: string | null | undefined,
  ): Promise<ScreeningPreferences> {
    if (!organizationId) {
      this.logger.debug(
        'No organizationId provided, returning empty preferences',
      );
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
        this.logger.warn(
          `No preferences found for organization ${organizationId}`,
        );
        return {};
      }

      return {
        dealCriteria: prefs.dealCriteria || undefined,
        organizationImageUrl: prefs.organization.imageUrl || undefined,
        companyName: prefs.companyName || undefined,
        brandColor: prefs.brandColor || undefined,
        passedFolderName: prefs.passedFolderName || undefined,
        skipCriteria: prefs.skipCriteria || undefined,
        knownProperties: prefs.knownProperties || undefined,
        digestSchedule: prefs.digestSchedule || undefined,
        digestTimeZone: prefs.digestTimeZone || undefined,
        designatedMonitoringInboxEmails:
          prefs.designatedMonitoringInboxEmails.length > 0
            ? prefs.designatedMonitoringInboxEmails
            : undefined,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to load preferences for organization ${organizationId}: ${errorMessage}`,
      );
      return {};
    }
  }

  /**
   * Update preferences for an organization (partial update)
   * @param organizationId - The organization ID
   * @param partial - Partial preferences to update (dealCriteria, skipCriteria, passedFolderName, digestSchedule, digestTimeZone, companyName, brandColor)
   */
  async updatePreferences(
    organizationId: string,
    partial: Partial<
      Pick<
        ScreeningPreferences,
        | 'dealCriteria'
        | 'skipCriteria'
        | 'knownProperties'
        | 'passedFolderName'
        | 'digestSchedule'
        | 'digestTimeZone'
        | 'companyName'
        | 'brandColor'
        | 'designatedMonitoringInboxEmails'
      >
    >,
  ): Promise<ScreeningPreferences> {
    if (!organizationId) {
      throw new Error('organizationId is required');
    }

    const data: Record<string, unknown> = {};
    if (partial.dealCriteria !== undefined)
      data.dealCriteria = partial.dealCriteria;
    if (partial.skipCriteria !== undefined)
      data.skipCriteria = partial.skipCriteria;
    if (partial.knownProperties !== undefined)
      data.knownProperties = partial.knownProperties;
    if (partial.passedFolderName !== undefined)
      data.passedFolderName = partial.passedFolderName;
    if (partial.digestSchedule !== undefined) {
      if (partial.digestSchedule) {
        try {
          CronExpressionParser.parse(partial.digestSchedule);
        } catch {
          throw new Error(
            `Invalid CRON expression: "${partial.digestSchedule}"`,
          );
        }
      }
      data.digestSchedule = partial.digestSchedule;
    }
    if (partial.digestTimeZone !== undefined)
      data.digestTimeZone = partial.digestTimeZone;
    if (partial.companyName !== undefined)
      data.companyName = partial.companyName;
    if (partial.brandColor !== undefined) data.brandColor = partial.brandColor;
    if (partial.designatedMonitoringInboxEmails !== undefined)
      data.designatedMonitoringInboxEmails =
        partial.designatedMonitoringInboxEmails;

    if (Object.keys(data).length === 0) {
      return this.getPreferences(
        organizationId,
      ) as Promise<ScreeningPreferences>;
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
      skipCriteria: updated.skipCriteria || undefined,
      knownProperties: updated.knownProperties || undefined,
      digestSchedule: updated.digestSchedule || undefined,
      digestTimeZone: updated.digestTimeZone || undefined,
      designatedMonitoringInboxEmails:
        updated.designatedMonitoringInboxEmails.length > 0
          ? updated.designatedMonitoringInboxEmails
          : undefined,
    };
  }
}
