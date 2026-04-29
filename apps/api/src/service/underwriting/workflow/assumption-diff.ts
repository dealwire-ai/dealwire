import { UserAssumptions } from './assumption-types';

export type AssumptionChangeKind = 'changed' | 'kept' | 'set' | 'cleared';

export interface AssumptionChange {
  key: keyof UserAssumptions;
  label: string;
  kind: AssumptionChangeKind;
  prior: number | null;
  next: number | null;
  display: string;
}

const LABELS: Record<keyof UserAssumptions, string> = {
  interestRate: 'Interest Rate',
  ltv: 'LTV',
  amortizationYears: 'Amortization',
  holdPeriodYears: 'Hold Period',
  exitCapRate: 'Exit Cap Rate',
  rentGrowth: 'Rent Growth',
  expenseGrowth: 'Expense Growth',
  renovationBudget: 'Renovation Budget',
  acquisitionCostsPct: 'Acquisition Costs',
  occupancy: 'Occupancy',
};

const PERCENT_KEYS = new Set<keyof UserAssumptions>([
  'interestRate',
  'ltv',
  'exitCapRate',
  'rentGrowth',
  'expenseGrowth',
  'acquisitionCostsPct',
  'occupancy',
]);

const YEAR_KEYS = new Set<keyof UserAssumptions>([
  'amortizationYears',
  'holdPeriodYears',
]);

const DOLLAR_KEYS = new Set<keyof UserAssumptions>(['renovationBudget']);

function formatValue(key: keyof UserAssumptions, value: number | null): string {
  if (value === null || value === undefined) return '—';
  if (PERCENT_KEYS.has(key)) return `${(value * 100).toFixed(2)}%`;
  if (YEAR_KEYS.has(key)) return `${value}y`;
  if (DOLLAR_KEYS.has(key)) {
    return `$${value.toLocaleString('en-US')}`;
  }
  return String(value);
}

export function diffAssumptions(
  prior: UserAssumptions | null,
  next: UserAssumptions,
): AssumptionChange[] {
  const out: AssumptionChange[] = [];
  for (const k of Object.keys(LABELS) as Array<keyof UserAssumptions>) {
    const p = prior?.[k] ?? null;
    const n = next[k] ?? null;
    let kind: AssumptionChangeKind;
    if (p === n) {
      // No change. Skip if both null; otherwise it's a kept value.
      if (p === null) continue;
      kind = 'kept';
    } else if (p === null && n !== null) {
      kind = 'set';
    } else if (p !== null && n === null) {
      kind = 'cleared';
    } else {
      kind = 'changed';
    }
    out.push({
      key: k,
      label: LABELS[k],
      kind,
      prior: p,
      next: n,
      display: formatValue(k, n),
    });
  }
  return out;
}

function changeBadge(kind: AssumptionChangeKind): string {
  const styles: Record<AssumptionChangeKind, { bg: string; text: string }> = {
    changed: { bg: '#2563eb', text: 'changed' },
    set: { bg: '#15803d', text: 'set' },
    cleared: { bg: '#6b7280', text: 'cleared' },
    kept: { bg: '#9ca3af', text: 'kept' },
  };
  const s = styles[kind];
  return `<span style="display:inline-block;margin-left:6px;padding:1px 7px;border-radius:9px;background:${s.bg};color:#fff;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;">${s.text}</span>`;
}

export function renderAppliedChangesHtml(changes: AssumptionChange[]): string {
  if (changes.length === 0) return '';
  const items = changes
    .map((c) => {
      const value =
        c.kind === 'changed'
          ? `${formatValue(c.key, c.prior)} → <strong>${c.display}</strong>`
          : c.kind === 'cleared'
            ? `<em>cleared (was ${formatValue(c.key, c.prior)})</em>`
            : `<strong>${c.display}</strong>`;
      return `<li style="margin-bottom:4px;">${c.label}: ${value}${changeBadge(c.kind)}</li>`;
    })
    .join('');
  return `
  <div style="background:#eff6ff;border-left:3px solid #2563eb;padding:12px 16px;margin:12px 0 18px;border-radius:4px;">
    <div style="font-size:13px;font-weight:600;color:#1e40af;margin-bottom:6px;">Applied assumptions</div>
    <ul style="margin:0;padding-left:18px;font-size:13px;color:#1f2937;">${items}</ul>
  </div>`;
}

export function renderAppliedChangesText(changes: AssumptionChange[]): string {
  if (changes.length === 0) return '';
  const lines = changes.map((c) => {
    const tag = `[${c.kind}]`;
    if (c.kind === 'changed') {
      return `- ${c.label}: ${formatValue(c.key, c.prior)} → ${c.display} ${tag}`;
    }
    if (c.kind === 'cleared') {
      return `- ${c.label}: cleared (was ${formatValue(c.key, c.prior)}) ${tag}`;
    }
    return `- ${c.label}: ${c.display} ${tag}`;
  });
  return `Applied assumptions:\n${lines.join('\n')}\n`;
}
