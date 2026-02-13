Review and improve UX writing in the codebase. Apply these principles:

## Button Labels
Never use "OK", "Submit", or "Yes/No". Use specific verb + object patterns (e.g., "Save changes", "Create account", "Delete message"). For destructive actions, name the destruction ("Delete 5 items" not "Delete selected").

## Error Messages
Every error message must answer: (1) What happened? (2) Why? (3) How to fix it? Never blame the user.

| Situation | Template |
|-----------|----------|
| Format error | "[Field] needs to be [format]. Example: [example]" |
| Missing required | "Please enter [what's missing]" |
| Permission denied | "You don't have access to [thing]. [What to do instead]" |
| Network error | "We couldn't reach [thing]. Check your connection and [action]." |
| Server error | "Something went wrong on our end. We're looking into it. [Alternative action]" |

## Empty States
Empty states are onboarding moments: (1) Acknowledge briefly, (2) Explain the value, (3) Provide a clear action.

## Tone
Voice is consistent, tone adapts: celebratory for success, empathetic for errors, reassuring for loading, serious for destructive confirms. Never use humor for errors.

## Consistency
Pick one term and stick with it (Delete not Remove/Trash, Settings not Preferences/Options, Sign in not Log in).

## Loading States
Be specific: "Saving your draft..." not "Loading...". For long waits, set expectations.

## Confirmation Dialogs
Use sparingly (prefer undo). When needed: name the action, explain consequences, use specific button labels.

## Accessibility
Link text must have standalone meaning. Alt text describes information, not the image. Icon buttons need `aria-label`.
