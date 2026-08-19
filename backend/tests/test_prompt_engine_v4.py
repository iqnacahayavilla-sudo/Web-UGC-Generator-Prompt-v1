"""Iteration-4 prompt engine tests: duration -> scene count, character
consistency lock, product consistency lock, standalone scenes, and
character-anchor reuse on regenerate.
"""
import os
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
if not BASE_URL:
    # Fallback: read from frontend .env
    _env_path = "/app/frontend/.env"
    if os.path.exists(_env_path):
        for line in open(_env_path):
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break
assert BASE_URL, "REACT_APP_BACKEND_URL is required"
API = f"{BASE_URL}/api"
IMG_PATH = "/tmp/prod.jpg"

REQUIRED_SCENE_FIELDS = [
    "number", "name", "time",
    "character_continuity", "product_continuity", "location_continuity",
    "visual", "action", "facial_expression", "gesture",
    "camera", "lighting", "audio", "dialogue",
    "transition", "negative_constraints",
]


@pytest.fixture(scope="module")
def analyzed():
    with open(IMG_PATH, "rb") as f:
        r = requests.post(
            f"{API}/analyze",
            files={"file": ("prod.jpg", f, "image/jpeg")},
            timeout=120,
        )
    assert r.status_code == 200, r.text
    return r.json()


def _payload(analysis, duration, modifier=None, character_anchor=None, reuse=False):
    return {
        "product_analysis": analysis,
        "video_settings": {
            "aspect_ratio": "9:16",
            "duration": duration,
            "ugc_style": "Problem \u2192 Solution",
            "hook_style": "AI Chooses",
            "selling_style": "Natural Recommendation",
        },
        "creator_settings": {
            "gender": "Female", "age": "25-34", "personality": "Relatable",
            "speaking_style": "Natural", "location": "Kitchen",
        },
        "language": "English",
        "natural_language": True,
        "modifier": modifier,
        "character_anchor": character_anchor,
        "reuse_character": reuse,
    }


def _assert_common(data, expected_duration_str):
    assert isinstance(data.get("master_prompt"), str)
    mp = data["master_prompt"]
    assert len(mp) > 200
    assert not mp.strip().startswith("{"), "master_prompt must be plain text, not JSON"
    up = mp.upper()
    for header in ("CHARACTER CONSISTENCY LOCK", "CHARACTER ANCHOR",
                   "PRODUCT CONSISTENCY LOCK", "GLOBAL NEGATIVE"):
        assert header in up, f"Missing header {header}. Head: {mp[:400]}"

    # New iteration-4 structured fields
    assert data.get("character_locked") is True
    assert data.get("product_locked") is True

    bible = data.get("character_bible")
    assert isinstance(bible, dict) and bible, "character_bible must be a non-empty dict"
    # Bible should contain identity fields
    for key in ("gender", "hair_color", "outfit"):
        assert key in bible, f"character_bible missing key {key}"

    anchor = data.get("character_anchor")
    assert isinstance(anchor, str) and len(anchor) > 30, "character_anchor must be a non-empty paragraph"

    product_lock = data.get("product_lock")
    assert isinstance(product_lock, str) and len(product_lock) > 30, "product_lock must be non-empty"

    scenes = data.get("scenes")
    assert isinstance(scenes, list) and len(scenes) >= 3
    for s in scenes:
        for field in REQUIRED_SCENE_FIELDS:
            assert field in s, f"scene missing field {field}"
        # Standalone requirement: character_continuity must be non-empty and NOT
        # only "the woman"/"the man" — should reference the anchor identity.
        cc = (s.get("character_continuity") or "").strip()
        assert cc, "character_continuity is empty"
        assert len(cc) > 40, f"character_continuity too short to be standalone: {cc!r}"
        pc = (s.get("product_continuity") or "").strip()
        assert pc, "product_continuity is empty"


# ---- Duration -> scene count ----

