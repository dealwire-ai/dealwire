/**
 * Org-level feature flags.
 *
 * Add new flags here with a default of `false`. The DB column stores only
 * overrides — anything missing falls back to the default. This means you
 * can add a new flag without a migration; just add it here and it's `false`
 * for everyone until you flip it in the DB.
 */
export interface FeatureFlags {
  parcels: boolean;
  underwriting: boolean;
}

const DEFAULTS: FeatureFlags = {
  parcels: false,
  underwriting: true,
};

/**
 * Merge raw JSON from the `Organization.featureFlags` column with defaults.
 * Unknown keys are ignored; missing keys get the default value.
 */
export function resolveFeatureFlags(raw: unknown): FeatureFlags {
  const flags = { ...DEFAULTS };

  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    for (const key of Object.keys(DEFAULTS) as (keyof FeatureFlags)[]) {
      if (typeof obj[key] === 'boolean') {
        flags[key] = obj[key] as boolean;
      }
    }
  }

  return flags;
}
