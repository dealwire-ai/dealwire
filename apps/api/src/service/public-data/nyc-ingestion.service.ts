import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SodaAdapter, SodaSourceConfig } from './soda.adapter';
import { DistressScoringService } from './distress-scoring.service';
import {
  normalizeBbl,
  BOROUGH_NUMERIC_TO_ABBR,
  estimateMarketValue,
  isCoopBuildingClass,
} from './nyc-utils';

// NYC Open Data source configurations
const NYC_BASE_URL = 'https://data.cityofnewyork.us';

const NYC_TAX_LIENS: SodaSourceConfig = {
  baseUrl: NYC_BASE_URL,
  datasetId: '9rz4-mjek',
  name: 'NYC Tax Lien Sale List',
};

const NYC_PLUTO: SodaSourceConfig = {
  baseUrl: NYC_BASE_URL,
  datasetId: '64uk-42ks',
  name: 'NYC PLUTO',
};

const NYC_HPD_VIOLATIONS: SodaSourceConfig = {
  baseUrl: NYC_BASE_URL,
  datasetId: 'wvxf-dwi5',
  name: 'NYC HPD Violations',
};

const NYC_PROPERTY_CHARGES: SodaSourceConfig = {
  baseUrl: NYC_BASE_URL,
  datasetId: 'scjx-j6np',
  name: 'NYC Property Charges Balance',
};

export interface IngestionResult {
  source: string;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  durationMs: number;
}

@Injectable()
export class NycIngestionService {
  private readonly logger = new Logger(NycIngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly soda: SodaAdapter,
    private readonly scoring: DistressScoringService,
  ) {}

  /**
   * Run full ingestion pipeline: tax liens → PLUTO enrichment → HPD violations → scoring.
   */
  async ingestAll(boroughs: string[]): Promise<IngestionResult[]> {
    this.logger.log(
      `Starting full ingestion for boroughs: ${boroughs.join(', ')}`,
    );
    const results: IngestionResult[] = [];

    // 1. Ingest tax lien list (creates Parcel rows)
    const lienResult = await this.ingestTaxLiens(boroughs);
    results.push(lienResult);

    // 2. Enrich with PLUTO data (query by borough abbreviation)
    const plutoResult = await this.ingestPlutoData(boroughs);
    results.push(plutoResult);

    // 3. Ingest HPD violations
    const hpdResult = await this.ingestHpdViolations(boroughs);
    results.push(hpdResult);

    // 4. Ingest property charges (outstanding tax bills)
    const chargesResult = await this.ingestPropertyCharges(boroughs);
    results.push(chargesResult);

    // 5. Compute distress scores
    await this.scoring.scoreAll();

    this.logger.log(
      `Full ingestion complete. Results: ${JSON.stringify(results.map((r) => `${r.source}: ${r.recordsProcessed}`))}`,
    );
    return results;
  }

  /**
   * Ingest tax lien sale list from NYC DOF.
   * Creates/updates Parcel rows with lien status.
   */
  async ingestTaxLiens(boroughs: string[]): Promise<IngestionResult> {
    const start = Date.now();
    this.logger.log(`Ingesting tax liens for boroughs: ${boroughs.join(', ')}`);

    let processed = 0;
    let created = 0;
    let updated = 0;

    // First, find the most recent lien cycle date (the dataset has years of history)
    const [latestRecord] = (await this.soda.fetch(NYC_TAX_LIENS, {
      $select: 'month',
      $order: 'month DESC',
      $limit: 1,
    })) as Record<string, string>[];

    if (!latestRecord?.month) {
      this.logger.warn('No tax lien records found');
      return {
        source: 'tax_liens',
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        durationMs: Date.now() - start,
      };
    }

    const latestMonth = latestRecord.month;
    this.logger.log(`Latest tax lien cycle: ${latestMonth}`);

    // Build borough filter for SODA query — only fetch the most recent cycle
    const boroughFilter = boroughs.map((b) => `borough='${b}'`).join(' OR ');

    for await (const page of this.soda.fetchAll(NYC_TAX_LIENS, {
      $where: `month='${latestMonth}' AND (${boroughFilter})`,
      $order: 'borough,block,lot',
    })) {
      for (const record of page as Record<string, string>[]) {
        const borough = record.borough?.trim();
        const block = record.block?.trim();
        const lot = record.lot?.trim();

        if (!borough || !block || !lot) continue;

        const bbl = normalizeBbl(borough, block, lot);

        const address =
          [record.house_number, record.street_name].filter(Boolean).join(' ') ||
          null;

        const result = await this.prisma.parcel.upsert({
          where: { bbl },
          create: {
            bbl,
            borough,
            block: block.padStart(5, '0'),
            lot: lot.padStart(4, '0'),
            address,
            zipCode: record.zip_code || null,
            buildingClass: record.building_class || null,
            taxClass: record.tax_class_code || null,
            hasActiveLien: true,
            lienCycle: record.cycle || null,
            waterDebtOnly:
              (record.water_debt_only || '').toLowerCase() === 'yes',
            liensSyncedAt: new Date(),
          },
          update: {
            hasActiveLien: true,
            lienCycle: record.cycle || null,
            waterDebtOnly:
              (record.water_debt_only || '').toLowerCase() === 'yes',
            liensSyncedAt: new Date(),
          },
        });

        processed++;
        if (result.createdAt.getTime() === result.updatedAt.getTime()) {
          created++;
        } else {
          updated++;
        }
      }
    }

    const duration = Date.now() - start;
    this.logger.log(
      `Tax liens: ${processed} processed (${created} created, ${updated} updated) in ${duration}ms`,
    );

    return {
      source: 'tax_liens',
      recordsProcessed: processed,
      recordsCreated: created,
      recordsUpdated: updated,
      durationMs: duration,
    };
  }

