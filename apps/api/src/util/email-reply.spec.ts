import { extractNewReplyContent } from './email-reply';

describe('extractNewReplyContent', () => {
  it('returns only the new reply, stripping quoted content', () => {
    const body = `Who has sent me the most deals in NC?

On Tue, Feb 11, 2025 at 2:58 AM Isaac Levine <isaac@frontstep.ai> wrote:
> Update my screening preferences to skip anything in the state of north carolina

On Tue, Feb 11, 2025 at 2:55 AM Isaac Levine <isaac@frontstep.ai> wrote:
> Your screening preferences have been updated to skip anything in the state of North Carolina.`;

    expect(extractNewReplyContent(body)).toBe(
      'Who has sent me the most deals in NC?',
    );
  });

  it('strips -----Original Message----- (Outlook)', () => {
    const body = `Update my deal criteria to NYC only.

-----Original Message-----
From: Broker
Sent: Tuesday, February 11, 2025
To: user@example.com
Subject: RE: Deal`;

    expect(extractNewReplyContent(body)).toBe(
      'Update my deal criteria to NYC only.',
    );
  });

  it('returns full content when no quoted block', () => {
    const body = 'Just a simple message with no quote';
    expect(extractNewReplyContent(body)).toBe(
      'Just a simple message with no quote',
    );
  });

  it('handles empty or whitespace-only', () => {
    expect(extractNewReplyContent('')).toBe('');
    expect(extractNewReplyContent('   ')).toBe('');
  });

  it('extracts reply from HTML-only body after tag stripping', () => {
    // Simulates the listener's HTML→text fallback: strip tags, normalize newlines
    const html = `<div>Show me deals over 10M</div><br><div class="gmail_quote"><div>On Mon, Feb 10, 2025 at 3:00 PM Isaac Levine &lt;isaac@frontstep.ai&gt; wrote:</div><blockquote>Here is your daily deal digest...</blockquote></div>`;
    const asText = html
      .replace(/<\/p>|<\/div>|<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n\s*\n/g, '\n')
      .trim();

    expect(extractNewReplyContent(asText)).toBe('Show me deals over 10M');
  });
});