@pytest.fixture(scope="module")
def gen_10s(analyzed):
    r = requests.post(
        f"{API}/projects/{analyzed['project_id']}/generate",
        json=_payload(analyzed["product_analysis"], "10 seconds"),
        timeout=180,
    )
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def gen_20s(analyzed):
    r = requests.post(
        f"{API}/projects/{analyzed['project_id']}/generate",
        json=_payload(analyzed["product_analysis"], "20 seconds"),
        timeout=180,
    )
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def gen_30s(analyzed):
    r = requests.post(
        f"{API}/projects/{analyzed['project_id']}/generate",
        json=_payload(analyzed["product_analysis"], "30 seconds"),
        timeout=180,
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_generate_10s_scene_count_and_structure(gen_10s):
    _assert_common(gen_10s, "10 seconds")
    n = len(gen_10s["scenes"])
    assert 2 <= n <= 4, f"expected ~3 scenes for 10s, got {n}"


def test_generate_20s_scene_count_and_dialogue(gen_20s):
    _assert_common(gen_20s, "20 seconds")
    n = len(gen_20s["scenes"])
    assert 3 <= n <= 5, f"expected ~4 scenes for 20s, got {n}"
    # dialogue present and natural
    dialogues = [s.get("dialogue") or "" for s in gen_20s["scenes"]]
    assert any(len(d) > 5 for d in dialogues), "expected non-empty dialogue"


def test_generate_30s_scene_count_and_identity_carry(gen_30s):
    _assert_common(gen_30s, "30 seconds")
    scenes = gen_30s["scenes"]
    n = len(scenes)
    assert 4 <= n <= 6, f"expected ~5 scenes for 30s, got {n}"
    # Identity must carry: some overlap between first and last scene's character_continuity
    first_cc = (scenes[0].get("character_continuity") or "").lower()
    last_cc = (scenes[-1].get("character_continuity") or "").lower()
    # A crude "same identity" check: significant word overlap
    first_tokens = {w for w in first_cc.split() if len(w) > 4}
    last_tokens = {w for w in last_cc.split() if len(w) > 4}
    overlap = first_tokens & last_tokens
    assert len(overlap) >= 5, (
        f"first and last scene character_continuity should share identity tokens; "
        f"overlap={overlap}"
    )


# ---- Anchor reuse on regenerate ----

def test_anchor_reused_verbatim_on_regenerate(analyzed):
    pid = analyzed["project_id"]
    # 1st call: no reuse -> get anchor
    r1 = requests.post(
        f"{API}/projects/{pid}/generate",
        json=_payload(analyzed["product_analysis"], "10 seconds"),
        timeout=180,
    )
    assert r1.status_code == 200, r1.text
    anchor1 = r1.json().get("character_anchor")
    assert anchor1 and len(anchor1) > 30

    # 2nd call: reuse=True with modifier -> anchor must come back identical
    r2 = requests.post(
        f"{API}/projects/{pid}/generate",
        json=_payload(analyzed["product_analysis"], "10 seconds",
                      modifier="Make it more viral",
                      character_anchor=anchor1, reuse=True),
        timeout=180,
    )
    assert r2.status_code == 200, r2.text
    anchor2 = r2.json().get("character_anchor")
    assert anchor2 == anchor1, (
        f"anchor changed on reuse!\n---sent---\n{anchor1}\n---got---\n{anchor2}"
    )

    # 3rd call: reuse=False (simulates 'Change Creator') -> should be able to differ
    r3 = requests.post(
        f"{API}/projects/{pid}/generate",
        json=_payload(analyzed["product_analysis"], "10 seconds",
                      modifier="Cast a DIFFERENT creator",
                      character_anchor=None, reuse=False),
        timeout=180,
    )
    assert r3.status_code == 200, r3.text
    anchor3 = r3.json().get("character_anchor")
    assert anchor3, "third-call anchor missing"
    # Not required to be strictly different (LLM may randomly pick same), but usually will be.
    # Assert only that it exists; log for visibility.
    print(f"reuse=False produced anchor identical to first? {anchor3 == anchor1}")


# ---- Error handling still holds ----

def test_generate_invalid_project_id(analyzed):
    r = requests.post(
        f"{API}/projects/does-not-exist-xyz/generate",
        json=_payload(analyzed["product_analysis"], "10 seconds"),
        timeout=30,
    )
    assert r.status_code == 404


def test_analyze_unsupported_extension():
    import io
    files = {"file": ("bad.txt", io.BytesIO(b"hello world"), "text/plain")}
    r = requests.post(f"{API}/analyze", files=files, timeout=30)
    assert r.status_code == 400
