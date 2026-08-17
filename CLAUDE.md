# CLAUDE.md — app-store-legal working process

Static pages served for App Store Connect review: `index.html`, `privacy.html`,
`support.html`. No build step, no dependencies.

The full process doc lives in `squadgoo-mobile/CLAUDE.md`. The same severity
tiers apply here; this file records what they mean for this repo.

## Severity tiers here

- **Tier 1 (almost everything here)** — copy edits, links, contact details,
  markup/styling fixes. Change it, open the file and confirm the rendered result
  is right, commit. No app rebuild, no device install.
- **Tier 2** — anything that changes what is *legally asserted*: data-collection
  disclosures, retention, third-party processors, contact-of-record, or anything
  that must match the App Store Connect privacy questionnaire or the live API
  privacy URL. Verify against the mobile app's actual behaviour and the App
  Store Connect answers before committing; these pages are what Apple reviews.
- **Tier 3** — full pass over all three pages, only when explicitly asked.

## Also applies

- **Stay in scope.** Do not restyle or restructure confirmed pages that were not
  part of the task. Exception: a bug found in passing (broken link, wrong
  contact, unclosed tag, page that fails to render) gets fixed, not just noted —
  we are in a bug-fixing phase ahead of launch.
- **Keep this file lean.** One or two lines per change in the changelog below.
- **Finish the task** end-to-end; stop only for a genuine product/legal decision.

## Changelog

- 2026-08-17 — Added tiered process doc for this repo.
