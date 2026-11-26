"""Import read-only GA4 and Search Console reports for local Arcade World analysis."""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from datetime import date, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import quote


SCOPES = (
    "https://www.googleapis.com/auth/analytics.readonly",
    "https://www.googleapis.com/auth/webmasters.readonly",
)

GA4_REPORTS = {
    "overview": {
        "dimensions": ["date"],
        "metrics": ["activeUsers", "newUsers", "sessions", "engagedSessions", "eventCount", "keyEvents"],
        "limit": 10000,
    },
    "acquisition": {
        "dimensions": ["sessionDefaultChannelGroup", "sessionSourceMedium", "sessionCampaignName"],
        "metrics": ["activeUsers", "sessions", "engagedSessions", "keyEvents"],
        "limit": 25000,
    },
    "landing_pages": {
        "dimensions": ["landingPagePlusQueryString", "sessionDefaultChannelGroup"],
        "metrics": ["activeUsers", "sessions", "engagedSessions", "keyEvents"],
        "limit": 25000,
    },
    "pages": {
        "dimensions": ["pagePathPlusQueryString", "pageTitle"],
        "metrics": ["screenPageViews", "activeUsers", "userEngagementDuration", "eventCount", "keyEvents"],
        "limit": 25000,
    },
    "events": {
        "dimensions": ["eventName"],
        "metrics": ["eventCount", "totalUsers", "keyEvents"],
        "limit": 10000,
    },
    "audience": {
        "dimensions": ["deviceCategory", "country"],
        "metrics": ["activeUsers", "sessions", "engagedSessions", "keyEvents"],
        "limit": 25000,
    },
}

SEARCH_CONSOLE_REPORTS = {
    "daily": ["date"],
    "queries": ["query"],
    "pages": ["page"],
    "query_pages": ["query", "page"],
    "devices": ["device"],
    "countries": ["country"],
}


class AnalyticsImportError(RuntimeError):
    """A user-facing analytics import failure."""


