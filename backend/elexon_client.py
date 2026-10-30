"""Async client for the Elexon BMRS Insights API."""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

import httpx

logger = logging.getLogger(__name__)

BASE = "https://data.elexon.co.uk/bmrs/api/v1"
CHUNK_DAYS = 7  # FUELHH allows at most 7 days per request
_client: httpx.AsyncClient | None = None


def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(120, connect=10),
            headers={"Accept": "application/json"},
        )
    return _client


async def close_client() -> None:
    if _client and not _client.is_closed:
        await _client.aclose()


def _dt(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def _chunks(start: datetime, end: datetime):
    day, last = start.date(), end.date()
    while day <= last:
        chunk_end = min(day + timedelta(days=CHUNK_DAYS - 1), last)
        yield day.isoformat(), chunk_end.isoformat()
        day = chunk_end + timedelta(days=1)


async def _get(url: str, params: dict) -> list[dict]:
    response = await get_client().get(url, params=params)
    response.raise_for_status()
    data = response.json()
    return data if isinstance(data, list) else data.get("data", [])


def _parse(items: list[dict], mapper) -> list[dict]:
    records = []
    for item in items:
        try:
            records.append(mapper(item))
        except (KeyError, ValueError, TypeError) as e:
            logger.warning("Skipping malformed record: %s", e)
    return records


async def _actuals_chunk(date_from: str, date_to: str) -> list[dict]:
    items = await _get(
        f"{BASE}/datasets/FUELHH",
        {
            "settlementDateFrom": date_from,
            "settlementDateTo": date_to,
            "fuelType": "WIND",
        },
    )
    return _parse(
        [i for i in items if i.get("fuelType", "").upper() == "WIND"],
        lambda i: {"start_time": _dt(i["startTime"]), "generation": float(i["generation"])},
    )


async def fetch_actuals(date_from: datetime, date_to: datetime) -> list[dict]:
    """Half-hourly actual WIND generation, fetched concurrently in ≤7-day chunks."""
    chunks = list(_chunks(date_from, date_to))
    results = await asyncio.gather(*[_actuals_chunk(f, t) for f, t in chunks])
    latest = {r["start_time"]: r for chunk in results for r in chunk}
    records = sorted(latest.values(), key=lambda r: r["start_time"])
    logger.info("Fetched %d actual WIND records", len(records))
    return records


async def fetch_forecasts(date_from: datetime, date_to: datetime) -> list[dict]:
    """All WINDFOR vintages published within the range (stream honours the dates)."""
    items = await _get(
        f"{BASE}/datasets/WINDFOR/stream",
        {
            "publishDateTimeFrom": date_from.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "publishDateTimeTo": date_to.strftime("%Y-%m-%dT%H:%M:%SZ"),
        },
    )
    records = _parse(
        items,
        lambda i: {
            "start_time": _dt(i["startTime"]),
            "publish_time": _dt(i["publishTime"]),
            "generation": float(i["generation"]),
        },
    )
    logger.info("Fetched %d forecast records", len(records))
    return records
