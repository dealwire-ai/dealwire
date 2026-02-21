import {
  Controller,
  Get,
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
import { AuthUser } from '../decorator/auth-user.decorator';
import { PrismaService } from '../service/prisma/prisma.service';
import { NycIngestionService } from '../service/public-data/nyc-ingestion.service';
import { ParcelQueryService } from '../service/public-data/parcel-query.service';
import { BOROUGH_NAMES } from '../service/public-data/nyc-utils';
import { resolveFeatureFlags } from '../util/feature-flags';

@Controller('public-data')
@UseGuards(ClerkAuthGuard)
export class PublicDataController {
  private readonly logger = new Logger(PublicDataController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestion: NycIngestionService,
    private readonly parcelQuery: ParcelQueryService,
  ) {}

  private async assertParcelsEnabled(organizationId: string | null) {
    if (!organizationId) {
      throw new HttpException('User not in organization', HttpStatus.FORBIDDEN);
    }
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { featureFlags: true },
    });
    const flags = resolveFeatureFlags(org?.featureFlags);
    if (!flags.parcels) {
      throw new HttpException('Parcels feature is not enabled for this organization', HttpStatus.FORBIDDEN);
    }
  }

  @Post('ingest')
  async triggerIngestion(
    @AuthUser('organizationId') organizationId: string | null,
    @Body() body: { boroughs?: string[]; sources?: string[] },
  ) {
    await this.assertParcelsEnabled(organizationId);

    const boroughs = body.boroughs || ['3', '4']; // Default: Brooklyn + Queens

    // Validate borough codes
    for (const b of boroughs) {
      if (!BOROUGH_NAMES[b]) {
        throw new HttpException(`Invalid borough code: ${b}. Valid: 1-5`, HttpStatus.BAD_REQUEST);
      }
    }

    this.logger.log(`Triggering ingestion for boroughs: ${boroughs.map((b) => BOROUGH_NAMES[b]).join(', ')}`);

    // Fire-and-forget — ingestion runs in the background
    this.ingestion.ingestAll(boroughs).then((results) => {
      this.logger.log(`Ingestion complete: ${JSON.stringify(results)}`);
    }).catch((err) => {
      this.logger.error(`Ingestion failed: ${err.message}`, err.stack);
    });

    return {
      message: 'Ingestion started',
      boroughs: boroughs.map((b) => ({ code: b, name: BOROUGH_NAMES[b] })),
    };
  }

  @Get('parcels')
  async getParcels(
    @AuthUser('organizationId') organizationId: string | null,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('borough') borough?: string,
    @Query('excludeCoops') excludeCoops?: string,
    @Query('hasActiveLien') hasActiveLien?: string,
    @Query('minDistressScore') minDistressScore?: string,
    @Query('minUnits') minUnits?: string,
    @Query('maxUnits') maxUnits?: string,
    @Query('zipCode') zipCode?: string,
    @Query('search') search?: string,
    @Query('buildingClass') buildingClass?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
  ) {
    await this.assertParcelsEnabled(organizationId);

    return this.parcelQuery.queryParcels({
      boroughs: borough ? borough.split(',') : undefined,
      excludeCoops: excludeCoops === 'true',
      hasActiveLien: hasActiveLien !== undefined ? hasActiveLien === 'true' : undefined,
      minDistressScore: minDistressScore ? parseFloat(minDistressScore) : undefined,
      minUnits: minUnits ? parseInt(minUnits) : undefined,
      maxUnits: maxUnits ? parseInt(maxUnits) : undefined,
      zipCode,
      search,
      buildingClass,
      sort,
      order,
      page,
      limit,
    });
  }

  @Get('parcels/export')
  async exportParcels(
    @AuthUser('organizationId') organizationId: string | null,
    @Res() res: Response,
    @Query('borough') borough?: string,
    @Query('excludeCoops') excludeCoops?: string,
    @Query('hasActiveLien') hasActiveLien?: string,
    @Query('minDistressScore') minDistressScore?: string,
    @Query('minUnits') minUnits?: string,
    @Query('maxUnits') maxUnits?: string,
    @Query('zipCode') zipCode?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
  ) {
    await this.assertParcelsEnabled(organizationId);

    const parcels = await this.parcelQuery.getAllForExport({
      boroughs: borough ? borough.split(',') : undefined,
      excludeCoops: excludeCoops === 'true',
      hasActiveLien: hasActiveLien !== undefined ? hasActiveLien === 'true' : undefined,
      minDistressScore: minDistressScore ? parseFloat(minDistressScore) : undefined,
      minUnits: minUnits ? parseInt(minUnits) : undefined,
      maxUnits: maxUnits ? parseInt(maxUnits) : undefined,
      zipCode,
      search,
      sort,
      order,
    });

    // Build CSV
    const headers = [
      'BBL', 'Borough', 'Address', 'Zip', 'Building Class', 'Units Total',
      'Units Residential', 'Building Area (sqft)', 'Lot Area (sqft)', 'Floors',
      'Year Built', 'Owner', 'Zone', 'Tax Class', 'Assessed Value',
      'Est. Market Value', 'Is Coop', 'Has Active Lien', 'Lien Cycle',
      'Water Debt Only', 'Violations Total', 'Violations Open',
      'Class A', 'Class B', 'Class C', 'Violations/Unit', 'Distress Score',
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
      p.violationsTotal,
      p.violationsOpen,
      p.violationsClassA,
      p.violationsClassB,
      p.violationsClassC,
      p.violationsPerUnit ?? '',
      p.distressScore ?? '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => {
          const str = String(cell);
          // Escape fields containing commas or quotes
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(','),
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=parcels-export.csv');
    res.send(csvContent);
  }

  @Get('stats')
  async getStats(
    @AuthUser('organizationId') organizationId: string | null,
    @Query('borough') borough?: string,
    @Query('excludeCoops') excludeCoops?: string,
  ) {
    await this.assertParcelsEnabled(organizationId);

    return this.parcelQuery.getStats({
      boroughs: borough ? borough.split(',') : undefined,
      excludeCoops: excludeCoops === 'true',
    });
  }

  @Get('parcels/:bbl')
  async getParcel(
    @AuthUser('organizationId') organizationId: string | null,
    @Param('bbl') bbl: string,
  ) {
    await this.assertParcelsEnabled(organizationId);

    const parcel = await this.parcelQuery.getParcelByBbl(bbl);
    if (!parcel) {
      throw new HttpException('Parcel not found', HttpStatus.NOT_FOUND);
    }
    return parcel;
  }
}
