import os
import sys
import asyncio
import requests
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

try:
    import pytest
except ImportError:
    class DummyPytest:
        def fixture(self, *args, **kwargs):
            return lambda fn: fn
    pytest = DummyPytest()


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ugc-flow-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
IMG_PATH = "/tmp/prod.jpg"

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

if pytest is None:
    # Skip legacy integration tests when pytest is not installed
    pass
else:
    from services import ai_service
    from services.ai_service import (
        _classify, AIError,
        OPENAI_RATE_LIMITED, OPENAI_VALIDATION_ERROR, OPENAI_PROVIDER_ERROR,
    )



def _payload(analysis, modifier=None):
    return {
        "product_analysis": analysis,
        "video_settings": {
            "aspect_ratio": "9:16", "duration": "20 seconds",
            "ugc_style": "Problem \u2192 Solution", "hook_style": "AI Chooses",
            "selling_style": "Natural Recommendation",
        },
        "creator_settings": {
            "gender": "Any", "age": "AI Chooses", "personality": "Relatable",
            "speaking_style": "Natural", "location": "Product Appropriate",
        },
        "language": "English", "natural_language": True, "modifier": modifier,
    }


# ---- 5 sequential generations - the reported bug ----
def test_five_sequential_generations(analyzed_project):
    pid = analyzed_project["project_id"]
    payload = _payload(analyzed_project["product_analysis"])
    results = []
    for i in range(5):
        r = requests.post(f"{API}/projects/{pid}/generate", json=payload, timeout=120)
        assert r.status_code == 200, f"attempt #{i+1} failed: {r.status_code} {r.text[:400]}"
        d = r.json()
        mp = d.get("master_prompt", "")
        assert isinstance(mp, str) and len(mp) > 100, f"attempt #{i+1} empty prompt"
        assert not mp.strip().startswith("{"), f"attempt #{i+1} returned JSON not plain text"
        assert isinstance(d.get("scenes"), list) and len(d["scenes"]) > 0
        assert isinstance(d.get("summary"), dict) and d["summary"]
        results.append(len(mp))
    print(f"5-run prompt lengths: {results}")


# ---- Unit tests for retry + classification (no real provider) ----

def test_classify_400():
    class E(Exception):
        status_code = 400
    assert _classify(E("invalid payload")) == VALIDATION_ERROR


def test_classify_429():
    class E(Exception):
        status_code = 429
    assert _classify(E("rate limit exceeded")) == RATE_LIMITED


def test_classify_503():
    class E(Exception):
        status_code = 503
    assert _classify(E("service unavailable")) == PROVIDER_ERROR


def test_classify_quota():
    assert _classify(Exception("You have exceeded your current quota")) == QUOTA_EXCEEDED


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro) if False else asyncio.run(coro)


def test_retry_503_twice_then_success(monkeypatch):
    # No real sleep during retries
    async def no_sleep(_):
        return None
    monkeypatch.setattr(ai_service.asyncio, "sleep", no_sleep)

    calls = {"n": 0}

    async def attempt():
        calls["n"] += 1
        if calls["n"] < 3:
            e = Exception("503 service unavailable")
            e.status_code = 503
            raise e
        return {"ok": True, "attempt": calls["n"]}

    result = asyncio.run(_run_with_retry(attempt, "generate", "test1"))
    assert result == {"ok": True, "attempt": 3}
    assert calls["n"] == 3


def test_retry_400_no_retry(monkeypatch):
    async def no_sleep(_):
        return None
    monkeypatch.setattr(ai_service.asyncio, "sleep", no_sleep)

    calls = {"n": 0}

    async def attempt():
        calls["n"] += 1
        e = Exception("invalid request")
        e.status_code = 400
        raise e

    with pytest.raises(AIError) as ei:
        asyncio.run(_run_with_retry(attempt, "generate", "test2"))
    assert ei.value.classification == VALIDATION_ERROR
    assert calls["n"] == 1, f"expected single attempt, got {calls['n']}"


def test_retry_429_capped(monkeypatch):
    async def no_sleep(_):
        return None
    monkeypatch.setattr(ai_service.asyncio, "sleep", no_sleep)

    calls = {"n": 0}

    async def attempt():
        calls["n"] += 1
        e = Exception("Too Many Requests")
        e.status_code = 429
        raise e

    with pytest.raises(AIError) as ei:
        asyncio.run(_run_with_retry(attempt, "generate", "test3"))
    assert ei.value.classification == RATE_LIMITED
    # MAX_RETRIES=2 -> 3 total attempts (capped)
    assert calls["n"] == 3, f"expected 3 attempts (capped), got {calls['n']}"
