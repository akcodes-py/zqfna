"""
data_processor.py
-----------------
Data pipeline: merges actuals + forecasts and computes accuracy metrics.

CRITICAL design principle — NO DATA LEAKAGE:
    For a delivery day D, the procurement team makes their day-ahead market
    purchase decision on day D-1. The UK day-ahead market gate closure is
    typically around 11:00–12:00 UK time (UTC+0 in winter).

    The "decision cutoff" for delivery day D is defined as:
        cutoff = midnight(D) - 1 second  →  i.e., 23:59:59 on day D-1

    We select, for each 30-min delivery interval on day D, only the LATEST
    forecast published STRICTLY BEFORE the cutoff time.

    This guarantees that we only use information available to the trader at
    decision time — no forecast published after the cutoff is ever used.
"""

import logging
from datetime import datetime, timezone, timedelta

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# UK Day-Ahead market gate closure: 11:00 UTC in winter (UTC+0, Jan = GMT)
# We conservatively use midnight of the delivery day as the cutoff so that
# only forecasts from D-1 are ever considered. In practice teams often use
# the last published forecast before 11:00 UTC on D-1. We expose both options.
DEFAULT_CUTOFF_HOUR_UTC = 23  # hour on D-1 at which the "decision" is made
DEFAULT_CUTOFF_MINUTE_UTC = 59


def _build_actuals_df(actuals: list[dict]) -> pd.DataFrame:
    if not actuals:
        return pd.DataFrame(columns=["start_time", "actual_mw"])
    df = pd.DataFrame(actuals)
    df = df.rename(columns={"generation": "actual_mw"})
    df["start_time"] = pd.to_datetime(df["start_time"], utc=True)
    df = df.drop_duplicates(subset=["start_time"], keep="last")
    df = df.sort_values("start_time").reset_index(drop=True)
    return df[["start_time", "actual_mw"]]


def _build_forecasts_df(forecasts: list[dict]) -> pd.DataFrame:
    if not forecasts:
        return pd.DataFrame(columns=["start_time", "publish_time", "forecast_mw"])
    df = pd.DataFrame(forecasts)
    df = df.rename(columns={"generation": "forecast_mw"})
    df["start_time"] = pd.to_datetime(df["start_time"], utc=True)
    df["publish_time"] = pd.to_datetime(df["publish_time"], utc=True)
    df = df.sort_values(["start_time", "publish_time"]).reset_index(drop=True)
    return df[["start_time", "publish_time", "forecast_mw"]]


def select_latest_forecast_before_cutoff(
    forecasts_df: pd.DataFrame,
    delivery_start_time: pd.Timestamp,
    decision_cutoff_utc: pd.Timestamp,
) -> float | None:
    """
    For a specific delivery interval, return the forecast_mw value from the
    latest forecast vintage published STRICTLY BEFORE the decision cutoff.

    This is the core anti-leakage logic.
    """
    candidates = forecasts_df[
        (forecasts_df["start_time"] == delivery_start_time)
        & (forecasts_df["publish_time"] < decision_cutoff_utc)
    ]
    if candidates.empty:
        return None
    # Latest published before cutoff
    latest_row = candidates.loc[candidates["publish_time"].idxmax()]
    return float(latest_row["forecast_mw"])


def build_matched_dataset(
    actuals: list[dict],
    forecasts: list[dict],
    cutoff_hour_utc: int = DEFAULT_CUTOFF_HOUR_UTC,
    cutoff_minute_utc: int = DEFAULT_CUTOFF_MINUTE_UTC,
) -> pd.DataFrame:
    """
    Join actuals and forecasts on start_time, applying the decision-cutoff rule.

    For each delivery interval on day D:
      - Decision cutoff = D-1 at cutoff_hour_utc:cutoff_minute_utc UTC
      - We pick the latest WINDFOR forecast published before that cutoff

    Returns a DataFrame with columns:
        start_time      – delivery interval (UTC)
        actual_mw       – actual wind generation (MW)
        forecast_mw     – best pre-cutoff forecast (MW)
        error_mw        – forecast - actual (positive = over-forecast)
        abs_error_mw    – |error_mw|
        delivery_date   – date of start_time
        publish_time    – which forecast vintage was used
    """
    actuals_df = _build_actuals_df(actuals)
    forecasts_df = _build_forecasts_df(forecasts)

    if actuals_df.empty or forecasts_df.empty:
        return pd.DataFrame()

    rows = []
    for _, actual_row in actuals_df.iterrows():
        st: pd.Timestamp = actual_row["start_time"]
        delivery_date = st.date()

        # Compute decision cutoff: day before delivery at cutoff_hour:cutoff_minute UTC
        decision_day = delivery_date - timedelta(days=1)
        cutoff = pd.Timestamp(
            year=decision_day.year,
            month=decision_day.month,
            day=decision_day.day,
            hour=cutoff_hour_utc,
            minute=cutoff_minute_utc,
            second=59,
            tz="UTC",
        )

        # Get candidates: forecasts for this delivery interval, published before cutoff
        candidates = forecasts_df[
            (forecasts_df["start_time"] == st)
            & (forecasts_df["publish_time"] < cutoff)
        ]

        if candidates.empty:
            # No pre-cutoff forecast available for this interval → skip
            logger.debug("No pre-cutoff forecast for %s (cutoff=%s)", st, cutoff)
            continue

        # Take the LATEST forecast before cutoff (most up-to-date pre-decision info)
        best = candidates.loc[candidates["publish_time"].idxmax()]
        forecast_mw = float(best["forecast_mw"])
        pub_time = best["publish_time"]

        actual_mw = float(actual_row["actual_mw"])
        error = forecast_mw - actual_mw

        rows.append(
            {
                "start_time": st,
                "delivery_date": delivery_date,
                "actual_mw": actual_mw,
                "forecast_mw": forecast_mw,
                "forecast_publish_time": pub_time,
                "error_mw": error,
                "abs_error_mw": abs(error),
            }
        )

    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows).sort_values("start_time").reset_index(drop=True)
    return df