  /**
   * Enrich parcels with PLUTO property data.
   * PLUTO stores BBL as a numeric float (e.g. 3001850041.00000000), so we query
   * using numeric comparison (bbl=3001850041 OR bbl=...) in batches.
   */
  async ingestPlutoData(boroughs: string[]): Promise<IngestionResult> {
    const start = Date.now();

    // Get the BBLs we need to enrich
    const existingParcels = await this.prisma.parcel.findMany({
      where: { borough: { in: boroughs } },
      select: { bbl: true },
    });
    const bbls = existingParcels.map((p) => p.bbl);
    this.logger.log(`Enriching ${bbls.length} parcels with PLUTO data`);

    if (bbls.length === 0) {
      return {
        source: 'pluto',
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        durationMs: Date.now() - start,
      };
    }

    let processed = 0;
    let updated = 0;

    // Batch BBLs into groups for SODA queries using numeric comparison
    const batchSize = 100;
    for (let i = 0; i < bbls.length; i += batchSize) {
      const batch = bbls.slice(i, i + batchSize);

      // Use numeric OR conditions: bbl=3001850041 OR bbl=3001970016 OR ...
      const bblFilter = batch.map((b) => `bbl=${b}`).join(' OR ');

      const records = (await this.soda.fetch(NYC_PLUTO, {
        $where: bblFilter,
        $limit: batchSize,
      })) as Record<string, string>[];

      for (const record of records) {
        // Reconstruct the clean 10-char BBL from PLUTO's borough+block+lot
        const boroughAbbr = record.borough?.trim();
        const block = record.block?.trim();
        const lot = record.lot?.trim();
        if (!boroughAbbr || !block || !lot) continue;

        const boroughNumeric = Object.entries(BOROUGH_NUMERIC_TO_ABBR).find(
          ([, abbr]) => abbr === boroughAbbr,
        )?.[0];
        if (!boroughNumeric) continue;

        const bbl = normalizeBbl(boroughNumeric, block, lot);
        processed++;

        const assessTotal = parseFloat(record.assesstot) || null;
        const taxClass = record.taxclass || null;
        const buildingClass = record.bldgclass || null;
        const unitsTotal = parseInt(record.unitstotal) || null;

        await this.prisma.parcel.updateMany({
          where: { bbl },
          data: {
            address: record.address || null,
            zipCode: record.zipcode || null,
            buildingClass,
            unitsTotal,
            unitsRes: parseInt(record.unitsres) || null,
            buildingArea: parseInt(record.bldgarea) || null,
            lotArea: parseInt(record.lotarea) || null,
            numFloors: parseFloat(record.numfloors) || null,
            yearBuilt: parseInt(record.yearbuilt) || null,
            ownerName: record.ownername || null,
            zoneDist1: record.zonedist1 || null,
            landUse: record.landuse || null,
            assessTotal,
            taxClass,
            estimatedMarketValue: estimateMarketValue(assessTotal, taxClass),
            isCoopExcluded: isCoopBuildingClass(buildingClass),
            plutoSyncedAt: new Date(),
          },
        });
        updated++;
      }

      if ((i / batchSize) % 5 === 0) {
        this.logger.log(
          `PLUTO progress: ${i + batch.length}/${bbls.length} BBLs queried, ${updated} updated`,
        );
      }
    }

    const duration = Date.now() - start;
    this.logger.log(
      `PLUTO enrichment: ${updated} parcels updated in ${duration}ms`,
    );

    return {
      source: 'pluto',
      recordsProcessed: processed,
      recordsCreated: 0,
      recordsUpdated: updated,
      durationMs: duration,
    };
  }

