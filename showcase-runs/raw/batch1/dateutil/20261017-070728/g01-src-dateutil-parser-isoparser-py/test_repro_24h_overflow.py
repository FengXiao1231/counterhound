import pytest
from dateutil.parser.isoparser import isoparser


def test_repro_24h_overflow():
    # Every other unrepresentable/out-of-range input (year 0000, month 13,
    # 2999-12-31T25:00) raises ValueError; this one leaks OverflowError.
    try:
        isoparser().isoparse('9999-12-31T24:00')
    except ValueError:
        return
    except OverflowError:
        pytest.fail('OverflowError escaped instead of ValueError')
