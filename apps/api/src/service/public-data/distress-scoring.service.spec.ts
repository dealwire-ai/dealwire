import { DistressScoringService } from './distress-scoring.service';

describe('DistressScoringService', () => {
  let service: DistressScoringService;

  beforeEach(() => {
    // Create service with null prisma (we're testing computeScore which doesn't use it)
    service = new DistressScoringService(null as any);
  });

  describe('computeScore', () => {
    it('should return 0 for a parcel with no distress signals', () => {
      // Arrange
      const parcel = {
        hasActiveLien: false,
        violationsPerUnit: null,
        violationsClassC: 0,
        violationsClassB: 0,
      };

      // Act
      const score = service.computeScore(parcel);

      // Assert
      expect(score).toBe(0);
    });

    it('should add 30 points for an active lien', () => {
      // Arrange
      const parcel = {
        hasActiveLien: true,
        violationsPerUnit: null,
        violationsClassC: 0,
        violationsClassB: 0,
      };

      // Act
      const score = service.computeScore(parcel);

      // Assert
      expect(score).toBe(30);
    });

    it('should add 10 per violation per unit, capped at 40', () => {
      // Arrange — 2 violations/unit = +20
      const parcel = {
        hasActiveLien: false,
        violationsPerUnit: 2,
        violationsClassC: 0,
        violationsClassB: 0,
      };

      // Act
      const score = service.computeScore(parcel);

      // Assert
      expect(score).toBe(20);
    });

    it('should cap violations per unit at 40 points', () => {
      // Arrange — 10 violations/unit = 100 uncapped, should be 40
      const parcel = {
        hasActiveLien: false,
        violationsPerUnit: 10,
        violationsClassC: 0,
        violationsClassB: 0,
      };

      // Act
      const score = service.computeScore(parcel);

      // Assert
      expect(score).toBe(40);
    });

    it('should add 5 per class C violation, capped at 20', () => {
      // Arrange — 3 class C = +15
      const parcel = {
        hasActiveLien: false,
        violationsPerUnit: null,
        violationsClassC: 3,
        violationsClassB: 0,
      };

      // Act
      const score = service.computeScore(parcel);

      // Assert
      expect(score).toBe(15);
    });

    it('should cap class C at 20 points', () => {
      // Arrange — 10 class C = 50 uncapped, should be 20
      const parcel = {
        hasActiveLien: false,
        violationsPerUnit: null,
        violationsClassC: 10,
        violationsClassB: 0,
      };

      // Act
      const score = service.computeScore(parcel);

      // Assert
      expect(score).toBe(20);
    });

    it('should add 2 per class B violation, capped at 10', () => {
      // Arrange — 3 class B = +6
      const parcel = {
        hasActiveLien: false,
        violationsPerUnit: null,
        violationsClassC: 0,
        violationsClassB: 3,
      };

      // Act
      const score = service.computeScore(parcel);

      // Assert
      expect(score).toBe(6);
    });

    it('should cap class B at 10 points', () => {
      // Arrange — 20 class B = 40 uncapped, should be 10
      const parcel = {
        hasActiveLien: false,
        violationsPerUnit: null,
        violationsClassC: 0,
        violationsClassB: 20,
      };

      // Act
      const score = service.computeScore(parcel);

      // Assert
      expect(score).toBe(10);
    });

    it('should sum all components correctly', () => {
      // Arrange — lien(30) + 2viol/unit(20) + 3classC(15) + 3classB(6) = 71
      const parcel = {
        hasActiveLien: true,
        violationsPerUnit: 2,
        violationsClassC: 3,
        violationsClassB: 3,
      };

      // Act
      const score = service.computeScore(parcel);

      // Assert
      expect(score).toBe(71);
    });

    it('should cap total score at 100', () => {
      // Arrange — all maxed: lien(30) + viol/unit(40) + classC(20) + classB(10) = 100
      const parcel = {
        hasActiveLien: true,
        violationsPerUnit: 10,
        violationsClassC: 10,
        violationsClassB: 20,
      };

      // Act
      const score = service.computeScore(parcel);

      // Assert
      expect(score).toBe(100);
    });

    it('should handle zero violations per unit', () => {
      // Arrange
      const parcel = {
        hasActiveLien: false,
        violationsPerUnit: 0,
        violationsClassC: 0,
        violationsClassB: 0,
      };

      // Act
      const score = service.computeScore(parcel);

      // Assert
      expect(score).toBe(0);
    });
  });
});
