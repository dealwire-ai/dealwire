# PostHog post-wizard report

The wizard has completed a deep integration of your Next.js App Router project with PostHog analytics. The integration includes client-side tracking using `instrumentation-client.ts` (the recommended approach for Next.js 15.3+), server-side tracking for API routes, user identification with Clerk authentication, and a reverse proxy configuration to improve tracking reliability.

## Events Implemented

| Event Name | Description | File Path |
|------------|-------------|-----------|
| `cta_clicked` | User clicked a call-to-action button (Book Your Call, Let's Talk, Sign In) | `src/app/page.tsx` |
| `nav_section_clicked` | User clicked a navigation link to scroll to a section | `src/app/page.tsx` |
| `founder_linkedin_clicked` | User clicked a founder's or advisor's LinkedIn profile link | `src/app/page.tsx` |
| `founder_email_clicked` | User clicked a founder's email link | `src/app/page.tsx` |
| `booking_page_viewed` | User landed on the booking page | `src/app/book/page.tsx` |
| `sign_in_page_viewed` | User landed on the sign-in page | `src/app/sign-in/[[...sign-in]]/page.tsx` |
| `dashboard_tab_changed` | User switched between tabs on the dashboard | `src/app/dashboard/page.tsx` |
| `deal_row_expanded` | User expanded a deal row to view details | `src/app/dashboard/page.tsx` |
| `deal_navigate_to_property` | User navigated from a deal to view associated property | `src/app/dashboard/page.tsx` |
| `deal_navigate_to_contact` | User navigated from a deal to view associated contact | `src/app/dashboard/page.tsx` |
| `sign_out_clicked` | User clicked the sign out button | `src/app/dashboard/page.tsx` |
| `chat_opened` | User opened the AI chat assistant | `src/components/chat/chatbot.tsx` |
| `chat_closed` | User closed the AI chat assistant | `src/components/chat/chatbot.tsx` |
| `chat_message_sent` | User sent a message to the AI chat assistant | `src/components/chat/chatbot.tsx` |
| `chat_api_called` | Server-side: Chat API was called | `src/app/api/chat/route.ts` |

## Files Created/Modified

### New Files
- `instrumentation-client.ts` - Client-side PostHog initialization
- `src/lib/posthog-server.ts` - Server-side PostHog client

### Modified Files
- `.env` - Updated with PostHog API key and host
- `next.config.ts` - Added reverse proxy rewrites for PostHog
- `src/app/page.tsx` - Added landing page event tracking
- `src/app/book/page.tsx` - Added booking page view tracking
- `src/app/sign-in/[[...sign-in]]/page.tsx` - Added sign-in page view tracking
- `src/app/dashboard/page.tsx` - Added dashboard engagement and user identification
- `src/components/chat/chatbot.tsx` - Added chat interaction tracking
- `src/app/api/chat/route.ts` - Added server-side chat API tracking

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

### Dashboard
- [Analytics basics](https://us.posthog.com/project/141731/dashboard/1263003)

### Insights
- [Booking Conversion Funnel](https://us.posthog.com/project/141731/insights/hniRULep) - Tracks users from CTA click to booking page view
- [Landing Page CTAs & Booking Trends](https://us.posthog.com/project/141731/insights/55f12cXj) - Daily trend of CTA clicks and booking page views
- [Dashboard Engagement](https://us.posthog.com/project/141731/insights/huLFJ2pa) - Tab switching and deal exploration metrics
- [AI Chat Assistant Usage](https://us.posthog.com/project/141731/insights/osKEdaNH) - Chat opens and messages sent
- [Authentication Activity](https://us.posthog.com/project/141731/insights/NOOzCQvJ) - Sign-in views and sign-outs

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/posthog-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
