import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Phase 1 distress scoring — hardcoded weights.
 *
 * Score components (max 100):
 *   - Active lien:          +30 pts
 *   - Violations per unit:  +10 per viol/unit (capped at 40)
 *   - Class C violations:   +5 each (capped at 30)
 *
 * Updated 3/7: Removed Class B violations per Daniel's 3/4 feedback
 * ("A and B violations are not meaningful"). Increased Class C cap
 * from 20 to 30 to redistribute the freed weight.
 */
@Injectable()
export class DistressScoringService {
  private readonly logger = new Logger(DistressScoringService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compute distress score for a single parcel's data.
   */
  computeScore(parcel: {
    hasActiveLien: boolean;
    violationsPerUnit: number | null;
    violationsClassC: number;
  }): number {
    let score = 0;

    // Active lien: +30
    if (parcel.hasActiveLien) {
      score += 30;
    }

    // Violations per unit: +10 per viol/unit, capped at 40
    if (parcel.violationsPerUnit && parcel.violationsPerUnit > 0) {
      score += Math.min(Math.round(parcel.violationsPerUnit * 10), 40);
    }

    // Class C violations: +5 each, capped at 30
    if (parcel.violationsClassC > 0) {
      score += Math.min(parcel.violationsClassC * 5, 30);
    }

    return Math.min(score, 100);
  }

  /**
   * Batch-update all parcels with computed distress scores.
   */
  async scoreAll(): Promise<number> {
    const start = Date.now();
    this.logger.log('Computing distress scores for all parcels');

    const parcels = await this.prisma.parcel.findMany({
      select: {
        id: true,
        hasActiveLien: true,
        violationsPerUnit: true,
        violationsClassC: true,
      },
    });

    let updated = 0;
    for (const parcel of parcels) {
      const score = this.computeScore(parcel);
      await this.prisma.parcel.update({
        where: { id: parcel.id },
        data: { distressScore: score },
      });
      updated++;
    }

    const duration = Date.now() - start;
    this.logger.log(`Scored ${updated} parcels in ${duration}ms`);

    return updated;
  }
}
