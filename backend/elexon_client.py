"""
elexon_client.py
----------------
Async HTTP client for the Elexon BMRS Insights API.

Key design choices:
- Uses httpx AsyncClient with connection pooling for efficient bulk fetches.

IMPORTANT — FUELHH endpoint quirks (discovered during development):
  1. The FUELHH /stream endpoint ignores from/to date params and returns only
     the most recent real-time data. Historical data requires the non-stream
     /datasets/FUELHH endpoint with settlementDateFrom/settlementDateTo.
  2. The non-stream endpoint allows a maximum window of 7 days per request.
     We therefore chunk January into 5 weekly windows and fetch concurrently.

- WINDFOR /stream correctly respects publishDateTimeFrom/To — single bulk fetch.
- All timestamps parsed to timezone-aware UTC datetimes immediately on ingestion.
"""

import asyncio
import httpx
import logging
from datetime import datetime, timezone, timedelta, date as date_type
from typing import Optional

logger = logging.getLogger(__name__)

ELEXON_BASE = "https://data.elexon.co.uk/bmrs/api/v1"
FUELHH_MAX_DAYS = 7   # API hard limit per request

_client: Optional[httpx.AsyncClient] = None


def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(120.0, connect=10.0),
            headers={"Accept": "application/json"},
        )
    return _client


async def close_client() -> None:
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()


def _parse_dt(value: str) -> datetime:
    """Parse ISO-8601 string → UTC-aware datetime."""
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return dt.astimezone(timezone.utc)


def _week_chunks(date_from: datetime, date_to: datetime) -> list[tuple[str, str]]:
    """Split a date range into at-most-7-day chunks. Returns (from_str, to_str) tuples."""
    chunks = []
    start = date_from.date()
    end = date_to.date()
    current = start
    while current <= end:
        chunk_end = min(current + timedelta(days=FUELHH_MAX_DAYS - 1), end)
        chunks.append((current.isoformat(), chunk_end.isoformat()))
        current = chunk_end + timedelta(days=1)
    return chunks


async def _fetch_actuals_chunk(date_from_str: str, date_to_str: str) -> list[dict]:
    """Fetch one ≤7-day chunk of FUELHH WIND actuals."""
    url = f"{ELEXON_BASE}/datasets/FUELHH"
    params = {
        "settlementDateFrom": date_from_str,
        "settlementDateTo": date_to_str,
        "fuelType": "WIND",
    }
    client = get_client()
    try:
        response = await client.get(url, params=params)
        response.raise_for_status()
    except httpx.HTTPStatusError as e:
        logger.error("FUELHH HTTP %s for %s→%s: %s", e.response.status_code, date_from_str, date_to_str, e)
        return []
    raw = response.json()
    items = raw if isinstance(raw, list) else raw.get("data", [])

    records = []
    for item in items:
        if item.get("fuelType", "").upper() != "WIND":
            continue
        try:
            records.append({
                "start_time": _parse_dt(item["startTime"]),
                "generation": float(item["generation"]),
            })
        except (KeyError, ValueError, TypeError) as e:
            logger.warning("Skipping malformed actual record: %s — %s", item, e)
    return records


async def fetch_actuals(date_from: datetime, date_to: datetime) -> list[dict]:
    """
    Fetch half-hourly actual WIND generation from FUELHH for a date range.

    Splits the range into ≤7-day chunks (API limit) and fetches concurrently.

    Returns list of dicts:
        start_time  (datetime UTC) – start of the 30-min delivery interval
        generation  (float, MW)
    """
    chunks = _week_chunks(date_from, date_to)
    logger.info(
        "Fetching actuals (FUELHH) %s → %s in %d chunks",
        date_from.strftime("%Y-%m-%d"),
        date_to.strftime("%Y-%m-%d"),
        len(chunks),
    )

    results = await asyncio.gather(*[_fetch_actuals_chunk(f, t) for f, t in chunks])

    # Flatten, deduplicate by start_time, sort
    seen: dict[datetime, dict] = {}
    for chunk_records in results:
        for r in chunk_records:
            seen[r["start_time"]] = r
    records = sorted(seen.values(), key=lambda x: x["start_time"])

    logger.info("Fetched %d actual WIND records total", len(records))
    return records


async def fetch_forecasts(date_from: datetime, date_to: datetime) -> list[dict]:
    """
    Fetch wind generation forecasts from WINDFOR.

    Uses publishDateTimeFrom/publishDateTimeTo to retrieve all forecast vintages
    published within the date range. WINDFOR /stream correctly respects these
    parameters, so a single request retrieves the full month's data.

    Returns list of dicts:
        start_time   (datetime UTC) – delivery interval the forecast targets
        publish_time (datetime UTC) – when the forecast was published/issued
        generation   (float, MW)
    """
    url = f"{ELEXON_BASE}/datasets/WINDFOR/stream"
    params = {
        "publishDateTimeFrom": date_from.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "publishDateTimeTo": date_to.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    logger.info(
        "Fetching forecasts published %s → %s",
        date_from.strftime("%Y-%m-%d"),
        date_to.strftime("%Y-%m-%d"),
    )
    client = get_client()
    response = await client.get(url, params=params)
    response.raise_for_status()
    raw = response.json()
    items = raw if isinstance(raw, list) else raw.get("data", [])

    records = []
    for item in items:
        try:
            records.append(
                {
                    "start_time": _parse_dt(item["startTime"]),
                    "publish_time": _parse_dt(item["publishTime"]),
                    "generation": float(item["generation"]),
                }
            )
        except (KeyError, ValueError, TypeError) as e:
            logger.warning("Skipping malformed forecast record: %s — %s", item, e)

    logger.info("Fetched %d forecast records", len(records))
    return records
