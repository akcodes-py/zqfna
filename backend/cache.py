"""Tiny in-memory TTL cache. January 2026 data is historical, so cache it hard."""

import time

_store: dict[str, tuple[float, object]] = {}
TTL = 6 * 3600


def get(key: str):
    entry = _store.get(key)
    if entry and time.monotonic() < entry[0]:
        return entry[1]
    _store.pop(key, None)
    return None


def set(key: str, value, ttl: int = TTL) -> None:
    _store[key] = (time.monotonic() + ttl, value)
