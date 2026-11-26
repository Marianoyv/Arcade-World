# Google Analytics 4

Arcade World uses the same first-party analytics boundary as Pi: trusted-surface collection, explicit consent mode, safe parameters, single page views and product-specific events.

## Configuration

`analytics-config.js` contains the GA4 Measurement ID, canonical production origin and allowed Firebase hosts. Web collection only occurs over HTTPS on an allowed host. The packaged Electron app is a second trusted surface when its preload bridge is present on `127.0.0.1`; its random loopback port is normalized to the canonical production URL and events carry `app_surface=desktop`. Ordinary localhost previews and file URLs do not contact Google.

To inspect the data layer locally without sending hits, open a page with `?analytics_debug=1`. The debug flag queues GA4 calls and enables `debug_mode`, but deliberately does not load `gtag.js` outside production.

## Privacy controls

Every measured page exposes **Analytics & privacy**. The visitor can choose:

- Full analytics: analytics storage is granted.
- Cookieless measurement: events continue with analytics storage denied.
- Measurement off: future analytics events stop.

The choice is stored for up to 180 days. Advertising storage, Google Signals and advertising personalization are always disabled. Turning storage off clears GA cookies without touching favorites, recent games or local-import history.

## Event model

The allowlist covers:

- Discovery: searches, empty results, categories, filters and rotations.
- Games: detail views, launches, favorites, desktop setup and local ROM metadata.
- Editorial: article views, reading depth, engaged time, related stories and source clicks.
- Experience: navigation, sections, buttons, forms, downloads, video and Web Vitals.
- PWA and library: install prompt, completed install and aggregate local-library counts.

URLs, email addresses and phone-like values are rejected. Outbound events keep only the destination domain; local ROM names and file contents are never sent.

Create GA4 custom dimensions for the event parameters you want in standard reports, especially `page_type`, `game_title`, `game_mode`, `article_slug`, `content_type`, `search_term`, `filter_name`, `link_domain`, `read_percent` and `milestone_seconds`.

`analytics-ga4-setup.json` is the administrative checklist. Read-only API checks verified property **Arcade World (`551179002`)** and two web streams on 2026-11-25. Production traffic is in stream `15487529013` / `G-WYM8XXKMED`, so that ID is retained for reporting continuity. Firebase also has a secondary linked stream, `15730673679` / `G-QPZFZ0239W`, which the deployed site does not use. Custom definitions, audiences and key events remain pending until the new product events appear in Realtime or DebugView.

## Verification

Run:

```powershell
npm run test:analytics
```

After deployment, use GA4 Realtime for normal traffic and DebugView for a production URL that includes `?analytics_debug=1`.

## Safe web release

Firebase Hosting serves only the generated `site-dist/` directory. Build it from the explicit public-file allowlist before release:

```powershell
npm run build:web
```

Use `npm run deploy:web` for a production release. That command rebuilds the isolated directory before invoking Firebase, so local analytics configuration, editorial documentation, desktop code, emulators and ROMs cannot be inherited from the working tree.

## Read-only data import

Arcade World can also pull GA4 and Search Console data into local, Git-ignored reports, following Pi's review workflow. Copy `analytics-local.example.json` to `analytics-local.json`, add the numeric GA4 property ID and optionally a read-only credential path. Never place credentials in a tracked file.

The importer requires Python plus `google-auth` and `requests`:

```powershell
python -m pip install -r scripts/requirements-analytics.txt
```

One comparison window:

```powershell
$env:GA4_PROPERTY_ID = '123456789'
$env:SEARCH_CONSOLE_SITE_URL = 'https://arcade-world.web.app/'
npm run analytics:import -- --days 28
```

Weekly 7-day and 28-day snapshots:

```powershell
npm run analytics:weekly
```

Exports are written below `analytics/raw/` or `analytics/weekly/` as JSON, CSV and `summary.md`. The summary compares equal current and previous periods and highlights game pages, editorial pages, landing pages, events and search queries. The entire `analytics/` directory, `credentials/` and `analytics-local.json` are excluded from Git, Firebase Hosting and the Electron package.
