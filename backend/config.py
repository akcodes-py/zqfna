"""Application configuration shared by the API and Elexon client."""

import os
from datetime import datetime, timezone

JAN_FROM = datetime(2026, 1, 1, tzinfo=timezone.utc)
JAN_TO = datetime(2026, 1, 31, 23, 59, 59, tzinfo=timezone.utc)
WINDFOR_FROM = datetime(2025, 12, 31, tzinfo=timezone.utc)
ALLOWED_CUTOFF_OFFSETS = (0, 13)

ELEXON_BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"
ELEXON_CHUNK_DAYS = 7


def cors_origins() -> list[str]:
    """Return configured origins, defaulting to public read-only access locally."""
    return [origin.strip() for origin in os.getenv("CORS_ORIGINS", "*").split(",") if origin.strip()]
