import { SkipTraceService } from './skip-trace.service';

/**
 * Focused tests for the Skip Sherpa response handling. The provider returns a
 * non-2xx HTTP status (e.g. 404 "contact_info_not_found") even when the body is
 * a valid per-property payload, so the service must route on each property's own
 * status_code rather than the top-level HTTP status.
 */

interface ParcelInput {
  bbl: string;
  address: string | null;
  zipCode: string | null;
  borough: string;
  ownerName: string | null;
}

/** Private methods exercised directly in these tests. */
interface SkipTraceInternals {
  skipSherpaLookupBatch(parcels: ParcelInput[]): Promise<void>;
  skipSherpaFallback(bbls: string[]): Promise<void>;
}

interface UpdateManyArg {
  where: { bbl?: string | { in?: string[] }; skipTraceStatus?: string };
  data: {
    skipTraceStatus?: string;
    skipTraceQueueId?: string | null;
    ownerPhones?: Array<{ number: string; source?: string }>;
  };
}

describe('SkipTraceService — Skip Sherpa response handling', () => {
  let service: SkipTraceService;
  let prisma: { parcel: { updateMany: jest.Mock; findMany: jest.Mock } };

  const parcel: ParcelInput = {
    bbl: '4001230045',
    address: '506 FAIRVIEW AVENUE',
    zipCode: null,
    borough: '4',
    ownerName: null,
  };

  const internals = () => service as unknown as SkipTraceInternals;

  const updateArgs = (): UpdateManyArg[] =>
    (prisma.parcel.updateMany.mock.calls as Array<[UpdateManyArg]>).map(
      (c) => c[0],
    );

  const statusUpdatesFor = (bbl: string): string[] =>
    updateArgs()
      .filter((a) => {
        const w = a.where.bbl;
        return typeof w === 'string'
          ? w === bbl
          : (w?.in?.includes(bbl) ?? false);
      })
      .map((a) => a.data.skipTraceStatus)
      .filter((s): s is string => Boolean(s));

  beforeEach(() => {
    process.env.SKIPSHERPA_API_KEY = 'test-key';
    prisma = {
      parcel: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    service = new SkipTraceService(prisma as unknown as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function mockFetch(status: number, body: string) {
    global.fetch = jest.fn().mockResolvedValue({
      status,
      ok: status >= 200 && status < 300,
      text: () => Promise.resolve(body),
    }) as unknown as typeof fetch;
  }

  it('treats a 404 "contact_info_not_found" with a valid body as not_found, not error', async () => {
    mockFetch(
      404,
      JSON.stringify({
        property_results: [
          {
            status_code: 404,
            issues: [{ code_str: 'contact_info_not_found' }],
            property: null,
          },
        ],
      }),
    );

    await internals().skipSherpaLookupBatch([parcel]);

    const updates = statusUpdatesFor(parcel.bbl);
    expect(updates).toContain('not_found');
    expect(updates).not.toContain('error');
  });

  it('marks rows as error (not not_found) when the body has no property_results', async () => {
    mockFetch(401, JSON.stringify({ error: 'invalid api key' }));

    await internals().skipSherpaLookupBatch([parcel]);

    const updates = statusUpdatesFor(parcel.bbl);
    expect(updates).toContain('error');
    expect(updates).not.toContain('not_found');
  });

  it('marks rows as error when the response body is not JSON', async () => {
    mockFetch(500, '<html>Internal Server Error</html>');

    await internals().skipSherpaLookupBatch([parcel]);

    expect(statusUpdatesFor(parcel.bbl)).toContain('error');
  });

  it('parses contacts from a 200 result and marks the row found', async () => {
    mockFetch(
      200,
      JSON.stringify({
        property_results: [
          {
            status_code: 200,
            property: {
              owners: [
                {
                  person: {
                    name: 'Jane Doe',
                    phone_numbers: [
                      { local_format: '(718) 555-1234', type: 'mobile' },
                    ],
                  },
                },
              ],
            },
          },
        ],
      }),
    );

    await internals().skipSherpaLookupBatch([parcel]);

    const found = updateArgs().find((a) => a.data.skipTraceStatus === 'found');
    expect(found).toBeDefined();
    expect(found?.data.ownerPhones).toEqual([
      expect.objectContaining({
        number: '(718) 555-1234',
        source: 'skipsherpa',
      }),
    ]);
  });

  it('resets orphaned pending rows to error when the fallback throws', async () => {
    prisma.parcel.findMany.mockRejectedValue(new Error('db connection lost'));

    await internals().skipSherpaFallback([parcel.bbl]);

    const errored = updateArgs().find(
      (a) => a.data.skipTraceStatus === 'error',
    );
    expect(errored).toBeDefined();
    expect(errored?.where).toEqual(
      expect.objectContaining({ skipTraceStatus: 'pending' }),
    );
  });
});
