import {
  Controller,
  Get,
  Put,
  Post,
  Query,
  Param,
  Body,
  Res,
  ParseIntPipe,
  DefaultValuePipe,
  HttpException,
  HttpStatus,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ClerkAuthGuard } from '../guard/clerk-auth.guard';
import { RequireOrgGuard } from '../guard/require-org.guard';
import { AuthUser } from '../decorator/auth-user.decorator';
import { PrismaService } from '../service/prisma/prisma.service';
import { NycIngestionService } from '../service/public-data/nyc-ingestion.service';
import { NyctlQuarterlyService } from '../service/public-data/nyctl-quarterly.service';
import { CareScraperService } from '../service/public-data/care-scraper.service';
import { ParcelQueryService } from '../service/public-data/parcel-query.service';
import { SkipTraceService } from '../service/public-data/skip-trace.service';
import { PhoneNoteService } from '../service/public-data/phone-note.service';
import { PropertyListService } from '../service/public-data/property-list.service';
import { BOROUGH_NAMES } from '../service/public-data/nyc-utils';
import { resolveFeatureFlags } from '../util/feature-flags';
import { PhoneStatus, ParcelListType } from '@prisma/client';

@Controller('public-data')
@UseGuards(ClerkAuthGuard, RequireOrgGuard)
export class PublicDataController {
  private readonly logger = new Logger(PublicDataController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestion: NycIngestionService,
    private readonly nyctl: NyctlQuarterlyService,
    private readonly careScraper: CareScraperService,
    private readonly parcelQuery: ParcelQueryService,
    private readonly skipTrace: SkipTraceService,
    private readonly phoneNote: PhoneNoteService,
    private readonly propertyList: PropertyListService,
  ) {}

