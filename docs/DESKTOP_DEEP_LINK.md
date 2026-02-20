# Desktop Outlook Deep Link (`outlook:` protocol)

## What It Is

When a deal email is processed, we now fetch the MAPI **entry ID** (`PR_ENTRYID`, property tag `Binary 0x0FFF`) from Microsoft Graph and store it on the Deal record as `sourceEntryId`. This hex string powers an `outlook:<hex>` protocol link that opens the specific email directly in **classic Win32 Outlook** (the desktop app).

The digest email renders two links side-by-side:
- **View Email** — opens in Outlook Web (works everywhere, uses `sourceWebLink`)
- **Open in Desktop** — opens in desktop Outlook (uses `sourceEntryId` via `outlook:` protocol)

## How It Works

### Data Flow

1. **`MicrosoftGraphService.getMessage()`** — when called with `includeEntryId: true`, appends `$expand=singleValueExtendedProperties($filter=id eq 'Binary 0x0FFF')` to the Graph API request. Graph returns the MAPI `PR_ENTRYID` as a base64-encoded value.

2. **`MicrosoftGraphService.extractEntryId()`** — decodes the base64 value to an uppercase hex string (e.g., `0000000038A1BB1005E5101AA1BB08002B2A56C2...`).

3. **`EmailProcessorService.buildActionCard()`** — during deal processing, the `getMessage()` call now passes `includeEntryId: true`. The extracted entry ID is persisted on the Deal record alongside `sourceWebLink` in a fire-and-forget update:
   ```typescript
   data: {
     sourceWebLink: message.webLink,
     ...(entryId && { sourceEntryId: entryId }),
   }
   ```

4. **`DealDigestService.buildActionLinksForDigest()`** — reads `deal.sourceEntryId` and constructs the desktop link: `outlook:<entryId>`.

5. **`DealDigestService.renderDealActionLinks()`** — renders the "Open in Desktop" link after "View Email" when `desktopLink` is present.

### Schema

```prisma
model Deal {
  sourceWebLink  String?  // Outlook Web link (existing)
  sourceEntryId  String?  // MAPI entry ID (hex) for outlook: protocol deep link (new)
}
```

## Limitations

| Limitation | Impact |
|-----------|--------|
| **Existing deals** won't have `sourceEntryId` | Only "View Email" shows (graceful degradation) |
| **Classic Win32 Outlook only** | Mac/mobile/web users ignore the link and use "View Email" |
| **New Outlook (PWA)** doesn't support `outlook:` protocol | Those users use "View Email" |
| **Entry IDs are mailbox-specific** | Link only works for the user who received the email (same as `webLink`) |

## Key Files

| File | What changed |
|------|-------------|
| `apps/api/prisma/schema.prisma` | Added `sourceEntryId String?` to Deal model |
| `apps/api/src/service/microsoft/microsoft-graph.service.ts` | Added `includeEntryId` param to `getMessage()`, added `extractEntryId()` helper |
| `apps/api/src/service/email/email-processor.service.ts` | `buildActionCard()` fetches entry ID and persists it |
| `apps/api/src/service/deal/deal-digest.service.ts` | `DigestActionLinks.desktopLink`, rendering in digest |

## References

- [MAPI Property Tags](https://learn.microsoft.com/en-us/office/client-developer/outlook/mapi/mapi-property-tags) — `PR_ENTRYID` is `0x0FFF`
- [Graph Extended Properties](https://learn.microsoft.com/en-us/graph/api/resources/extended-properties-overview) — how to fetch MAPI properties via `singleValueExtendedProperties`
- [Outlook Protocol Handler](https://learn.microsoft.com/en-us/office/client-developer/outlook/mapi/handling-the-outlook-protocol) — `outlook:<entryid>` protocol
