import { DistressScoringService } from './distress-scoring.service';

describe('DistressScoringService', () => {
  let service: DistressScoringService;

  beforeEach(() => {
    // Create service with null prisma (we're testing computeScore which doesn't use it)
    service = new DistressScoringService(null as any);
  });

  describe('computeScore', () => {
    it('should return 0 for a parcel with no distress signals', () => {
      const parcel = {
        hasActiveLien: false,
        violationsPerUnit: null,
        violationsClassC: 0,
      };

      expect(service.computeScore(parcel)).toBe(0);
    });

    it('should add 30 points for an active lien', () => {
      const parcel = {
        hasActiveLien: true,
        violationsPerUnit: null,
        violationsClassC: 0,
      };

      expect(service.computeScore(parcel)).toBe(30);
    });

    it('should add 10 per violation per unit, capped at 40', () => {
      const parcel = {
        hasActiveLien: false,
        violationsPerUnit: 2,
        violationsClassC: 0,
      };

      expect(service.computeScore(parcel)).toBe(20);
    });

    it('should cap violations per unit at 40 points', () => {
      const parcel = {
        hasActiveLien: false,
        violationsPerUnit: 10,
        violationsClassC: 0,
      };

      expect(service.computeScore(parcel)).toBe(40);
    });

    it('should add 5 per class C violation, capped at 30', () => {
      const parcel = {
        hasActiveLien: false,
        violationsPerUnit: null,
        violationsClassC: 3,
      };

      expect(service.computeScore(parcel)).toBe(15);
    });

    it('should cap class C at 30 points', () => {
      const parcel = {
        hasActiveLien: false,
        violationsPerUnit: null,
        violationsClassC: 10,
      };

      expect(service.computeScore(parcel)).toBe(30);
    });

    it('should sum all components correctly', () => {
      // lien(30) + 2viol/unit(20) + 3classC(15) = 65
      const parcel = {
        hasActiveLien: true,
        violationsPerUnit: 2,
        violationsClassC: 3,
      };

      expect(service.computeScore(parcel)).toBe(65);
    });

    it('should cap total score at 100', () => {
      // all maxed: lien(30) + viol/unit(40) + classC(30) = 100
      const parcel = {
        hasActiveLien: true,
        violationsPerUnit: 10,
        violationsClassC: 10,
      };

      expect(service.computeScore(parcel)).toBe(100);
    });

    it('should handle zero violations per unit', () => {
      const parcel = {
        hasActiveLien: false,
        violationsPerUnit: 0,
        violationsClassC: 0,
      };

      expect(service.computeScore(parcel)).toBe(0);
    });
  });
});