  /**
   * Ingest HPD violations and aggregate counts per parcel.
   * Queries HPD in batches by block+lot (since HPD has no single BBL field)
   * to avoid fetching all 5M+ violations for a borough.
   */
  async ingestHpdViolations(boroughs: string[]): Promise<IngestionResult> {
    const start = Date.now();
    this.logger.log(
      `Ingesting HPD violations for boroughs: ${boroughs.join(', ')}`,
    );

    // Get parcels we need to enrich — need borough, block, lot for HPD queries
    const existingParcels = await this.prisma.parcel.findMany({
      where: { borough: { in: boroughs } },
      select: {
        bbl: true,
        borough: true,
        block: true,
        lot: true,
        unitsTotal: true,
      },
    });

    if (existingParcels.length === 0) {
      this.logger.log('No parcels to enrich with HPD data');
      return {
        source: 'hpd_violations',
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        durationMs: Date.now() - start,
      };
    }

    this.logger.log(
      `Querying HPD violations for ${existingParcels.length} parcels`,
    );

    // Build a lookup from BBL to unitsTotal
    const unitsMap = new Map(existingParcels.map((p) => [p.bbl, p.unitsTotal]));

    // Aggregate violation counts by BBL
    const counts = new Map<
      string,
      {
        total: number;
        open: number;
        classA: number;
        classB: number;
        classC: number;
      }
    >();

    let totalFetched = 0;

    // Group parcels by borough, then batch-query HPD by block+lot
    for (const borough of boroughs) {
      const boroughParcels = existingParcels.filter(
        (p) => p.borough === borough,
      );
      if (boroughParcels.length === 0) continue;

      // Batch into groups of 50 (HPD queries by block+lot pairs)
      const batchSize = 50;
      for (let i = 0; i < boroughParcels.length; i += batchSize) {
        const batch = boroughParcels.slice(i, i + batchSize);

        // Build HPD query: boroid='3' AND ((block='185' AND lot='41') OR (block='197' AND lot='16') OR ...)
        // HPD uses unpadded block/lot
        const pairFilter = batch
          .map(
            (p) =>
              `(block='${parseInt(p.block)}' AND lot='${parseInt(p.lot)}')`,
          )
          .join(' OR ');
        const whereClause = `boroid='${borough}' AND (${pairFilter})`;

        for await (const page of this.soda.fetchAll(NYC_HPD_VIOLATIONS, {
          $where: whereClause,
          $select: 'boroid,block,lot,class,currentstatus',
        })) {
          for (const record of page as Record<string, string>[]) {
            const boroid = record.boroid?.trim();
            const block = record.block?.trim();
            const lot = record.lot?.trim();
            if (!boroid || !block || !lot) continue;

            const bbl = normalizeBbl(boroid, block, lot);

            if (!counts.has(bbl)) {
              counts.set(bbl, {
                total: 0,
                open: 0,
                classA: 0,
                classB: 0,
                classC: 0,
              });
            }
            const c = counts.get(bbl)!;
            c.total++;

            const status = (record.currentstatus || '').toUpperCase();
            if (status !== 'CLOSE') c.open++;

            const violClass = (record.class || '').toUpperCase();
            if (violClass === 'A') c.classA++;
            else if (violClass === 'B') c.classB++;
            else if (violClass === 'C') c.classC++;
          }
          totalFetched += page.length;
        }

        if ((i / batchSize) % 5 === 0) {
          this.logger.log(
            `HPD progress: borough ${borough}, ${i + batch.length}/${boroughParcels.length} parcels queried, ${totalFetched} violations fetched`,
          );
        }
      }
    }

    // Batch update parcels with aggregated violation counts
    let updated = 0;
    for (const [bbl, c] of counts) {
      const unitsTotal = unitsMap.get(bbl);
      const violationsPerUnit =
        unitsTotal && unitsTotal > 0
          ? Math.round((c.open / unitsTotal) * 100) / 100
          : null;

      await this.prisma.parcel.updateMany({
        where: { bbl },
        data: {
          violationsTotal: c.total,
          violationsOpen: c.open,
          violationsClassA: c.classA,
          violationsClassB: c.classB,
          violationsClassC: c.classC,
          violationsPerUnit,
          violationsSyncedAt: new Date(),
        },
      });
      updated++;
    }

    const duration = Date.now() - start;
    this.logger.log(
      `HPD violations: ${totalFetched} fetched, ${counts.size} parcels aggregated, ${updated} updated in ${duration}ms`,
    );

    return {
      source: 'hpd_violations',
      recordsProcessed: totalFetched,
      recordsCreated: 0,
      recordsUpdated: updated,
      durationMs: duration,
    };
  }

