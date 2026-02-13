/**
 * Extract only the new content from an email reply body, stripping quoted previous messages.
 * When users reply, clients typically include the full thread; we only want what they wrote this time.
 */
export function extractNewReplyContent(body: string): string {
  if (!body || !body.trim()) return '';

  const lines = body.split(/\r?\n/);
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // -----Original Message----- (Outlook)
    if (/^[-]{3,}\s*Original Message\s*[-]{3,}/i.test(line)) break;

    // On ... wrote: (Gmail, Apple Mail, Outlook web)
    // e.g. "On Mon, Feb 10, 2025 at 10:00 AM John <john@x.com> wrote:" or "> On ... wrote:"
    const trimmed = line.trim();
    if (/^>?\s*On\s+.+wrote\s*:\s*$/i.test(trimmed)) break;

    // From: ... Sent: ... To: (Outlook header block - typically 2-4 lines)
    if (/^From:\s+/i.test(line) && i > 0) {
      // Only treat as quote start if we've already collected some content (avoid false positive on "From: X" in body)
      const prevContent = result.join('\n').trim();
      if (prevContent.length > 20) break;
    }

    // ________________________________ (Outlook 32-underscore separator)
    if (/^_{20,}\s*$/.test(line)) break;

    result.push(line);
  }

  return result.join('\n').replace(/\s+/g, ' ').trim();
}
