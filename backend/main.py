"""FastAPI backend for the UK wind power forecast dashboard."""

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

import cache
from config import ALLOWED_CUTOFF_OFFSETS, JAN_FROM, JAN_TO, WINDFOR_FROM, cors_origins
import elexon_client as ec
from data_processor import (
    build_matched_dataset,
    compute_accuracy_metrics,
    compute_daily_metrics,
    compute_hourly_metrics,
    matched_df_to_json,
)

logger = logging.getLogger(__name__)

_locks: dict[str, asyncio.Lock] = {}


async def _cached(key: str, fetch):
    """Cache with a per-key lock so concurrent cold requests share one fetch."""
    value = cache.get(key)
    if value is not None:
        return value
    lock = _locks.setdefault(key, asyncio.Lock())
    async with lock:
        value = cache.get(key)  # another request may have filled it while we waited
        if value is None:
            value = await fetch()
            cache.set(key, value)
        return value


async def _actuals():
    return await _cached("actuals", lambda: ec.fetch_actuals(JAN_FROM, JAN_TO))


async def _forecasts():
    return await _cached("forecasts", lambda: ec.fetch_forecasts(WINDFOR_FROM, JAN_TO))


OffsetParam = Query(0, description="Hours before 00:00 UTC on the delivery day: 0 or 13")


def _check_offset(offset: int) -> int:
    if offset not in ALLOWED_CUTOFF_OFFSETS:
        raise HTTPException(400, f"cutoff_offset_hours must be one of {ALLOWED_CUTOFF_OFFSETS}")
    return offset


async def _matched(offset: int = 0):
    async def build():
        return build_matched_dataset(await _actuals(), await _forecasts(), offset)

    return await _cached(f"matched:{offset}", build)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async def prewarm():
        logger.info("Pre-warming cache with January 2026 data...")
        try:
            await asyncio.gather(_actuals(), _forecasts())
            await _matched(0)
            await _matched(13)
        except Exception as e:
            logger.warning("Cache pre-warm failed (will retry on first request): %s", e)

    # Run in the background so /health answers immediately (hosts kill slow starters).
    task = asyncio.create_task(prewarm())
    yield
    task.cancel()
    await ec.close_client()


app = FastAPI(
    title="Wind Power Forecast Dashboard API",
    description="Backend for UK day-ahead wind procurement analytics",
    version="1.0.0",
    lifespan=lifespan,
)
# Comma-separated list in CORS_ORIGINS to lock this down; defaults to open (public read-only data).
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _iso(value: datetime) -> str:
    return value.strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_delivery_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise HTTPException(400, "Invalid delivery_date, use YYYY-MM-DD")


async def _guard(fn, message: str, status: int = 502):
    try:
        return await fn()
    except Exception as e:
        logger.error("%s: %s", message, e, exc_info=True)
        raise HTTPException(status, message)


@app.get("/health")
async def health():
    return {"status": "ok", "data_range": "January 2026"}


@app.get("/api/actuals")
async def get_actuals():
    records = await _guard(_actuals, "Failed to fetch actuals from Elexon")
    return [{"start_time": _iso(r["start_time"]), "actual_mw": float(r["generation"])} for r in records]


@app.get("/api/forecasts")
async def get_forecasts(delivery_date: str | None = Query(None, description="YYYY-MM-DD")):
    requested_day = _parse_delivery_date(delivery_date) if delivery_date else None
    records = await _guard(_forecasts, "Failed to fetch forecasts from Elexon")
    return [
        {
            "start_time": _iso(r["start_time"]),
            "publish_time": _iso(r["publish_time"]),
            "forecast_mw": float(r["generation"]),
        }
        for r in records
        if requested_day is None or r["start_time"].date() == requested_day
    ]


@app.get("/api/matched")
async def get_matched(delivery_date: str = Query(None, description="YYYY-MM-DD"), cutoff_offset_hours: int = OffsetParam):
    offset = _check_offset(cutoff_offset_hours)
    df = await _guard(lambda: _matched(offset), "Failed to build matched dataset", 500)
    if delivery_date and not df.empty:
        df = df[df["delivery_date"].astype(str) == delivery_date]
    return matched_df_to_json(df)


@app.get("/api/accuracy")
async def get_accuracy(cutoff_offset_hours: int = OffsetParam):
    offset = _check_offset(cutoff_offset_hours)
    df = await _guard(lambda: _matched(offset), "Failed to compute accuracy", 500)
    metrics = compute_accuracy_metrics(df)
    if metrics:
        total = len(await _actuals())
        metrics["n_actuals"] = total
        metrics["coverage_pct"] = round(100 * metrics["n_matched"] / total, 1) if total else 0.0
    return metrics


@app.get("/api/accuracy/daily")
async def get_daily_accuracy(cutoff_offset_hours: int = OffsetParam):
    offset = _check_offset(cutoff_offset_hours)
    df = await _guard(lambda: _matched(offset), "Failed to compute daily accuracy", 500)
    return [
        {**r, "delivery_date": str(r["delivery_date"]), "daily_mae": round(r["daily_mae"], 1), "daily_bias": round(r["daily_bias"], 1)}
        for r in compute_daily_metrics(df)
    ]


@app.get("/api/accuracy/hourly")
async def get_hourly_accuracy(cutoff_offset_hours: int = OffsetParam):
    offset = _check_offset(cutoff_offset_hours)
    df = await _guard(lambda: _matched(offset), "Failed to compute hourly accuracy", 500)
    return [
        {**r, "hourly_mae": round(r["hourly_mae"], 1), "hourly_bias": round(r["hourly_bias"], 1)}
        for r in compute_hourly_metrics(df)
    ]


@app.get("/api/forecast-vintages")
async def get_forecast_vintages(
    delivery_date: str = Query(..., description="YYYY-MM-DD"), cutoff_offset_hours: int = OffsetParam
):
    offset = _check_offset(cutoff_offset_hours)
    day = _parse_delivery_date(delivery_date)

    cutoff = datetime(day.year, day.month, day.day, tzinfo=timezone.utc) - timedelta(hours=offset)
    records = await _guard(_forecasts, "Failed to fetch forecasts from Elexon")

    counts: dict[datetime, int] = {}
    for r in records:
        if r["start_time"].date() == day:
            counts[r["publish_time"]] = counts.get(r["publish_time"], 0) + 1

    vintages = [{"publish_time": _iso(t), "n_intervals": n} for t, n in sorted(counts.items())]
    decision = next((_iso(t) for t, _ in sorted(counts.items(), reverse=True) if t < cutoff), None)
    return {
        "delivery_date": delivery_date,
        "decision_cutoff": _iso(cutoff),
        "decision_vintage": decision,
        "vintages": vintages,
    }
