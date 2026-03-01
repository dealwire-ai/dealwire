import { resolveFeatureFlags } from './feature-flags';

describe('resolveFeatureFlags', () => {
  it('should return all defaults when raw is null', () => {
    // Arrange / Act
    const flags = resolveFeatureFlags(null);

    // Assert
    expect(flags).toEqual({ parcels: false, underwriting: true });
  });

  it('should return all defaults when raw is undefined', () => {
    // Arrange / Act
    const flags = resolveFeatureFlags(undefined);

    // Assert
    expect(flags).toEqual({ parcels: false, underwriting: true });
  });

  it('should return all defaults when raw is empty object', () => {
    // Arrange / Act
    const flags = resolveFeatureFlags({});

    // Assert
    expect(flags).toEqual({ parcels: false, underwriting: true });
  });

  it('should override default when flag is set to true', () => {
    // Arrange / Act
    const flags = resolveFeatureFlags({ parcels: true });

    // Assert
    expect(flags.parcels).toBe(true);
  });

  it('should keep default when flag is explicitly false', () => {
    // Arrange / Act
    const flags = resolveFeatureFlags({ parcels: false });

    // Assert
    expect(flags.parcels).toBe(false);
  });

  it('should ignore unknown keys', () => {
    // Arrange / Act
    const flags = resolveFeatureFlags({ parcels: true, unknownFlag: true });

    // Assert
    expect(flags).toEqual({ parcels: true, underwriting: true });
    expect((flags as any).unknownFlag).toBeUndefined();
  });

  it('should ignore non-boolean values', () => {
    // Arrange / Act
    const flags = resolveFeatureFlags({ parcels: 'yes' });

    // Assert
    expect(flags.parcels).toBe(false); // Falls back to default
  });

  it('should handle array input gracefully', () => {
    // Arrange / Act
    const flags = resolveFeatureFlags([1, 2, 3]);

    // Assert
    expect(flags).toEqual({ parcels: false, underwriting: true });
  });

  it('should handle string input gracefully', () => {
    // Arrange / Act
    const flags = resolveFeatureFlags('not an object');

    // Assert
    expect(flags).toEqual({ parcels: false, underwriting: true });
  });
});
