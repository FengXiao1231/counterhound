"""pytest plugin used by proofhound: records structured failure data for each test as JSON."""
import json
import os
import traceback

import pytest

_RESULTS = []

try:
    from hypothesis import HealthCheck, settings

    settings.register_profile(
        'proofhound',
        database=None,
        deadline=None,
        max_examples=int(os.environ.get('PROOFHOUND_MAX_EXAMPLES', '300')),
        suppress_health_check=[HealthCheck.too_slow, HealthCheck.filter_too_much, HealthCheck.data_too_large],
        print_blob=True,
    )
    settings.load_profile('proofhound')
except Exception:  # hypothesis missing: plain tests still work
    pass


def _frames(exc):
    out = []
    for fs in traceback.extract_tb(exc.__traceback__):
        out.append({'file': os.path.abspath(fs.filename), 'line': fs.lineno, 'func': fs.name, 'code': (fs.line or '')[:300]})
    return out


def _describe(exc, depth=0):
    info = {
        'type': f'{type(exc).__module__}.{type(exc).__qualname__}'.replace('builtins.', ''),
        'message': str(exc)[:2000],
        'frames': _frames(exc),
        'notes': [str(n)[:2000] for n in getattr(exc, '__notes__', [])][:20],
    }
    subs = getattr(exc, 'exceptions', None)
    if subs and depth < 2:
        info['group'] = [_describe(e, depth + 1) for e in list(subs)[:5]]
    cause = exc.__cause__ or exc.__context__
    if cause is not None and depth < 2 and not subs:
        info['cause'] = {'type': type(cause).__name__, 'message': str(cause)[:500]}
    return info


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    report = outcome.get_result()
    if call.when == 'call' or (call.when == 'setup' and report.failed):
        entry = {'nodeid': item.nodeid, 'when': call.when, 'outcome': report.outcome, 'duration': round(call.duration, 4)}
        if call.excinfo is not None and report.failed:
            entry['error'] = _describe(call.excinfo.value)
            try:
                entry['longrepr'] = str(report.longrepr)[-6000:]
            except Exception:
                pass
        _RESULTS.append(entry)


def pytest_collectreport(report):
    if report.failed:
        _RESULTS.append({'nodeid': report.nodeid, 'when': 'collect', 'outcome': 'error', 'longrepr': str(report.longrepr)[-4000:]})


def pytest_sessionfinish(session, exitstatus):
    path = os.environ.get('PROOFHOUND_REPORT')
    if path:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump({'exitstatus': int(exitstatus), 'tests': _RESULTS}, f)
