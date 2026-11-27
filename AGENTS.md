# Arcade World - agent instructions

Keep this file short. Open `OPERATIONS.md` for the exact workflow, `EDITORIAL_PLAYBOOK.md` for editorial decisions, and `ANALYTICS.md` for measurement. The site and articles are in English; communicate with the owner in concise Spanish unless asked otherwise.

## Source of truth

- Work in this checkout and on the single GitHub branch `Main` of `Marianoyv/Arcade-World`. Do not create another branch, worktree, backup repository, or GitHub deployment dependency. GitHub is public source storage; Firebase Hosting serves `site-dist/` from project `arcade-world`.
- Preserve unrelated local changes. A dirty working tree alone is not a reason to skip; identify actual overlapping changes or failed checks before stopping. Never reset, clean, overwrite, or commit someone else's changes.
- Keep credentials and raw analytics out of Git and Hosting. Do not expose `analytics-local.json`, `credentials/`, `analytics/`, or local secrets. Follow the existing visitor privacy choice; do not change it incidentally.
- Prefer official Google Analytics Data API and Search Console API through the local scripts. Do not silently substitute a third-party connector, browser export, stale snapshot, or invented numbers.

## Fast route

- Read the relevant section of `OPERATIONS.md`, then only the files needed for the current task. Reuse `analytics/weekly/latest-data.json` and `latest.md` when fresh; label data availability and dates separately.
- Sunday review: `npm run analytics:weekly`, compare 7 and 28 days and previous editorial hypotheses, write `analytics/weekly/latest.md`. No article, image, deploy, or Git operation.
- Tue/Thu/Sat publication: check capacity and the last Sunday report, revalidate one useful story from the preceding 48 hours, source it independently, create at most one article, and run the release gates in `OPERATIONS.md`. A sound skip is better than filler.
- For normal code changes, run focused checks. For a release: `npm run content:build`, `npm run test:launcher`, `npm run test:analytics` if tracking changed, `npm run build:web`, then deploy Hosting and check the live files. Do not report deployment without live confirmation.
- If the runtime cannot reach Google/Firebase or cannot read credentials, report the exact blocker and the smallest action needed; never claim a successful API read or deployment from an older local file.

## Reporting

State what changed, what was actually tested, where data came from and its freshness, what was deployed, and any blocker. Minimize repeated background and avoid broad searches when the route above answers the question.