def compute_accuracy_metrics(matched_df: pd.DataFrame) -> dict:
    """
    Compute standard forecast accuracy metrics from a matched dataset.

    Metrics explained for energy procurement context:
        MAE  – Average absolute forecast error in MW.
               Tells the trader the typical buffer they need.
        RMSE – Penalises large errors more than MAE.
               High RMSE relative to MAE means occasional big surprises.
        MAPE – Scale-free percentage error. Useful for comparing across periods.
        Bias – Signed mean error. Positive = systematic over-forecast of wind.
               Negative = systematic under-forecast (riskier for procurement).
        Coverage – % of delivery intervals with a valid matched forecast.
    """
    if matched_df.empty or len(matched_df) == 0:
        return {}

    errors = matched_df["error_mw"].dropna()
    actuals = matched_df["actual_mw"].dropna()

    n = len(errors)
    mae = float(np.mean(np.abs(errors)))
    rmse = float(np.sqrt(np.mean(errors**2)))
    bias = float(np.mean(errors))

    # MAPE: exclude near-zero actuals to avoid division artifacts
    nonzero_mask = actuals > 10
    if nonzero_mask.sum() > 0:
        mape = float(
            np.mean(
                np.abs(errors[nonzero_mask] / actuals[nonzero_mask])
            )
            * 100
        )
    else:
        mape = None

    return {
        "n_matched": n,
        "mae_mw": round(mae, 1),
        "rmse_mw": round(rmse, 1),
        "bias_mw": round(bias, 1),
        "mape_pct": round(mape, 2) if mape is not None else None,
        "mae_interpretation": (
            f"On average, the wind forecast was off by {mae:.0f} MW. "
            f"{'Over' if bias > 0 else 'Under'}-forecasting wind by "
            f"{abs(bias):.0f} MW on average (bias). "
            f"Procure an additional buffer of ~{mae:.0f} MW to compensate."
        ),
    }


def compute_daily_metrics(matched_df: pd.DataFrame) -> list[dict]:
    """Daily MAE and bias — useful for spotting trends over the month."""
    if matched_df.empty:
        return []
    grouped = matched_df.groupby("delivery_date")["error_mw"].agg(
        daily_mae=lambda x: np.mean(np.abs(x)),
        daily_bias=lambda x: np.mean(x),
        n=len,
    )
    grouped = grouped.reset_index()
    return grouped.to_dict(orient="records")


def compute_hourly_metrics(matched_df: pd.DataFrame) -> list[dict]:
    """Error by hour-of-day — reveals systematic intra-day biases."""
    if matched_df.empty:
        return []
    df = matched_df.copy()
    df["hour"] = df["start_time"].dt.hour
    grouped = df.groupby("hour")["error_mw"].agg(
        hourly_mae=lambda x: np.mean(np.abs(x)),
        hourly_bias=lambda x: np.mean(x),
        n=len,
    )
    return grouped.reset_index().to_dict(orient="records")


def matched_df_to_json(matched_df: pd.DataFrame) -> list[dict]:
    """Serialise matched DataFrame to JSON-safe list of dicts."""
    if matched_df.empty:
        return []
    df = matched_df.copy()
    df["start_time"] = df["start_time"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    df["forecast_publish_time"] = df["forecast_publish_time"].dt.strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    df["delivery_date"] = df["delivery_date"].astype(str)
    return df.to_dict(orient="records")