  private async assertParcelsEnabled(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { featureFlags: true },
    });
    const flags = resolveFeatureFlags(org?.featureFlags);
    if (!flags.parcels) {
      throw new HttpException(
        'Parcels feature is not enabled for this organization',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  @Post('ingest')
  async triggerIngestion(
    @AuthUser('organizationId') organizationId: string,
    @Body() body: { boroughs?: string[]; sources?: string[] },
  ) {
    await this.assertParcelsEnabled(organizationId);

    const boroughs = body.boroughs || ['1', '3', '4']; // Default: Manhattan + Brooklyn + Queens

    // Validate borough codes
    for (const b of boroughs) {
      if (!BOROUGH_NAMES[b]) {
        throw new HttpException(
          `Invalid borough code: ${b}. Valid: 1-5`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    if (this.ingestion.isRunning) {
      throw new HttpException(
        'Ingestion is already running. Wait for it to complete before starting another.',
        HttpStatus.CONFLICT,
      );
    }

    this.logger.log(
      `Triggering ingestion for boroughs: ${boroughs.map((b) => BOROUGH_NAMES[b]).join(', ')}`,
    );

    // Fire-and-forget — ingestion runs in the background
    this.ingestion
      .ingestAll(boroughs, 'manual')
      .then((results) => {
        this.logger.log(`Ingestion complete: ${JSON.stringify(results)}`);
      })
      .catch((err) => {
        this.logger.error(`Ingestion failed: ${err.message}`, err.stack);
      });

    return {
      message: 'Ingestion started',
      boroughs: boroughs.map((b) => ({ code: b, name: BOROUGH_NAMES[b] })),
    };
  }

  @Post('ingest/nyctl')
  async triggerNyctlIngestion(
    @AuthUser('organizationId') organizationId: string,
    @Body() body: { reportDate: string },
  ) {
    await this.assertParcelsEnabled(organizationId);

    if (!body.reportDate) {
      throw new HttpException(
        'reportDate is required (e.g., "9-30-2025")',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.log(
      `Triggering NYCTL quarterly ingestion for report date: ${body.reportDate}`,
    );

    // Fire-and-forget
    this.nyctl
      .ingestNyctlQuarterly(body.reportDate)
      .then((result) => {
        this.logger.log(`NYCTL ingestion complete: ${JSON.stringify(result)}`);
      })
      .catch((err) => {
        this.logger.error(`NYCTL ingestion failed: ${err.message}`, err.stack);
      });

    return {
      message: 'NYCTL quarterly ingestion started',
      reportDate: body.reportDate,
    };
  }

  @Post('ingest/care')
  async triggerCareScraper(@AuthUser('organizationId') organizationId: string) {
    await this.assertParcelsEnabled(organizationId);

    if (this.careScraper.isRunning) {
      throw new HttpException(
        'CARE scraper is already running. Wait for it to complete before starting another.',
        HttpStatus.CONFLICT,
      );
    }

    this.logger.log('Triggering CARE portal scraper');

    // Fire-and-forget
    this.careScraper
      .scrapeAll()
      .then((result) => {
        this.logger.log(`CARE scraper complete: ${JSON.stringify(result)}`);
      })
      .catch((err) => {
        this.logger.error(`CARE scraper failed: ${err.message}`, err.stack);
      });

    return { message: 'CARE scraper started' };
  }

  @Get('ingestion-runs')
  async getIngestionRuns(@AuthUser('organizationId') organizationId: string) {
    await this.assertParcelsEnabled(organizationId);
    return this.prisma.ingestionRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 10,
    });
  }

  @Get('parcels')
  async getParcels(
    @AuthUser('organizationId') organizationId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('borough') borough?: string,
    @Query('excludeCoops') excludeCoops?: string,
    @Query('hasActiveLien') hasActiveLien?: string,
    @Query('minDistressScore') minDistressScore?: string,
    @Query('maxDistressScore') maxDistressScore?: string,
    @Query('minUnits') minUnits?: string,
    @Query('maxUnits') maxUnits?: string,
    @Query('zipCode') zipCode?: string,
    @Query('search') search?: string,
    @Query('buildingClass') buildingClass?: string,
    @Query('buildingClassGroups') buildingClassGroups?: string,
    @Query('excludeDClass') excludeDClass?: string,
    @Query('minOutstandingTaxBill') minOutstandingTaxBill?: string,
    @Query('maxOutstandingTaxBill') maxOutstandingTaxBill?: string,
    @Query('minLienSaleAmount') minLienSaleAmount?: string,
    @Query('maxLienSaleAmount') maxLienSaleAmount?: string,
    @Query('listType') listType?: string,
    @Query('hasNoList') hasNoList?: string,
    @Query('skipTraceStatus') skipTraceStatus?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
  ) {
    await this.assertParcelsEnabled(organizationId);

    return this.parcelQuery.queryParcels({
      boroughs: borough ? borough.split(',') : undefined,
      excludeCoops: excludeCoops !== 'false',
      excludeDClass: excludeDClass === 'false' ? false : true,
      hasActiveLien:
        hasActiveLien !== undefined ? hasActiveLien === 'true' : undefined,
      minDistressScore: minDistressScore
        ? parseFloat(minDistressScore)
        : undefined,
      maxDistressScore: maxDistressScore
        ? parseFloat(maxDistressScore)
        : undefined,
      minUnits: minUnits ? parseInt(minUnits) : undefined,
      maxUnits: maxUnits ? parseInt(maxUnits) : undefined,
      minOutstandingTaxBill: minOutstandingTaxBill
        ? parseFloat(minOutstandingTaxBill)
        : undefined,
      maxOutstandingTaxBill: maxOutstandingTaxBill
        ? parseFloat(maxOutstandingTaxBill)
        : undefined,
      minLienSaleAmount: minLienSaleAmount
        ? parseFloat(minLienSaleAmount)
        : undefined,
      maxLienSaleAmount: maxLienSaleAmount
        ? parseFloat(maxLienSaleAmount)
        : undefined,
      zipCode,
      search,
      buildingClasses: buildingClass ? buildingClass.split(',') : undefined,
      buildingClassGroups: buildingClassGroups
        ? buildingClassGroups.split(',')
        : undefined,
      listType: listType || undefined,
      hasNoList: hasNoList === 'true' ? true : undefined,
      skipTraceStatus: skipTraceStatus || undefined,
      organizationId: organizationId,
      sort,
      order,
      page,
      limit,
    });
  }

  @Get('parcels/export')
  async exportParcels(
    @AuthUser('organizationId') organizationId: string,
    @Res() res: Response,
    @Query('borough') borough?: string,
    @Query('excludeCoops') excludeCoops?: string,
    @Query('hasActiveLien') hasActiveLien?: string,
    @Query('minDistressScore') minDistressScore?: string,
    @Query('maxDistressScore') maxDistressScore?: string,
    @Query('minUnits') minUnits?: string,
    @Query('maxUnits') maxUnits?: string,
    @Query('zipCode') zipCode?: string,
    @Query('search') search?: string,
    @Query('buildingClass') buildingClass?: string,
    @Query('buildingClassGroups') buildingClassGroups?: string,
    @Query('excludeDClass') excludeDClass?: string,
    @Query('minOutstandingTaxBill') minOutstandingTaxBill?: string,
    @Query('maxOutstandingTaxBill') maxOutstandingTaxBill?: string,
    @Query('minLienSaleAmount') minLienSaleAmount?: string,
    @Query('maxLienSaleAmount') maxLienSaleAmount?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
  ) {
    await this.assertParcelsEnabled(organizationId);

    const parcels = await this.parcelQuery.getAllForExport({
      boroughs: borough ? borough.split(',') : undefined,
      excludeCoops: excludeCoops !== 'false',
      excludeDClass: excludeDClass === 'false' ? false : true,
      hasActiveLien:
        hasActiveLien !== undefined ? hasActiveLien === 'true' : undefined,
      minDistressScore: minDistressScore
        ? parseFloat(minDistressScore)
        : undefined,
      maxDistressScore: maxDistressScore
        ? parseFloat(maxDistressScore)
        : undefined,
      minUnits: minUnits ? parseInt(minUnits) : undefined,
      maxUnits: maxUnits ? parseInt(maxUnits) : undefined,
      minOutstandingTaxBill: minOutstandingTaxBill
        ? parseFloat(minOutstandingTaxBill)
        : undefined,
      maxOutstandingTaxBill: maxOutstandingTaxBill
        ? parseFloat(maxOutstandingTaxBill)
        : undefined,
      minLienSaleAmount: minLienSaleAmount
        ? parseFloat(minLienSaleAmount)
        : undefined,
      maxLienSaleAmount: maxLienSaleAmount
        ? parseFloat(maxLienSaleAmount)
        : undefined,
      zipCode,
      search,
      buildingClasses: buildingClass ? buildingClass.split(',') : undefined,
      buildingClassGroups: buildingClassGroups
        ? buildingClassGroups.split(',')
        : undefined,
      sort,
      order,
    });

    // Build CSV
    const headers = [
      'BBL',
      'Borough',
      'Address',
      'Zip',
      'Building Class',
      'Units Total',
      'Units Residential',
      'Building Area (sqft)',
      'Lot Area (sqft)',
      'Floors',
      'Year Built',
      'Owner',
      'Zone',
      'Tax Class',
      'Assessed Value',
      'Est. Market Value',
      'Is Coop',
      'Has Active Lien',
      'Lien Cycle',
      'Water Debt Only',
      'Outstanding Tax Bill',
      'Total Owed to DOF',
      'Violations Total',
      'Violations Open',
      'Class A',
      'Class B',
      'Class C',
      'Violations/Unit',
      'Distress Score',
      'Lien Sale Amount',
      'Redemptive Value',
      'Lien Servicer',
      'Lien Redeemed',
      'Foreclosure Status',
      'Trust Vintage',
      'Match Confidence',
    ];

    const rows = parcels.map((p) => [
      p.bbl,
      BOROUGH_NAMES[p.borough] || p.borough,
      p.address || '',
      p.zipCode || '',
      p.buildingClass || '',
      p.unitsTotal ?? '',
      p.unitsRes ?? '',
      p.buildingArea ?? '',
      p.lotArea ?? '',
      p.numFloors ?? '',
      p.yearBuilt ?? '',
      p.ownerName || '',
      p.zoneDist1 || '',
      p.taxClass || '',
      p.assessTotal ?? '',
      p.estimatedMarketValue ?? '',
      p.isCoopExcluded ? 'Yes' : 'No',
      p.hasActiveLien ? 'Yes' : 'No',
      p.lienCycle || '',
      p.waterDebtOnly ? 'Yes' : 'No',
      p.outstandingTaxBill ?? '',
      p.totalOutstandingBalance ?? '',
      p.violationsTotal,
      p.violationsOpen,
      p.violationsClassA,
      p.violationsClassB,
      p.violationsClassC,
      p.violationsPerUnit ?? '',
      p.distressScore ?? '',
      p.lienSaleAmount ?? '',
      p.lienRedemptiveValue ?? '',
      p.lienServicer || '',
      p.lienRedeemed === null ? '' : p.lienRedeemed ? 'Yes' : 'No',
      p.lienForeclosureStatus || '',
      p.lienTrustVintage || '',
      p.lienMatchConfidence || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row
          .map((cell) => {
            const str = String(cell);
            // Escape fields containing commas or quotes
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(','),
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=parcels-export.csv',
    );
    res.send(csvContent);
  }

  @Get('stats')
  async getStats(
    @AuthUser('organizationId') organizationId: string,
    @Query('borough') borough?: string,
    @Query('excludeCoops') excludeCoops?: string,
  ) {
    await this.assertParcelsEnabled(organizationId);

    return this.parcelQuery.getStats({
      boroughs: borough ? borough.split(',') : undefined,
      excludeCoops: excludeCoops !== 'false',
    });
  }

  @Get('parcels/skip-trace/usage')
  async getSkipTraceUsage(@AuthUser('organizationId') organizationId: string) {
    await this.assertParcelsEnabled(organizationId);
    return this.skipTrace.getOrgUsageInfo(organizationId!);
  }

  @Get('parcels/:bbl')
  async getParcel(
    @AuthUser('organizationId') organizationId: string,
    @Param('bbl') bbl: string,
  ) {
    await this.assertParcelsEnabled(organizationId);

    const parcel = await this.parcelQuery.getParcelByBbl(bbl, organizationId);
    if (!parcel) {
      throw new HttpException('Parcel not found', HttpStatus.NOT_FOUND);
    }
    return parcel;
  }

  @Post('parcels/skip-trace')
  async batchSkipTrace(
    @AuthUser('organizationId') organizationId: string,
    @Body() body: { bbls: string[]; force?: boolean },
  ) {
    await this.assertParcelsEnabled(organizationId);

    if (!body.bbls || body.bbls.length === 0) {
      throw new HttpException('bbls array is required', HttpStatus.BAD_REQUEST);
    }
    if (body.bbls.length > 500) {
      throw new HttpException(
        'Maximum 500 BBLs per request',
        HttpStatus.BAD_REQUEST,
      );
    }

    let result: { queueId: string; queued: string[]; skipped: number };
    try {
      result = await this.skipTrace.submitBatch(
        body.bbls,
        organizationId,
        body.force ?? false,
      );
    } catch (err) {
      const message = (err as Error).message;
      if (
        message.includes('credit cap') ||
        message.includes('already traced') ||
        message.includes('skip trace limit')
      ) {
        throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
      }
      if (message.includes('not configured')) {
        throw new HttpException(
          'Skip tracing is not configured on this server',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      this.logger.error(
        `Batch skip trace failed for ${body.bbls.length} BBLs: ${message}`,
        (err as Error).stack,
      );
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // Fire-and-forget polling (only if there are queued items)
    if (result.queued.length > 0 && result.queueId !== 'cache') {
      this.skipTrace.pollAndStore(result.queueId, result.queued);
    }

    return {
      queued: result.queued.length,
      skipped: result.skipped,
      queueId: result.queueId,
      estimatedCostUsd: +(result.queued.length * 0.02).toFixed(2),
    };
  }

  @Post('parcels/:bbl/skip-trace')
  async singleSkipTrace(
    @AuthUser('organizationId') organizationId: string,
    @Param('bbl') bbl: string,
    @Body() body: { force?: boolean },
  ) {
    await this.assertParcelsEnabled(organizationId);

    let result: { queueId: string; queued: string[]; skipped: number };
    try {
      result = await this.skipTrace.enqueue(
        bbl,
        organizationId,
        body.force ?? false,
      );
    } catch (err) {
      const message = (err as Error).message;
      if (
        message.includes('credit cap') ||
        message.includes('already traced') ||
        message.includes('skip trace limit')
      ) {
        throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
      }
      if (message.includes('not configured')) {
        throw new HttpException(
          'Skip tracing is not configured on this server',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      this.logger.error(
        `Single skip trace failed for BBL ${bbl}: ${message}`,
        (err as Error).stack,
      );
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return {
      queued: result.queued.length,
      skipped: result.skipped,
      queueId: result.queueId,
      estimatedCostUsd: +(result.queued.length * 0.02).toFixed(2),
    };
  }

  @Put('parcels/:bbl/list')
  async assignList(
    @AuthUser('organizationId') organizationId: string,
    @AuthUser('userId') userId: string | null,
    @Param('bbl') bbl: string,
    @Body() body: { listType: string | null },
  ) {
    await this.assertParcelsEnabled(organizationId);

    const listType =
      body.listType !== null
        ? ParcelListType[body.listType as keyof typeof ParcelListType]
        : null;
    if (body.listType !== null && !listType) {
      throw new HttpException(
        `Invalid listType: ${body.listType}. Valid: IMMEDIATE, LONG_TERM, NOT_INTERESTED`,
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const assignment = await this.propertyList.assign({
        bbl,
        organizationId: organizationId,
        userId: userId!,
        listType,
      });
      return { assignment };
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes('not found')) {
        throw new HttpException(message, HttpStatus.NOT_FOUND);
      }
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('parcels/batch-list')
  async batchAssignList(
    @AuthUser('organizationId') organizationId: string,
    @AuthUser('userId') userId: string | null,
    @Body() body: { bbls: string[]; listType: string | null },
  ) {
    await this.assertParcelsEnabled(organizationId);

    if (!body.bbls || body.bbls.length === 0) {
      throw new HttpException('bbls array is required', HttpStatus.BAD_REQUEST);
    }

    const listType =
      body.listType !== null
        ? ParcelListType[body.listType as keyof typeof ParcelListType]
        : null;
    if (body.listType !== null && !listType) {
      throw new HttpException(
        `Invalid listType: ${body.listType}. Valid: IMMEDIATE, LONG_TERM, NOT_INTERESTED`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const updated = await this.propertyList.batchAssign({
      bbls: body.bbls,
      organizationId: organizationId,
      userId: userId!,
      listType,
    });

    return { updated };
  }

  @Get('parcels/:bbl/phone-notes')
  async getPhoneNotes(
    @AuthUser('organizationId') organizationId: string,
    @AuthUser('userId') userId: string | null,
    @Param('bbl') bbl: string,
  ) {
    await this.assertParcelsEnabled(organizationId);

    const parcel = await this.parcelQuery.getParcelByBbl(bbl);
    if (!parcel) {
      throw new HttpException('Parcel not found', HttpStatus.NOT_FOUND);
    }

    const notes = await this.phoneNote.getNotesForParcel(
      parcel.id,
      organizationId,
    );
    return { notes };
  }

  @Put('parcels/:bbl/phone-notes')
  async upsertPhoneNote(
    @AuthUser('organizationId') organizationId: string,
    @AuthUser('userId') userId: string | null,
    @Param('bbl') bbl: string,
    @Body()
    body: {
      phoneNumber: string;
      status?: 'GOOD' | 'BAD' | 'UNKNOWN';
      note?: string;
    },
  ) {
    await this.assertParcelsEnabled(organizationId);

    if (!body.phoneNumber) {
      throw new HttpException(
        'phoneNumber is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      return await this.phoneNote.upsertNote({
        bbl,
        phoneNumber: body.phoneNumber,
        organizationId: organizationId,
        userId: userId!,
        status: body.status
          ? PhoneStatus[body.status as keyof typeof PhoneStatus]
          : undefined,
        note: body.note,
      });
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes('not found')) {
        throw new HttpException(message, HttpStatus.NOT_FOUND);
      }
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