class AnalyticsImporter:
    def __init__(self, session: Any):
        self.session = session

    @staticmethod
    def periods(end_date: date, days: int) -> dict[str, dict[str, date]]:
        current_start = end_date - timedelta(days=days - 1)
        previous_end = current_start - timedelta(days=1)
        return {
            "current": {"start": current_start, "end": end_date},
            "previous": {"start": previous_end - timedelta(days=days - 1), "end": previous_end},
        }

    def fetch_ga4(
        self,
        property_id: str,
        report: dict[str, Any],
        period: dict[str, date],
    ) -> dict[str, Any]:
        payload = {
            "dateRanges": [{
                "startDate": period["start"].isoformat(),
                "endDate": period["end"].isoformat(),
            }],
            "dimensions": [{"name": name} for name in report["dimensions"]],
            "metrics": [{"name": name} for name in report["metrics"]],
            "limit": str(report["limit"]),
            "keepEmptyRows": False,
        }
        url = f"https://analyticsdata.googleapis.com/v1beta/properties/{property_id}:runReport"
        try:
            response = self.session.post(url, json=payload, timeout=60)
        except Exception as exc:
            raise AnalyticsImportError(
                f"GA4 request could not be completed: {type(exc).__name__}"
            ) from exc
        if not response.ok:
            raise AnalyticsImportError(
                f"GA4 request failed: {response.status_code} {response.text[:500]}"
            )
        return response.json()

    def fetch_search_console(
        self,
        site_url: str,
        dimensions: list[str],
        period: dict[str, date],
    ) -> dict[str, Any]:
        payload = {
            "startDate": period["start"].isoformat(),
            "endDate": period["end"].isoformat(),
            "dimensions": dimensions,
            "rowLimit": 25000,
            "dataState": "final",
        }
        encoded_site = quote(site_url, safe="")
        url = f"https://www.googleapis.com/webmasters/v3/sites/{encoded_site}/searchAnalytics/query"
        try:
            response = self.session.post(url, json=payload, timeout=60)
        except Exception as exc:
            raise AnalyticsImportError(
                f"Search Console request could not be completed: {type(exc).__name__}"
            ) from exc
        if not response.ok:
            raise AnalyticsImportError(
                f"Search Console request failed: {response.status_code} {response.text[:500]}"
            )
        return response.json()

    @staticmethod
    def normalize_ga4(response: dict[str, Any], period_name: str) -> list[dict[str, Any]]:
        dimensions = [item["name"] for item in response.get("dimensionHeaders", [])]
        metrics = [item["name"] for item in response.get("metricHeaders", [])]
        rows = []
        for row in response.get("rows", []):
            normalized = {"period": period_name}
            normalized.update({
                name: value.get("value", "")
                for name, value in zip(dimensions, row.get("dimensionValues", []))
            })
            normalized.update({
                name: value.get("value", "")
                for name, value in zip(metrics, row.get("metricValues", []))
            })
            rows.append(normalized)
        return rows

    @staticmethod
    def normalize_search_console(
        response: dict[str, Any],
        dimensions: list[str],
        period_name: str,
    ) -> list[dict[str, Any]]:
        rows = []
        for row in response.get("rows", []):
            normalized = {"period": period_name}
            normalized.update({
                name: value
                for name, value in zip(dimensions, row.get("keys", []))
            })
            for metric in ("clicks", "impressions", "ctr", "position"):
                normalized[metric] = row.get(metric, 0)
            rows.append(normalized)
        return rows

    @staticmethod
    def write_dataset(output_dir: Path, name: str, rows: list[dict[str, Any]]) -> None:
        (output_dir / f"{name}.json").write_text(
            json.dumps(rows, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        if not rows:
            (output_dir / f"{name}.csv").write_text("", encoding="utf-8")
            return
        fieldnames = list(dict.fromkeys(key for row in rows for key in row))
        with (output_dir / f"{name}.csv").open("w", encoding="utf-8-sig", newline="") as csv_file:
            writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

    @staticmethod
    def number(value: Any) -> float:
        try:
            return float(value or 0)
        except (TypeError, ValueError):
            return 0.0

    @classmethod
    def total(cls, rows: list[dict[str, Any]], metric: str, period: str) -> float:
        return sum(
            cls.number(row.get(metric))
            for row in rows
            if row.get("period") == period
        )

    @staticmethod
    def change(current: float, previous: float) -> str:
        if previous == 0:
            return "new" if current else "no change"
        return f"{((current - previous) / previous) * 100:+.1f}%"

    @classmethod
    def top_table(
        cls,
        rows: list[dict[str, Any]],
        dimension: str,
        metric: str,
        title: str,
        limit: int = 10,
    ) -> list[str]:
        current = [row for row in rows if row.get("period") == "current"]
        current.sort(key=lambda row: cls.number(row.get(metric)), reverse=True)
        if not current:
            return []
        lines = [f"## {title}", "", f"| {dimension} | {metric} |", "|---|---:|"]
        for row in current[:limit]:
            label = str(row.get(dimension, "(not set)")).replace("|", "\\|")
            lines.append(f"| {label} | {cls.number(row.get(metric)):,.0f} |")
        lines.append("")
        return lines

    @classmethod
    def content_summary(
        cls,
        rows: list[dict[str, Any]],
        prefix: str,
        title: str,
    ) -> list[str]:
        content_rows = [
            row
            for row in rows
            if str(row.get("pagePathPlusQueryString", "")).startswith(prefix)
        ]
        if not content_rows:
            return []
        lines = [f"## {title}", ""]
        for metric in ("screenPageViews", "activeUsers", "userEngagementDuration", "eventCount", "keyEvents"):
            current = cls.total(content_rows, metric, "current")
            previous = cls.total(content_rows, metric, "previous")
            lines.append(f"- {metric}: {current:,.0f} ({cls.change(current, previous)})")
        lines.append("")
        current_rows = [row for row in content_rows if row.get("period") == "current"]
        current_rows.sort(
            key=lambda row: (
                cls.number(row.get("screenPageViews")),
                cls.number(row.get("userEngagementDuration")),
            ),
            reverse=True,
        )
        if current_rows:
            lines.extend([
                f"### Top {title.lower()}",
                "",
                "| page | views | engagement seconds |",
                "|---|---:|---:|",
            ])
            for row in current_rows[:10]:
                label = str(
                    row.get("pageTitle")
                    or row.get("pagePathPlusQueryString")
                    or "(not set)"
                ).replace("|", "\\|")
                lines.append(
                    f"| {label} | {cls.number(row.get('screenPageViews')):,.0f} "
                    f"| {cls.number(row.get('userEngagementDuration')):,.0f} |"
                )
            lines.append("")
        return lines

    @classmethod
    def data_quality_notes(
        cls,
        datasets: dict[str, list[dict[str, Any]]],
    ) -> list[str]:
        notes = []
        overview = datasets.get("ga4_overview", [])
        sessions = cls.total(overview, "sessions", "current")
        active_users = cls.total(overview, "activeUsers", "current")
        new_users = cls.total(overview, "newUsers", "current")
        engaged_sessions = cls.total(overview, "engagedSessions", "current")
        page_views = cls.total(datasets.get("ga4_pages", []), "screenPageViews", "current")

        if sessions and engaged_sessions == 0:
            notes.append("GA4 reports zero engaged sessions; treat traffic growth as unverified until engagement recovers.")
        if sessions and page_views < sessions:
            notes.append(
                f"Page views ({page_views:,.0f}) are lower than sessions ({sessions:,.0f}), which can indicate partial measurement or low-quality automated traffic."
            )
        if active_users and new_users / active_users >= 0.95:
            notes.append(
                f"New users represent {new_users / active_users * 100:.1f}% of active users; retention cannot yet be inferred."
            )

        acquisition = [
            row for row in datasets.get("ga4_acquisition", [])
            if row.get("period") == "current"
        ]
        direct_sessions = sum(
            cls.number(row.get("sessions"))
            for row in acquisition
            if row.get("sessionDefaultChannelGroup") == "Direct"
        )
        if sessions and direct_sessions / sessions >= 0.9:
            notes.append(
                f"Direct traffic represents {direct_sessions / sessions * 100:.1f}% of sessions; acquisition attribution is not yet reliable."
            )

        audience = [
            row for row in datasets.get("ga4_audience", [])
            if row.get("period") == "current"
        ]
        country_sessions: dict[str, float] = {}
        for row in audience:
            country = str(row.get("country") or "(not set)")
            country_sessions[country] = country_sessions.get(country, 0) + cls.number(row.get("sessions"))
        if sessions and country_sessions:
            country, count = max(country_sessions.items(), key=lambda item: item[1])
            if count / sessions >= 0.6:
                notes.append(
                    f"{country} accounts for {count / sessions * 100:.1f}% of sessions; investigate bot, crawler or infrastructure traffic before targeting that market."
                )

        automatic_events = {
            "click",
            "file_download",
            "first_visit",
            "form_start",
            "form_submit",
            "page_view",
            "scroll",
            "session_start",
            "user_engagement",
            "video_complete",
            "video_progress",
            "video_start",
            "view_search_results",
        }
        current_events = {
            str(row.get("eventName") or "")
            for row in datasets.get("ga4_events", [])
            if row.get("period") == "current"
        }
        if current_events and not (current_events - automatic_events):
            notes.append("No Arcade World product events are present yet; deploy and validate the new event layer before evaluating feature usage.")

        not_set_landings = sum(
            cls.number(row.get("sessions"))
            for row in datasets.get("ga4_landing_pages", [])
            if row.get("period") == "current"
            and row.get("landingPagePlusQueryString") == "(not set)"
        )
        if sessions and not_set_landings / sessions >= 0.1:
            notes.append(
                f"Landing page is '(not set)' for {not_set_landings / sessions * 100:.1f}% of sessions."
            )

        if not notes:
            notes.append("No major measurement-quality warning was detected in this comparison window.")
        return ["## Data quality", "", *(f"- {note}" for note in notes), ""]

    @classmethod
    def build_summary(
        cls,
        datasets: dict[str, list[dict[str, Any]]],
        periods: dict[str, dict[str, date]],
    ) -> str:
        lines = [
            "# Arcade World analytics summary",
            "",
            f"Current: {periods['current']['start']} to {periods['current']['end']}",
            f"Previous: {periods['previous']['start']} to {periods['previous']['end']}",
            "",
        ]

        overview = datasets.get("ga4_overview", [])
        if overview:
            lines.extend(["## GA4 overview", ""])
            for metric in (
                "activeUsers",
                "newUsers",
                "sessions",
                "engagedSessions",
                "eventCount",
                "keyEvents",
            ):
                current = cls.total(overview, metric, "current")
                previous = cls.total(overview, metric, "previous")
                lines.append(f"- {metric}: {current:,.0f} ({cls.change(current, previous)})")
            lines.append("")

        search_daily = datasets.get("search_console_daily", [])
        if search_daily:
            current_clicks = cls.total(search_daily, "clicks", "current")
            previous_clicks = cls.total(search_daily, "clicks", "previous")
            current_impressions = cls.total(search_daily, "impressions", "current")
            previous_impressions = cls.total(search_daily, "impressions", "previous")
            lines.extend([
                "## Google Search",
                "",
                f"- clicks: {current_clicks:,.0f} ({cls.change(current_clicks, previous_clicks)})",
                f"- impressions: {current_impressions:,.0f} ({cls.change(current_impressions, previous_impressions)})",
                f"- CTR: {(current_clicks / current_impressions * 100) if current_impressions else 0:.2f}%",
                "",
            ])

        pages = datasets.get("ga4_pages", [])
        lines.extend(cls.content_summary(pages, "/games/", "Game pages"))
        lines.extend(cls.content_summary(pages, "/blog/", "Editorial"))
        lines.extend(cls.top_table(pages, "pageTitle", "screenPageViews", "Top pages"))
        lines.extend(cls.top_table(
            datasets.get("ga4_landing_pages", []),
            "landingPagePlusQueryString",
            "sessions",
            "Top landing pages",
        ))
        lines.extend(cls.top_table(
            datasets.get("ga4_events", []),
            "eventName",
            "eventCount",
            "Top events",
            limit=20,
        ))
        lines.extend(cls.top_table(
            datasets.get("search_console_queries", []),
            "query",
            "clicks",
            "Top search queries",
        ))
        lines.extend(cls.data_quality_notes(datasets))
        lines.extend([
            "## Interpretation notes",
            "",
            "- Compare changes with deploy dates and publication dates before changing strategy.",
            "- Treat game launches, favorites and engaged reading as interest signals, not revenue.",
            "- A missing Search Console section means that source was skipped or unavailable.",
            "- Validate new product events in Realtime or DebugView before using them as key events.",
            "",
        ])
        return "\n".join(lines)


def authorized_session() -> tuple[Any, str]:
    try:
        import google.auth
        from google.auth.exceptions import DefaultCredentialsError
        from google.auth.transport.requests import AuthorizedSession
    except ImportError as exc:
        raise AnalyticsImportError(
            "Install google-auth and requests before importing analytics."
        ) from exc

    try:
        credentials, project_id = google.auth.default(scopes=SCOPES)
    except DefaultCredentialsError as exc:
        raise AnalyticsImportError(
            "Google credentials were not found. Set GOOGLE_APPLICATION_CREDENTIALS to a read-only "
            "service-account JSON file or configure Application Default Credentials."
        ) from exc
    source = f"{type(credentials).__name__}:{project_id or 'no-project'}"
    return AuthorizedSession(credentials), source


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--days", type=int, default=28, help="Days in the current comparison period.")
    parser.add_argument("--end-date", help="Last date to import (YYYY-MM-DD, defaults to yesterday).")
    parser.add_argument("--output-dir", help="Override the local output directory.")
    parser.add_argument("--ga4-property-id", help="Numeric GA4 property ID (or use GA4_PROPERTY_ID).")
    parser.add_argument("--search-console-site", help="Search Console property (or use SEARCH_CONSOLE_SITE_URL).")
    parser.add_argument("--skip-ga4", action="store_true", help="Do not request GA4 data.")
    parser.add_argument("--skip-search-console", action="store_true", help="Do not request Search Console data.")
    return parser.parse_args(argv)


def run(argv: list[str] | None = None) -> Path:
    args = parse_args(argv)
    if args.days < 1 or args.days > 366:
        raise AnalyticsImportError("--days must be between 1 and 366.")
    try:
        end_date = date.fromisoformat(args.end_date) if args.end_date else date.today() - timedelta(days=1)
    except ValueError as exc:
        raise AnalyticsImportError("--end-date must use YYYY-MM-DD.") from exc

    property_id = (args.ga4_property_id or os.environ.get("GA4_PROPERTY_ID", "")).strip()
    search_console_site = (
        args.search_console_site
        or os.environ.get("SEARCH_CONSOLE_SITE_URL", "")
        or "https://arcade-world.web.app/"
    ).strip()
    use_ga4 = not args.skip_ga4
    use_search_console = not args.skip_search_console
    if use_ga4 and (not property_id or not property_id.isdigit()):
        raise AnalyticsImportError(
            "Set GA4_PROPERTY_ID to the numeric GA4 property ID, pass --ga4-property-id, or use --skip-ga4."
        )
    if use_search_console and not search_console_site:
        raise AnalyticsImportError(
            "Set SEARCH_CONSOLE_SITE_URL, pass --search-console-site, or use --skip-search-console."
        )
    if not use_ga4 and not use_search_console:
        raise AnalyticsImportError("At least one data source must be enabled.")

    periods = AnalyticsImporter.periods(end_date, args.days)
    session, credential_source = authorized_session()
    root = Path(__file__).resolve().parent.parent
    output_dir = Path(args.output_dir) if args.output_dir else root / "analytics" / "raw" / end_date.isoformat()
    output_dir.mkdir(parents=True, exist_ok=True)
    importer = AnalyticsImporter(session)
    datasets: dict[str, list[dict[str, Any]]] = {}

    if use_ga4:
        for report_name, report in GA4_REPORTS.items():
            rows = []
            for period_name, period in periods.items():
                rows.extend(AnalyticsImporter.normalize_ga4(
                    importer.fetch_ga4(property_id, report, period),
                    period_name,
                ))
            datasets[f"ga4_{report_name}"] = rows
            importer.write_dataset(output_dir, f"ga4_{report_name}", rows)
            print(f"GA4 {report_name}: {len(rows)} rows")

    if use_search_console:
        for report_name, dimensions in SEARCH_CONSOLE_REPORTS.items():
            rows = []
            for period_name, period in periods.items():
                rows.extend(AnalyticsImporter.normalize_search_console(
                    importer.fetch_search_console(search_console_site, dimensions, period),
                    dimensions,
                    period_name,
                ))
            datasets[f"search_console_{report_name}"] = rows
            importer.write_dataset(output_dir, f"search_console_{report_name}", rows)
            print(f"Search Console {report_name}: {len(rows)} rows")

    manifest = {
        "generated_at": date.today().isoformat(),
        "credential_source": credential_source,
        "periods": {
            name: {key: value.isoformat() for key, value in period.items()}
            for name, period in periods.items()
        },
        "ga4_property_id": property_id if use_ga4 else None,
        "search_console_site_url": search_console_site if use_search_console else None,
        "datasets": {name: len(rows) for name, rows in datasets.items()},
    }
    (output_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2),
        encoding="utf-8",
    )
    (output_dir / "summary.md").write_text(
        importer.build_summary(datasets, periods),
        encoding="utf-8",
    )
    print(f"Analytics import complete: {output_dir}")
    return output_dir


if __name__ == "__main__":
    try:
        run()
    except AnalyticsImportError as exc:
        print(f"Analytics import failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
