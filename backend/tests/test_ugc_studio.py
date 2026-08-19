"""Backend tests for UGC Prompt Studio (analyze, files, generate)."""
import os
import io
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ugc-flow-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
IMG_PATH = "/tmp/prod.jpg"


@pytest.fixture(scope="session")
def analyzed():
    """Upload image once and share across generate tests."""
    with open(IMG_PATH, "rb") as f:
        files = {"file": ("prod.jpg", f, "image/jpeg")}
        r = requests.post(f"{API}/analyze", files=files, timeout=120)
    assert r.status_code == 200, f"analyze failed: {r.status_code} {r.text}"
    data = r.json()
    return data


# ---- Branding ----
def test_root_branding():
    r = requests.get(f"{API}/", timeout=15)
    assert r.status_code == 200
    assert r.json().get("message") == "VISUAL SINERGI GENERATE PROMPT API"



# ---- /api/analyze ----

def test_analyze_valid_jpeg(analyzed):
    d = analyzed
    assert "project_id" in d and isinstance(d["project_id"], str)
    assert "product_image_path" in d and d["product_image_path"]
    pa = d["product_analysis"]
    for key in ("product_name", "category", "dominant_colors"):
        assert key in pa, f"missing key {key}"
    assert isinstance(pa["dominant_colors"], list)


def test_analyze_unsupported_extension():
    files = {"file": ("bad.txt", io.BytesIO(b"hello world"), "text/plain")}
    r = requests.post(f"{API}/analyze", files=files, timeout=30)
    assert r.status_code == 400
    assert "detail" in r.json()


def test_analyze_gif_rejected():
    files = {"file": ("bad.gif", io.BytesIO(b"GIF89a"), "image/gif")}
    r = requests.post(f"{API}/analyze", files=files, timeout=30)
    assert r.status_code == 400


# ---- /api/files/{path} ----

def test_files_serve_image(analyzed):
    path = analyzed["product_image_path"]
    r = requests.get(f"{API}/files/{path}", timeout=60)
    assert r.status_code == 200
    ct = r.headers.get("Content-Type", "")
    assert ct.startswith("image/"), f"expected image content-type, got {ct}"
    assert len(r.content) > 100


# ---- /api/projects/{id}/generate ----

def _generate_payload(analysis, modifier=None):
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
        "language": "English",
        "natural_language": True,
        "modifier": modifier,
    }


def test_generate_success(analyzed):
    pid = analyzed["project_id"]
    payload = _generate_payload(analyzed["product_analysis"])
    r = requests.post(f"{API}/projects/{pid}/generate", json=payload, timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    mp = d.get("master_prompt", "")
    assert isinstance(mp, str) and len(mp) > 50
    # plain text, not JSON-wrapped
    assert not mp.strip().startswith("{"), "master_prompt appears to be JSON, expected plain text"
    up = mp.upper()
    # section headings expected
    found = sum(1 for s in ("VIDEO OVERVIEW", "PRODUCT", "SCENES", "NEGATIVE PROMPT",
                              "CREATOR", "LOCATION", "CAMERA", "AUDIO", "CTA") if s in up)
    assert found >= 6, f"Expected section keywords in master_prompt, found {found}. Prompt head: {mp[:400]}"
    # New iteration-4 requirement: explicit product consistency lock block
    assert "PRODUCT CONSISTENCY LOCK" in up, f"Missing PRODUCT CONSISTENCY LOCK section. Head: {mp[:500]}"
    assert "CHARACTER CONSISTENCY LOCK" in up, f"Missing CHARACTER CONSISTENCY LOCK section. Head: {mp[:500]}"
    assert "CHARACTER ANCHOR" in up, f"Missing CHARACTER ANCHOR section. Head: {mp[:500]}"
    assert isinstance(d.get("scenes"), list)
    assert isinstance(d.get("summary"), dict)


def test_generate_with_modifier(analyzed):
    pid = analyzed["project_id"]
    payload = _generate_payload(analyzed["product_analysis"], modifier="Make it more viral")
    r = requests.post(f"{API}/projects/{pid}/generate", json=payload, timeout=120)
    assert r.status_code == 200, r.text
    assert len(r.json().get("master_prompt", "")) > 50


def test_generate_invalid_project_id(analyzed):
    payload = _generate_payload(analyzed["product_analysis"])
    r = requests.post(f"{API}/projects/does-not-exist-xyz/generate", json=payload, timeout=30)
    assert r.status_code == 404
