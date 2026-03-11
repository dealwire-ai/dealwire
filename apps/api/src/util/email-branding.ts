/**
 * Shared email branding constants used across email-template and deal-digest services.
 */

export const EMAIL_DEFAULTS = {
  companyName: 'Dealwire',
  brandColor: '#2A4A7C',
} as const;

export const DECISION_COLORS = {
  yes: {
    accent: '#16a34a',
    pillBg: '#dcfce7',
    pillText: '#166534',
    reason: '#15803d',
  },
  no: {
    accent: '#dc2626',
    pillBg: '#fee2e2',
    pillText: '#991b1b',
    reason: '#b91c1c',
  },
} as const;
