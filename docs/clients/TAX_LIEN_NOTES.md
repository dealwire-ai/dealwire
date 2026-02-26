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

## Related Project Docs

- **Public Data Platform** (`docs/product/PUBLIC_DATA_PLATFORM.md`) — Full architecture for ingesting tax lien data from NYC SODA API and other sources
- **ROADMAP.md** (`docs/product/ROADMAP.md`) — Tax lien features in the data enrichment phase
- Key NYC datasets: Tax Lien Sale Lists (`9rz4-mjek`), Property Charges Balance (`scjx-j6np`)