  /**
   * Ingest property charges from DOF Property Charges Balance (scjx-j6np).
   * Aggregates outstanding tax bills (CHG) and total balance per parcel.
   *
   * Dataset structure: one row per property × charge type × billing period × extract date.
   * We filter to the latest extractdt and sum_bal > 0, then aggregate per BBL.
   */
  async ingestPropertyCharges(boroughs: string[]): Promise<IngestionResult> {
    const start = Date.now();
    this.logger.log(
      `Ingesting property charges for boroughs: ${boroughs.join(', ')}`,
    );

    // Get BBLs we need to query
    const existingParcels = await this.prisma.parcel.findMany({
      where: { borough: { in: boroughs } },
      select: { bbl: true },
    });
    const bbls = existingParcels.map((p) => p.bbl);

    if (bbls.length === 0) {
      return {
        source: 'property_charges',
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        durationMs: Date.now() - start,
      };
    }

    this.logger.log(`Querying property charges for ${bbls.length} parcels`);

    // Find the latest extract date in the dataset
    const [latestExtract] = (await this.soda.fetch(NYC_PROPERTY_CHARGES, {
      $select: 'extractdt',
      $order: 'extractdt DESC',
      $limit: 1,
    })) as Record<string, string>[];

    if (!latestExtract?.extractdt) {
      this.logger.warn('No property charges records found');
      return {
        source: 'property_charges',
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        durationMs: Date.now() - start,
      };
    }

    const latestExtractDt = latestExtract.extractdt;
    this.logger.log(`Latest property charges extract: ${latestExtractDt}`);

    // Aggregate charges per BBL: { bbl -> { chg, total } }
    const charges = new Map<string, { chg: number; total: number }>();
    let totalRecords = 0;

    // Batch BBLs into groups of 250 (URL length limit for IN clause)
    const batchSize = 250;
    for (let i = 0; i < bbls.length; i += batchSize) {
      const batch = bbls.slice(i, i + batchSize);

      // Build IN clause: parid IN ('3004050058','3004050059',...)
      const paridList = batch.map((b) => `'${b}'`).join(',');
      const whereClause = `parid IN (${paridList}) AND extractdt='${latestExtractDt}' AND sum_bal > 0`;

      const records = (await this.soda.fetch(NYC_PROPERTY_CHARGES, {
        $where: whereClause,
        $select: 'parid,code,sum_bal',
        $limit: 50000,
      })) as Record<string, string>[];

      for (const record of records) {
        const parid = record.parid?.trim();
        if (!parid) continue;

        const sumBal = parseFloat(record.sum_bal) || 0;
        if (sumBal <= 0) continue;

        if (!charges.has(parid)) {
          charges.set(parid, { chg: 0, total: 0 });
        }
        const c = charges.get(parid)!;
        c.total += sumBal;

        const code = (record.code || '').toUpperCase();
        if (code === 'CHG') {
          c.chg += sumBal;
        }

        totalRecords++;
      }

      if ((i / batchSize) % 3 === 0) {
        this.logger.log(
          `Property charges progress: ${i + batch.length}/${bbls.length} BBLs queried, ${charges.size} with balances`,
        );
      }
    }

    // Batch update parcels with aggregated charges
    let updated = 0;
    const now = new Date();

    // First, reset charges for all parcels in scope (some may no longer have balances)
    await this.prisma.parcel.updateMany({
      where: { borough: { in: boroughs } },
      data: {
        outstandingTaxBill: null,
        totalOutstandingBalance: null,
        chargesSyncedAt: now,
      },
    });

    // Then set values for parcels that have outstanding charges
    for (const [bbl, c] of charges) {
      await this.prisma.parcel.updateMany({
        where: { bbl },
        data: {
          outstandingTaxBill: Math.round(c.chg * 100) / 100,
          totalOutstandingBalance: Math.round(c.total * 100) / 100,
          chargesSyncedAt: now,
        },
      });
      updated++;
    }

    const duration = Date.now() - start;
    this.logger.log(
      `Property charges: ${totalRecords} records, ${charges.size} parcels with balances, ${updated} updated in ${duration}ms`,
    );

    return {
      source: 'property_charges',
      recordsProcessed: totalRecords,
      recordsCreated: 0,
      recordsUpdated: updated,
      durationMs: duration,
    };
  }
}
