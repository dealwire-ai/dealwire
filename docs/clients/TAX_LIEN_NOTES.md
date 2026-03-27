# Tax Lien Analyzer — Notes & Research

## Overview

Tax lien analysis is a key vertical for Analyzer — identifying distressed properties via public tax lien/delinquency data and surfacing acquisition opportunities.

## Where to Find Information

### Google Drive

Research, proposals, and planning docs live in this shared Drive folder:
https://drive.google.com/drive/folders/1CzNH0jYqpdi4GtP5XPu1z_1dVAq8G0ty

Use the `gdrive` CLI to access files:

```bash
# List files in the Tax Lien folder
gdrive files list --parent 1CzNH0jYqpdi4GtP5XPu1z_1dVAq8G0ty

# Export a Google Doc by file ID
gdrive files export <fileId> /tmp/tax-lien-doc.txt
```

## Meeting Transcripts

| Date | Link                                                                       | Notes                                                                                                                          |
| ---- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 2/4  | [Granola](https://notes.granola.ai/t/648f69bf-f9af-439c-9ff5-74ac5d8ff6fb) | Data demo                                                                                                                      |
| 2/12 | [Granola](https://notes.granola.ai/t/873b558a-84ce-4bd6-bd9f-5cb1fea9f91b) | Scope & lis pendens                                                                                                            |
| 3/4  | [Granola](https://notes.granola.ai/d/c7f8f518-3326-49ee-9ef0-ec825441e010) | Platform demo & feedback                                                                                                       |
| 3/18 | [Granola](https://notes.granola.ai/d/2abfddfa-4aa4-4907-b692-8de662169bd8) | Live testing & UX feedback. Platform transitioning to active use.                                                              |
| 3/25 | No transcript (transcription disabled)                                     | Weekly update. Shipped contact tracking + custom lists. Skip tracing provider discussion. ATTOM API outreach. Phase 2 payment. |

## Related Project Docs

- **Public Data Platform** (`docs/product/PUBLIC_DATA_PLATFORM.md`) — Full architecture for ingesting tax lien data from NYC SODA API and other sources
- **ROADMAP.md** (`docs/product/ROADMAP.md`) — Tax lien features in the data enrichment phase
- **TAX_LIEN_PLATFORM.md** (`docs/product/TAX_LIEN_PLATFORM.md`) — Full product & domain deep dive, meeting notes, priority stack
- Key NYC datasets: Tax Lien Sale Lists (`9rz4-mjek`), Property Charges Balance (`scjx-j6np`)
