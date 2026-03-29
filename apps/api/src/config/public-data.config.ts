export const publicDataConfig = () => ({
  refreshCron: process.env.PUBLIC_DATA_REFRESH_CRON || '0 3 * * 0', // Sunday 3am UTC
  autoRefreshEnabled: process.env.PUBLIC_DATA_AUTO_REFRESH_ENABLED === 'true',
});
