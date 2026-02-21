import {
  normalizeBbl,
  parseBbl,
  estimateMarketValue,
  isCoopBuildingClass,
  BOROUGH_NUMERIC_TO_ABBR,
  BOROUGH_ABBR_TO_NUMERIC,
} from './nyc-utils';

describe('normalizeBbl', () => {
  it('should pad block and lot to correct widths', () => {
    // Arrange
    const borough = '3';
    const block = '123';
    const lot = '45';

    // Act
    const result = normalizeBbl(borough, block, lot);

    // Assert
    expect(result).toBe('3001230045');
    expect(result).toHaveLength(10);
  });

  it('should handle already-padded values', () => {
    // Arrange / Act
    const result = normalizeBbl('3', '00123', '0045');

    // Assert
    expect(result).toBe('3001230045');
  });

  it('should handle single-digit block and lot', () => {
    // Arrange / Act
    const result = normalizeBbl('1', '1', '1');

    // Assert
    expect(result).toBe('1000010001');
  });

  it('should trim whitespace', () => {
    // Arrange / Act
    const result = normalizeBbl(' 4 ', ' 567 ', ' 89 ');

    // Assert
    expect(result).toBe('4005670089');
  });
});

describe('parseBbl', () => {
  it('should split a 10-char BBL into components', () => {
    // Arrange
    const bbl = '3001230045';

    // Act
    const result = parseBbl(bbl);

    // Assert
    expect(result).toEqual({
      borough: '3',
      block: '00123',
      lot: '0045',
    });
  });
});

describe('estimateMarketValue', () => {
  it('should divide by 0.06 for tax class 1', () => {
    // Arrange
    const assessTotal = 60000;

    // Act
    const result = estimateMarketValue(assessTotal, '1');

    // Assert
    expect(result).toBe(1000000);
  });

  it('should divide by 0.45 for tax class 2', () => {
    // Arrange
    const assessTotal = 450000;

    // Act
    const result = estimateMarketValue(assessTotal, '2');

    // Assert
    expect(result).toBe(1000000);
  });

  it('should handle tax class 2a, 2b, 2c', () => {
    // Arrange / Act
    const result = estimateMarketValue(450000, '2a');

    // Assert
    expect(result).toBe(1000000);
  });

  it('should handle tax class 1a (starts with 1)', () => {
    // Arrange / Act
    const result = estimateMarketValue(60000, '1a');

    // Assert
    expect(result).toBe(1000000);
  });

  it('should divide by 0.45 for tax class 4', () => {
    // Arrange / Act
    const result = estimateMarketValue(900000, '4');

    // Assert
    expect(result).toBe(2000000);
  });

  it('should return null for null assessTotal', () => {
    // Arrange / Act / Assert
    expect(estimateMarketValue(null, '1')).toBeNull();
  });

  it('should return null for zero assessTotal', () => {
    expect(estimateMarketValue(0, '2')).toBeNull();
  });

  it('should return null for null taxClass', () => {
    expect(estimateMarketValue(100000, null)).toBeNull();
  });
});

describe('isCoopBuildingClass', () => {
  it('should return true for known coop classes', () => {
    // Arrange / Act / Assert
    expect(isCoopBuildingClass('D4')).toBe(true);
    expect(isCoopBuildingClass('C6')).toBe(true);
    expect(isCoopBuildingClass('R9')).toBe(true);
  });

  it('should be case-insensitive', () => {
    // Arrange / Act / Assert
    expect(isCoopBuildingClass('d4')).toBe(true);
    expect(isCoopBuildingClass('c6')).toBe(true);
  });

  it('should return false for non-coop classes', () => {
    // Arrange / Act / Assert
    expect(isCoopBuildingClass('A1')).toBe(false);
    expect(isCoopBuildingClass('D1')).toBe(false);
  });

  it('should return false for null/undefined', () => {
    expect(isCoopBuildingClass(null)).toBe(false);
    expect(isCoopBuildingClass(undefined)).toBe(false);
  });
});

describe('borough mappings', () => {
  it('should have consistent numeric-to-abbr and abbr-to-numeric', () => {
    // Assert
    for (const [numeric, abbr] of Object.entries(BOROUGH_NUMERIC_TO_ABBR)) {
      expect(BOROUGH_ABBR_TO_NUMERIC[abbr]).toBe(numeric);
    }
  });

  it('should map all 5 boroughs', () => {
    expect(Object.keys(BOROUGH_NUMERIC_TO_ABBR)).toHaveLength(5);
    expect(Object.keys(BOROUGH_ABBR_TO_NUMERIC)).toHaveLength(5);
  });
});
