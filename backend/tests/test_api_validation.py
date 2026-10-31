"""Focused tests for API boundary validation that does not require Elexon access."""

import sys
from datetime import date
from pathlib import Path

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).parents[1]))

from main import _check_offset, _parse_delivery_date


@pytest.mark.parametrize("offset", [0, 13])
def test_supported_cutoffs_are_accepted(offset):
    assert _check_offset(offset) == offset


def test_unsupported_cutoff_returns_client_error():
    with pytest.raises(HTTPException) as error:
        _check_offset(6)
    assert error.value.status_code == 400


def test_delivery_date_requires_iso_format():
    assert _parse_delivery_date("2026-01-15") == date(2026, 1, 15)
    with pytest.raises(HTTPException) as error:
        _parse_delivery_date("15-01-2026")
    assert error.value.status_code == 400
