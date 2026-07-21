# Manual steps pending (for the human)

Running list of things only you can do, accumulated while working through the backlog
autonomously. Nothing here blocks progress — each item is noted and work continues.

<!-- Entries appended below as they come up. -->

## Visual/manual QA spot-check needed

Supabase's default mailer hit its project-wide rate limit (2 emails/hour) during
earlier testing, so live browser QA (sign in via magic link → click through the UI)
couldn't be done for every feature built afterward. Each was still verified via code
review (spec-compliance + adversarial quality review) and `npm run build`/`npm test`,
but you should eyeball these once you're back:

- [ ] `/quotes` — list page, status filter tabs, empty state, header nav links
  ("Angebote" / "Preisliste")

