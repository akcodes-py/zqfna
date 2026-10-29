"""
cache.py
--------
Simple in-memory TTL cache for Elexon API responses.

January 2026 is historical data — it doesn't change. We cache it aggressively
(6 hours) so that repeated dashboard refreshes don't hammer the external API.
"""

import time
import hashlib
import json
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

_store: dict[str, tuple[float, Any]] = {}  # key -> (expires_at, value)

DEFAULT_TTL = 6 * 3600  # 6 hours for historical data


def _make_key(*args) -> str:
    raw = json.dumps(args, default=str, sort_keys=True)
    return hashlib.md5(raw.encode()).hexdigest()


def get(key: str) -> Optional[Any]:
    entry = _store.get(key)
    if entry is None:
        return None
    expires_at, value = entry
    if time.monotonic() > expires_at:
        del _store[key]
        logger.debug("Cache expired for key %s", key[:8])
        return None
    logger.debug("Cache hit for key %s", key[:8])
    return value


def set(key: str, value: Any, ttl: int = DEFAULT_TTL) -> None:
    _store[key] = (time.monotonic() + ttl, value)
    logger.debug("Cached key %s for %ds", key[:8], ttl)


def make_key(*args) -> str:
    return _make_key(*args)


def clear() -> None:
    _store.clear()
