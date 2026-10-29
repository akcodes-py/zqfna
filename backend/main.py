"""
main.py
-------
FastAPI application — Wind Power Forecast Dashboard Backend.

Endpoints:
  GET /api/actuals          – actual wind generation (Jan 2026)
  GET /api/forecasts        – forecast vintages, optionally filtered by delivery date
  GET /api/matched          – joined actuals + best pre-cutoff forecasts
  GET /api/accuracy         – aggregate accuracy metrics (MAE, RMSE, bias, MAPE)
  GET /api/accuracy/daily   – daily MAE/bias for the trend chart
  GET /api/accuracy/hourly  – by-hour-of-day error profile
  GET /health               – health check
"""

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

import cache
import elexon_client as ec
from data_processor import (
    build_matched_dataset,
    compute_accuracy_metrics,
    compute_daily_metrics,
    compute_hourly_metrics,
    matched_df_to_json,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── January 2026 date range constants ──────────────────────────────────────────
JAN_FROM = datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
JAN_TO = datetime(2026, 1, 31, 23, 59, 59, tzinfo=timezone.utc)

# For WINDFOR: forecasts published from Dec 31 onwards cover Jan 1 delivery
WINDFOR_FROM = datetime(2025, 12, 31, 0, 0, 0, tzinfo=timezone.utc)
WINDFOR_TO = datetime(2026, 1, 31, 23, 59, 59, tzinfo=timezone.utc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up — pre-warming cache with January 2026 data...")
    try:
        await _get_actuals()
        await _get_forecasts()
        logger.info("Cache pre-warm complete.")
    except Exception as e:
        logger.warning("Cache pre-warm failed (will retry on first request): %s", e)
    yield
    await ec.close_client()


app = FastAPI(
    title="Wind Power Forecast Dashboard API",
    description="Backend for UK day-ahead wind procurement analytics",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Internal cached fetchers ────────────────────────────────────────────────────


async def _get_actuals() -> list[dict]:
    key = cache.make_key("actuals", "jan2026")
    cached = cache.get(key)
    if cached is not None:
        return cached
    records = await ec.fetch_actuals(JAN_FROM, JAN_TO)
    cache.set(key, records)
    return records


async def _get_forecasts() -> list[dict]:
    key = cache.make_key("forecasts", "jan2026")
    cached = cache.get(key)
    if cached is not None:
        return cached
    records = await ec.fetch_forecasts(WINDFOR_FROM, WINDFOR_TO)
    cache.set(key, records)
    return records


async def _get_matched():
    key = cache.make_key("matched", "jan2026")
    cached = cache.get(key)
    if cached is not None:
        return cached
    actuals = await _get_actuals()
    forecasts = await _get_forecasts()
    df = build_matched_dataset(actuals, forecasts)
    cache.set(key, df)
    return df


# ── Routes ──────────────────────────────────────────────────────────────────────


@app.get("/health")
async def health():
    return {"status": "ok", "data_range": "January 2026"}


@app.get("/api/actuals")
async def get_actuals():
    """
    Returns all actual half-hourly WIND generation records for January 2026.
    Each record: { start_time, actual_mw }
    """
    try:
        records = await _get_actuals()
    except Exception as e:
        logger.error("Failed to fetch actuals: %s", e)
        raise HTTPException(502, f"Failed to fetch actuals from Elexon: {e}")

    return [
        {
            "start_time": r["start_time"].strftime("%Y-%m-%dT%H:%M:%SZ"),
            "actual_mw": float(r["generation"]),
        }
        for r in records
    ]


@app.get("/api/forecasts")
async def get_forecasts(
    delivery_date: str = Query(
        None,
        description="Filter to forecasts targeting this delivery date (YYYY-MM-DD)",
    ),
):
    """
    Returns all WINDFOR forecast records for January 2026.
    Optionally filter by delivery date.
    Each record: { start_time, publish_time, forecast_mw }
    """
    try:
        records = await _get_forecasts()
    except Exception as e:
        logger.error("Failed to fetch forecasts: %s", e)
        raise HTTPException(502, f"Failed to fetch forecasts from Elexon: {e}")

    result = []
    for r in records:
        st = r["start_time"]
        if delivery_date and st.date().isoformat() != delivery_date:
            continue
        result.append(
            {
                "start_time": st.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "publish_time": r["publish_time"].strftime("%Y-%m-%dT%H:%M:%SZ"),
                "forecast_mw": float(r["generation"]),
            }
        )
    return result


@app.get("/api/matched")
async def get_matched(
    delivery_date: str = Query(
        None,
        description="Filter to a specific delivery date (YYYY-MM-DD)",
    ),
):
    """
    Returns matched actuals + best pre-cutoff forecast for each delivery interval.

    The 'best' forecast is the LATEST vintage published strictly before midnight
    on the day before delivery (decision cutoff). This avoids data leakage.

    Each record: { start_time, delivery_date, actual_mw, forecast_mw,
                   forecast_publish_time, error_mw, abs_error_mw }
    """
    try:
        df = await _get_matched()
    except Exception as e:
        logger.error("Failed to build matched dataset: %s", e)
        raise HTTPException(500, f"Failed to build matched dataset: {e}")

    if df.empty:
        return []

    if delivery_date:
        df = df[df["delivery_date"].astype(str) == delivery_date]

    return matched_df_to_json(df)


@app.get("/api/accuracy")
async def get_accuracy():
    """
    Returns aggregate forecast accuracy metrics for all of January 2026.

    Metrics: MAE, RMSE, MAPE, Bias (MW) with procurement interpretation.
    """
    try:
        df = await _get_matched()
    except Exception as e:
        raise HTTPException(500, f"Failed to compute accuracy: {e}")

    metrics = compute_accuracy_metrics(df)
    return metrics


@app.get("/api/accuracy/daily")
async def get_daily_accuracy():
    """Daily MAE and bias — reveals error trends across January."""
    try:
        df = await _get_matched()
    except Exception as e:
        raise HTTPException(500, f"Failed to compute daily accuracy: {e}")
    records = compute_daily_metrics(df)
    return [
        {
            **r,
            "delivery_date": str(r["delivery_date"]),
            "daily_mae": round(r["daily_mae"], 1),
            "daily_bias": round(r["daily_bias"], 1),
        }
        for r in records
    ]


@app.get("/api/accuracy/hourly")
async def get_hourly_accuracy():
    """Error profile by hour-of-day — reveals intra-day systematic biases."""
    try:
        df = await _get_matched()
    except Exception as e:
        raise HTTPException(500, f"Failed to compute hourly accuracy: {e}")
    records = compute_hourly_metrics(df)
    return [
        {
            **r,
            "hourly_mae": round(r["hourly_mae"], 1),
            "hourly_bias": round(r["hourly_bias"], 1),
        }
        for r in records
    ]


@app.get("/api/forecast-vintages")
async def get_forecast_vintages(
    delivery_date: str = Query(..., description="Delivery date (YYYY-MM-DD)"),
):
    """
    Returns all forecast vintages available for a given delivery date,
    along with which one would be selected at decision time (D-1 cutoff).

    Useful for the UI: user can pick a vintage and see how it compared to actual.
    """
    try:
        records = await _get_forecasts()
    except Exception as e:
        raise HTTPException(502, f"Failed to fetch forecasts: {e}")

    vintages = {}
    for r in records:
        st = r["start_time"]
        if st.date().isoformat() != delivery_date:
            continue
        pt = r["publish_time"]
        pt_key = pt.strftime("%Y-%m-%dT%H:%M:%SZ")
        if pt_key not in vintages:
            vintages[pt_key] = {
                "publish_time": pt_key,
                "n_intervals": 0,
            }
        vintages[pt_key]["n_intervals"] += 1

    # Mark which vintage is the "decision-time" one (latest published before midnight D-1)
    from datetime import date, timedelta
    try:
        d = date.fromisoformat(delivery_date)
    except ValueError:
        raise HTTPException(400, "Invalid delivery_date format, use YYYY-MM-DD")

    from datetime import datetime
    cutoff = datetime(d.year, d.month, d.day, tzinfo=timezone.utc)  # midnight day D

    sorted_v = sorted(vintages.values(), key=lambda x: x["publish_time"])
    decision_vintage = None
    for v in reversed(sorted_v):
        pt_dt = datetime.fromisoformat(v["publish_time"].replace("Z", "+00:00"))
        if pt_dt < cutoff:
            decision_vintage = v["publish_time"]
            break

    return {
        "delivery_date": delivery_date,
        "decision_cutoff": cutoff.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "decision_vintage": decision_vintage,
        "vintages": sorted_v,
    }
