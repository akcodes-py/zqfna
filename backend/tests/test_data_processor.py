"""
tests/test_data_processor.py
-----------------------------
Pytest tests for the core data pipeline logic.

Focus areas:
1. Anti-leakage: only pre-cutoff forecasts are selected
2. Correct startTime matching between actuals and forecasts
3. Accurate metric computation (MAE, RMSE, bias)
4. Edge cases: empty data, no matching forecasts
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from datetime import datetime, timezone, timedelta
import pandas as pd
import numpy as np

from data_processor import (
    build_matched_dataset,
    compute_accuracy_metrics,
    compute_daily_metrics,
    compute_hourly_metrics,
)


def dt(s: str) -> datetime:
    """Helper: parse UTC datetime string."""
    return datetime.fromisoformat(s.replace("Z", "+00:00")).replace(tzinfo=timezone.utc)


# ── Fixtures ────────────────────────────────────────────────────────────────────

def make_actual(start: str, gen: float) -> dict:
    return {"start_time": dt(start), "generation": gen}


def make_forecast(start: str, publish: str, gen: float) -> dict:
    return {"start_time": dt(start), "publish_time": dt(publish), "generation": gen}


# ── Test: Anti-leakage (forecast selection) ─────────────────────────────────────


class TestForecastSelection:
    """
    CRITICAL: The matched dataset must never include a forecast published
    AFTER the decision cutoff (midnight of the delivery day).
    """

    def test_only_pre_cutoff_forecast_selected(self):
        """
        Delivery: 2026-01-02T00:00Z
        Cutoff:   2026-01-01T23:59:59Z  (end of D-1)
        
        Forecasts published:
          - 2026-01-01T10:00Z  → gen=1000  ← should be selected (latest pre-cutoff)
          - 2026-01-01T22:30Z  → gen=1100  ← should be selected (latest pre-cutoff)
          - 2026-01-02T00:30Z  → gen=1200  ← MUST NOT be selected (post-cutoff leakage)
        """
        actuals = [make_actual("2026-01-02T00:00:00Z", 950.0)]
        forecasts = [
            make_forecast("2026-01-02T00:00:00Z", "2026-01-01T10:00:00Z", 1000.0),
            make_forecast("2026-01-02T00:00:00Z", "2026-01-01T22:30:00Z", 1100.0),
            make_forecast("2026-01-02T00:00:00Z", "2026-01-02T00:30:00Z", 1200.0),  # post-cutoff
        ]
        df = build_matched_dataset(actuals, forecasts)
        assert len(df) == 1
        # Should pick 1100, not 1200
        assert df.iloc[0]["forecast_mw"] == pytest.approx(1100.0)
        # Error = forecast - actual = 1100 - 950 = 150
        assert df.iloc[0]["error_mw"] == pytest.approx(150.0)

    def test_post_cutoff_only_returns_no_match(self):
        """If all forecasts are published after cutoff, no match should be returned."""
        actuals = [make_actual("2026-01-02T00:00:00Z", 800.0)]
        forecasts = [
            make_forecast("2026-01-02T00:00:00Z", "2026-01-02T01:00:00Z", 900.0),  # post-cutoff
            make_forecast("2026-01-02T00:00:00Z", "2026-01-02T02:00:00Z", 950.0),  # post-cutoff
        ]
        df = build_matched_dataset(actuals, forecasts)
        assert df.empty

    def test_exact_cutoff_boundary_excluded(self):
        """
        Cutoff is STRICTLY before midnight (< not <=).
        A forecast published exactly at midnight should NOT be used.
        """
        actuals = [make_actual("2026-01-03T00:00:00Z", 700.0)]
        forecasts = [
            make_forecast("2026-01-03T00:00:00Z", "2026-01-02T23:58:00Z", 750.0),  # pre-cutoff ✓
            make_forecast("2026-01-03T00:00:00Z", "2026-01-03T00:00:00Z", 900.0),  # at midnight ✗
        ]
        df = build_matched_dataset(actuals, forecasts)
        assert len(df) == 1
        assert df.iloc[0]["forecast_mw"] == pytest.approx(750.0)

    def test_multiple_delivery_intervals_same_day(self):
        """Multiple 30-min intervals in a day should each be matched independently."""
        actuals = [
            make_actual("2026-01-05T00:00:00Z", 500.0),
            make_actual("2026-01-05T00:30:00Z", 510.0),
            make_actual("2026-01-05T01:00:00Z", 520.0),
        ]
        forecasts = [
            make_forecast("2026-01-05T00:00:00Z", "2026-01-04T20:00:00Z", 490.0),
            make_forecast("2026-01-05T00:30:00Z", "2026-01-04T20:00:00Z", 505.0),
            make_forecast("2026-01-05T01:00:00Z", "2026-01-04T20:00:00Z", 515.0),
        ]
        df = build_matched_dataset(actuals, forecasts)
        assert len(df) == 3


# ── Test: Metric computation ────────────────────────────────────────────────────


class TestMetrics:
    def _make_matched_df(self, pairs: list[tuple[float, float]]) -> pd.DataFrame:
        """Create a minimal matched DataFrame from (actual, forecast) pairs."""
        from datetime import date
        rows = []
        for i, (actual, forecast) in enumerate(pairs):
            st = datetime(2026, 1, 2, i, 0, tzinfo=timezone.utc)
            rows.append(
                {
                    "start_time": st,
                    "delivery_date": date(2026, 1, 2),
                    "actual_mw": actual,
                    "forecast_mw": forecast,
                    "forecast_publish_time": datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc),
                    "error_mw": forecast - actual,
                    "abs_error_mw": abs(forecast - actual),
                }
            )
        return pd.DataFrame(rows)

    def test_mae_correct(self):
        df = self._make_matched_df([(1000, 1100), (800, 900), (1200, 1000)])
        # Errors: +100, +100, -200 → abs errors: 100, 100, 200 → MAE = 133.33
        metrics = compute_accuracy_metrics(df)
        assert metrics["mae_mw"] == pytest.approx(133.3, abs=0.1)

    def test_rmse_correct(self):
        df = self._make_matched_df([(1000, 1100), (800, 900), (1200, 1000)])
        # Errors: 100, 100, -200 → squared: 10000, 10000, 40000 → mean: 20000 → sqrt: 141.42
        metrics = compute_accuracy_metrics(df)
        assert metrics["rmse_mw"] == pytest.approx(141.4, abs=0.2)

    def test_bias_positive_over_forecast(self):
        """Positive bias = wind is systematically over-forecast."""
        df = self._make_matched_df([(800, 900), (700, 800)])
        metrics = compute_accuracy_metrics(df)
        assert metrics["bias_mw"] > 0

    def test_bias_negative_under_forecast(self):
        """Negative bias = wind is systematically under-forecast (riskier for buyers)."""
        df = self._make_matched_df([(800, 700), (700, 600)])
        metrics = compute_accuracy_metrics(df)
        assert metrics["bias_mw"] < 0

    def test_perfect_forecast_zero_error(self):
        df = self._make_matched_df([(1000, 1000), (800, 800), (500, 500)])
        metrics = compute_accuracy_metrics(df)
        assert metrics["mae_mw"] == pytest.approx(0.0)
        assert metrics["rmse_mw"] == pytest.approx(0.0)
        assert metrics["bias_mw"] == pytest.approx(0.0)

    def test_empty_returns_empty_dict(self):
        metrics = compute_accuracy_metrics(pd.DataFrame())
        assert metrics == {}

    def test_n_matched_count(self):
        df = self._make_matched_df([(1000, 1100)] * 10)
        metrics = compute_accuracy_metrics(df)
        assert metrics["n_matched"] == 10


# ── Test: Edge cases ────────────────────────────────────────────────────────────


class TestEdgeCases:
    def test_empty_actuals(self):
        df = build_matched_dataset([], [make_forecast("2026-01-02T00:00:00Z", "2026-01-01T12:00:00Z", 1000)])
        assert df.empty

    def test_empty_forecasts(self):
        df = build_matched_dataset([make_actual("2026-01-02T00:00:00Z", 1000)], [])
        assert df.empty

    def test_both_empty(self):
        df = build_matched_dataset([], [])
        assert df.empty

    def test_no_timestamp_overlap(self):
        """Actuals and forecasts for completely different delivery times."""
        actuals = [make_actual("2026-01-02T00:00:00Z", 1000.0)]
        forecasts = [make_forecast("2026-01-10T00:00:00Z", "2026-01-09T12:00:00Z", 1000.0)]
        df = build_matched_dataset(actuals, forecasts)
        assert df.empty

    def test_delivery_date_column_populated(self):
        actuals = [make_actual("2026-01-05T06:30:00Z", 800.0)]
        forecasts = [make_forecast("2026-01-05T06:30:00Z", "2026-01-04T10:00:00Z", 850.0)]
        df = build_matched_dataset(actuals, forecasts)
        assert not df.empty
        from datetime import date
        assert df.iloc[0]["delivery_date"] == date(2026, 1, 5)
