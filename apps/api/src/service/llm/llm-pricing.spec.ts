import { LLM_PRICING, priceUsd, __resetPricingWarnings } from './llm-pricing';

describe('llm-pricing', () => {
  beforeEach(() => {
    __resetPricingWarnings();
  });

  it('prices gpt-4.1 correctly for 1000-in / 500-out', () => {
    // $2.00/M input + $8.00/M output
    //  = (1000/1e6)*2 + (500/1e6)*8
    //  = 0.002 + 0.004
    //  = 0.006
    expect(priceUsd('gpt-4.1', 1000, 500)).toBeCloseTo(0.006, 6);
  });

  it('prices gpt-4.1-mini correctly for 1000-in / 500-out', () => {
    // $0.40/M + $1.60/M = 0.0004 + 0.0008 = 0.0012
    expect(priceUsd('gpt-4.1-mini', 1000, 500)).toBeCloseTo(0.0012, 6);
  });

  it('prices claude-sonnet-4-6 correctly for 1000-in / 500-out', () => {
    // $3/M + $15/M = 0.003 + 0.0075 = 0.0105
    expect(priceUsd('claude-sonnet-4-6', 1000, 500)).toBeCloseTo(0.0105, 6);
  });

  it('prices claude-haiku-4-5 correctly for 1000-in / 500-out', () => {
    // $1/M + $5/M = 0.001 + 0.0025 = 0.0035
    expect(priceUsd('claude-haiku-4-5-20251001', 1000, 500)).toBeCloseTo(
      0.0035,
      6,
    );
  });

  it('returns 0 for an unknown model and warns once', () => {
    const warnSpy = jest
      .spyOn(
        // Grab the Logger instance indirectly by spying on the prototype
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('@nestjs/common').Logger.prototype,
        'warn',
      )
      .mockImplementation(() => undefined);

    expect(priceUsd('totally-fake-model', 1000, 500)).toBe(0);
    expect(priceUsd('totally-fake-model', 9999, 9999)).toBe(0);

    // Warned exactly once despite two calls with the same unknown model
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('scales linearly with token counts', () => {
    const small = priceUsd('gpt-4.1', 100, 50);
    const large = priceUsd('gpt-4.1', 1000, 500);
    expect(large).toBeCloseTo(small * 10, 8);
  });

  it('LLM_PRICING covers every model slot used in model-config', () => {
    // Tripwire: if model-config.ts adds a new default, add a pricing entry.
    const expectedModels = [
      'gpt-4.1',
      'gpt-4.1-mini',
      'claude-sonnet-4-6',
      'claude-haiku-4-5-20251001',
    ];
    for (const m of expectedModels) {
      expect(LLM_PRICING[m]).toBeDefined();
    }
  });
});
