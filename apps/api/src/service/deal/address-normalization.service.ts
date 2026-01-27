import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AddressComponents {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
}

@Injectable()
export class AddressNormalizationService {
  private readonly logger = new Logger(AddressNormalizationService.name);

  // Common street type abbreviations
  private readonly streetTypeMap: Record<string, string> = {
    st: 'STREET',
    street: 'STREET',
    ave: 'AVENUE',
    avenue: 'AVENUE',
    av: 'AVENUE',
    rd: 'ROAD',
    road: 'ROAD',
    blvd: 'BOULEVARD',
    boulevard: 'BOULEVARD',
    dr: 'DRIVE',
    drive: 'DRIVE',
    ln: 'LANE',
    lane: 'LANE',
    ct: 'COURT',
    court: 'COURT',
    pl: 'PLACE',
    place: 'PLACE',
    pkwy: 'PARKWAY',
    parkway: 'PARKWAY',
    way: 'WAY',
    cir: 'CIRCLE',
    circle: 'CIRCLE',
    trl: 'TRAIL',
    trail: 'TRAIL',
  };

  // US state name to abbreviation mapping
  private readonly stateMap: Record<string, string> = {
    alabama: 'AL',
    alaska: 'AK',
    arizona: 'AZ',
    arkansas: 'AR',
    california: 'CA',
    colorado: 'CO',
    connecticut: 'CT',
    delaware: 'DE',
    florida: 'FL',
    georgia: 'GA',
    hawaii: 'HI',
    idaho: 'ID',
    illinois: 'IL',
    indiana: 'IN',
    iowa: 'IA',
    kansas: 'KS',
    kentucky: 'KY',
    louisiana: 'LA',
    maine: 'ME',
    maryland: 'MD',
    massachusetts: 'MA',
    michigan: 'MI',
    minnesota: 'MN',
    mississippi: 'MS',
    missouri: 'MO',
    montana: 'MT',
    nebraska: 'NE',
    nevada: 'NV',
    'new hampshire': 'NH',
    'new jersey': 'NJ',
    'new mexico': 'NM',
    'new york': 'NY',
    'north carolina': 'NC',
    'north dakota': 'ND',
    ohio: 'OH',
    oklahoma: 'OK',
    oregon: 'OR',
    pennsylvania: 'PA',
    'rhode island': 'RI',
    'south carolina': 'SC',
    'south dakota': 'SD',
    tennessee: 'TN',
    texas: 'TX',
    utah: 'UT',
    vermont: 'VT',
    virginia: 'VA',
    washington: 'WA',
    'west virginia': 'WV',
    wisconsin: 'WI',
    wyoming: 'WY',
    'district of columbia': 'DC',
    'washington dc': 'DC',
    'washington d.c.': 'DC',
  };

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Normalize address components to create a consistent matching key
   */
  normalizeAddress(components: AddressComponents): string | null {
    if (!components.street && !components.city && !components.state) {
      return null;
    }

    const normalized: string[] = [];

    // Normalize street
    if (components.street) {
      const street = this.normalizeStreet(components.street);
      if (street) {
        normalized.push(street);
      }
    }

    // Normalize city
    if (components.city) {
      const city = this.normalizeComponent(components.city);
      if (city) {
        normalized.push(city);
      }
    }

    // Normalize state
    if (components.state) {
      const state = this.normalizeState(components.state);
      if (state) {
        normalized.push(state);
      }
    }

    // Normalize country (default to USA if not provided)
    const country = components.country
      ? this.normalizeComponent(components.country)
      : 'USA';
    if (country) {
      normalized.push(country);
    }

    return normalized.length > 0 ? normalized.join(', ') : null;
  }

  /**
   * Normalize street address, handling abbreviations
   */
  private normalizeStreet(street: string): string {
    let normalized = this.normalizeComponent(street);

    // Replace street type abbreviations
    for (const [abbrev, full] of Object.entries(this.streetTypeMap)) {
      // Match whole word (case insensitive)
      const regex = new RegExp(`\\b${abbrev}\\b`, 'gi');
      normalized = normalized.replace(regex, full);
    }

    return normalized;
  }

  /**
   * Normalize state name or abbreviation
   */
  private normalizeState(state: string): string {
    const normalized = this.normalizeComponent(state);

    // If it's already a 2-letter abbreviation, return uppercase
    if (normalized.length === 2) {
      return normalized;
    }

    // Try to find in state map
    const stateKey = normalized.toLowerCase();
    if (this.stateMap[stateKey]) {
      return this.stateMap[stateKey];
    }

    // Return as-is if not found (might be a valid abbreviation we don't know)
    return normalized;
  }

  /**
   * Basic component normalization: uppercase, trim, remove extra spaces
   */
  private normalizeComponent(component: string): string {
    return component
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/[.,;]/g, '') // Remove common punctuation
      .trim();
  }

  /**
   * Find or create an asset by normalized address
   * Returns the assetId or null if address is invalid
   */
  async findOrCreateAsset(
    addressComponents: AddressComponents,
  ): Promise<string | null> {
    try {
      const normalizedAddress = this.normalizeAddress(addressComponents);

      if (!normalizedAddress) {
        this.logger.warn(
          `Cannot create asset: insufficient address information`,
        );
        return null;
      }

      // Try to find existing asset by normalized address
      // Use findFirst since normalizedAddress is nullable unique
      const existingAsset = await this.prismaService.asset.findFirst({
        where: { normalizedAddress },
        select: { id: true },
      });

      if (existingAsset) {
        this.logger.log(
          `Found existing asset ${existingAsset.id} for normalized address: ${normalizedAddress}`,
        );
        return existingAsset.id;
      }

      // Create new asset
      const newAsset = await this.prismaService.asset.create({
        data: {
          address: addressComponents.street || null,
          city: addressComponents.city || null,
          state: addressComponents.state || null,
          country: addressComponents.country || 'USA',
          normalizedAddress,
        },
        select: { id: true },
      });

      this.logger.log(
        `Created new asset ${newAsset.id} for normalized address: ${normalizedAddress}`,
      );

      return newAsset.id;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to find or create asset: ${errorMessage}`,
      );
      // Don't throw - return null so deal processing can continue
      return null;
    }
  }
}
