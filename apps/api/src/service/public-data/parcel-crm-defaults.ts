// Default kanban columns seeded for new orgs the first time they touch the CRM.
// Existing orgs were seeded by the 20260425000000_add_parcel_crm_tables migration.
// Names mirror the migration backfill so behavior matches across both paths.
export const DEFAULT_PARCEL_DEAL_STAGES: ReadonlyArray<{
  name: string;
  color: string;
  order: number;
  isDefault: boolean;
  isTerminal: boolean;
}> = [
  {
    name: 'Watchlist',
    color: '#94a3b8',
    order: 0,
    isDefault: false,
    isTerminal: false,
  },
  {
    name: 'To Call',
    color: '#3b82f6',
    order: 1,
    isDefault: true,
    isTerminal: false,
  },
  {
    name: 'Attempted',
    color: '#a855f7',
    order: 2,
    isDefault: false,
    isTerminal: false,
  },
  {
    name: 'Contacted',
    color: '#06b6d4',
    order: 3,
    isDefault: false,
    isTerminal: false,
  },
  {
    name: 'Interested',
    color: '#22c55e',
    order: 4,
    isDefault: false,
    isTerminal: false,
  },
  {
    name: 'Negotiating',
    color: '#f59e0b',
    order: 5,
    isDefault: false,
    isTerminal: false,
  },
  {
    name: 'Won',
    color: '#16a34a',
    order: 6,
    isDefault: false,
    isTerminal: true,
  },
  {
    name: 'Not Interested',
    color: '#6b7280',
    order: 7,
    isDefault: false,
    isTerminal: true,
  },
];

export function userInitials(
  user:
    | { firstName: string | null; lastName: string | null }
    | null
    | undefined,
): string {
  if (!user) return '??';
  const initials = (user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '');
  return initials.toUpperCase() || '??';
}
