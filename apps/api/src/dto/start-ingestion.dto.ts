export interface StartIngestionDto {
  startDate?: string; // ISO date string
  endDate?: string; // ISO date string
  folderName?: string; // Default: 'Inbox'
}
