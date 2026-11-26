import importlib.util
import json
import tempfile
import unittest
from datetime import date
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "import-analytics.py"
SPEC = importlib.util.spec_from_file_location("arcade_analytics_import", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


class AnalyticsImportTests(unittest.TestCase):
    def test_periods_compare_equal_windows(self):
        periods = MODULE.AnalyticsImporter.periods(date(2026, 10, 6), 28)
        self.assertEqual(periods["current"]["start"], date(2026, 9, 9))
        self.assertEqual(periods["current"]["end"], date(2026, 10, 6))
        self.assertEqual(periods["previous"]["start"], date(2026, 8, 12))
        self.assertEqual(periods["previous"]["end"], date(2026, 9, 8))

    def test_ga4_rows_are_normalized_with_period(self):
        response = {
            "dimensionHeaders": [{"name": "eventName"}],
            "metricHeaders": [{"name": "eventCount"}],
            "rows": [{
                "dimensionValues": [{"value": "game_play"}],
                "metricValues": [{"value": "12"}],
            }],
        }
        rows = MODULE.AnalyticsImporter.normalize_ga4(response, "current")
        self.assertEqual(rows, [{
            "period": "current",
            "eventName": "game_play",
            "eventCount": "12",
        }])

    def test_summary_includes_arcade_specific_sections_and_comparison(self):
        periods = MODULE.AnalyticsImporter.periods(date(2026, 10, 6), 7)
        datasets = {
            "ga4_overview": [
                {"period": "current", "activeUsers": "20", "sessions": "30"},
                {"period": "previous", "activeUsers": "10", "sessions": "20"},
            ],
            "ga4_pages": [
                {
                    "period": "current",
                    "pagePathPlusQueryString": "/games/galaga.html",
                    "pageTitle": "Galaga",
                    "screenPageViews": "9",
                    "activeUsers": "6",
                    "userEngagementDuration": "180",
                    "eventCount": "25",
                    "keyEvents": "0",
                },
                {
                    "period": "current",
                    "pagePathPlusQueryString": "/blog/galaga-beginner-guide.html",
                    "pageTitle": "Galaga guide",
                    "screenPageViews": "7",
                    "activeUsers": "5",
                    "userEngagementDuration": "240",
                    "eventCount": "20",
                    "keyEvents": "0",
                },
            ],
            "ga4_events": [
                {"period": "current", "eventName": "game_play", "eventCount": "4"}
            ],
        }
        summary = MODULE.AnalyticsImporter.build_summary(datasets, periods)
        self.assertIn("activeUsers: 20 (+100.0%)", summary)
        self.assertIn("## Game pages", summary)
        self.assertIn("## Editorial", summary)
        self.assertIn("game_play", summary)

    def test_data_quality_flags_automatic_unengaged_traffic(self):
        datasets = {
            "ga4_overview": [{
                "period": "current",
                "activeUsers": "100",
                "newUsers": "99",
                "sessions": "100",
                "engagedSessions": "0",
            }],
            "ga4_pages": [{"period": "current", "screenPageViews": "80"}],
            "ga4_acquisition": [{
                "period": "current",
                "sessionDefaultChannelGroup": "Direct",
                "sessions": "98",
            }],
            "ga4_audience": [{
                "period": "current",
                "country": "Singapore",
                "sessions": "80",
            }],
            "ga4_events": [{
                "period": "current",
                "eventName": "page_view",
                "eventCount": "80",
            }],
        }
        notes = "\n".join(MODULE.AnalyticsImporter.data_quality_notes(datasets))
        self.assertIn("zero engaged sessions", notes)
        self.assertIn("Direct traffic represents 98.0%", notes)
        self.assertIn("Singapore accounts for 80.0%", notes)
        self.assertIn("No Arcade World product events", notes)

    def test_datasets_write_json_and_csv(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            rows = [{"period": "current", "eventName": "game_play", "eventCount": "3"}]
            MODULE.AnalyticsImporter.write_dataset(output, "ga4_events", rows)
            self.assertEqual(
                json.loads((output / "ga4_events.json").read_text(encoding="utf-8")),
                rows,
            )
            self.assertIn("game_play", (output / "ga4_events.csv").read_text(encoding="utf-8-sig"))

    def test_invalid_day_range_fails_before_authentication(self):
        with self.assertRaisesRegex(MODULE.AnalyticsImportError, "between 1 and 366"):
            MODULE.run(["--days", "0", "--skip-search-console", "--ga4-property-id", "123"])


if __name__ == "__main__":
    unittest.main()
