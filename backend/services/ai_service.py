"""OpenAI AI Provider Service for Sinergi Visual UGC Generator Prompt.

Uses OpenAI Chat Completions REST API directly:
https://api.openai.com/v1/chat/completions

Features:
- Exclusive OpenAI GPT-4o-mini engine for Vision Analysis and UGC Video Prompt Generation
- Multimodal vision processing via JPEG base64 Data URLs
- Native JSON Object output format (response_format: {"type": "json_object"})
- Strict error classification (AUTH, RATE_LIMITED, TIMEOUT, PROVIDER_ERROR, VALIDATION_ERROR)
- Automatic retry logic for transient errors (429, 5xx, timeouts)
- Server-side only key security with transparent, sanitized logging
"""
import os
import io
import json
import re
import time
import base64
import asyncio
import logging
import traceback
from json import JSONDecodeError
from pathlib import Path
import requests
import PIL.Image

# Load local environment if available
try:
    from dotenv import load_dotenv
    env_paths = [
        Path.cwd() / "backend" / ".env",
        Path.cwd() / ".env",
        Path(__file__).parent.parent / ".env"
    ]
    for p in env_paths:
        if p.exists():
            load_dotenv(p)
except Exception:
    pass

logger = logging.getLogger("ai_service")

# Error classifications
OPENAI_AUTH_ERROR = "OPENAI_AUTH_ERROR"
OPENAI_RATE_LIMITED = "OPENAI_RATE_LIMITED"
OPENAI_PROVIDER_ERROR = "OPENAI_PROVIDER_ERROR"
OPENAI_TIMEOUT = "OPENAI_TIMEOUT"
OPENAI_VALIDATION_ERROR = "OPENAI_VALIDATION_ERROR"
OPENAI_MALFORMED_RESPONSE = "OPENAI_MALFORMED_RESPONSE"
OPENAI_UNKNOWN_ERROR = "OPENAI_UNKNOWN_ERROR"

# Legacy aliases for compatibility
AUTH_ERROR = OPENAI_AUTH_ERROR
RATE_LIMITED = OPENAI_RATE_LIMITED
QUOTA_EXCEEDED = OPENAI_RATE_LIMITED
PROVIDER_ERROR = OPENAI_PROVIDER_ERROR
TIMEOUT = OPENAI_TIMEOUT
VALIDATION_ERROR = OPENAI_VALIDATION_ERROR
MALFORMED_RESPONSE = OPENAI_MALFORMED_RESPONSE
UNKNOWN_ERROR = OPENAI_UNKNOWN_ERROR

OPENAI_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions"


def _openai_api_key() -> str:
    """Read OPENAI_API_KEY strictly from environment variable."""
    return os.environ.get("OPENAI_API_KEY", "").strip()


def _openai_model() -> str:
    """Default model is gpt-4o-mini unless overridden by OPENAI_MODEL."""
    return os.environ.get("OPENAI_MODEL", "gpt-4o-mini").strip()


def is_openai_configured() -> bool:
    """Check if OpenAI API key is configured without exposing secret values."""
    key = _openai_api_key()
    return bool(key and len(key) > 5)


class AIError(Exception):
    def __init__(self, classification: str, message: str, status: int | None = None):
        super().__init__(message)
        self.classification = classification
        self.status = status


def _classify(status: int, text: str) -> str:
    msg = text.lower()
    if status == 401 or "invalid_api_key" in msg or "authentication" in msg:
        return OPENAI_AUTH_ERROR
    if status == 429 or any(w in msg for w in ["429", "rate limit", "quota", "insufficient_quota", "exceeded your current quota"]):
        return OPENAI_RATE_LIMITED
    if status in (408, 504) or any(w in msg for w in ["timeout", "timed out", "deadline"]):
        return OPENAI_TIMEOUT
    if status >= 500 or any(w in msg for w in ["internal server error", "502", "503", "service unavailable"]):
        return OPENAI_PROVIDER_ERROR
    if status == 400 or any(w in msg for w in ["bad request", "invalid_request_error"]):
        return OPENAI_VALIDATION_ERROR
    return OPENAI_UNKNOWN_ERROR


def _extract_json(text: str) -> dict:
    """Robustly parse JSON output with regex cleanup and debug logging."""
    if not text or not text.strip():
        raise AIError(OPENAI_MALFORMED_RESPONSE, "Empty AI response text received.", status=502)

    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()

    try:
        return json.loads(cleaned)
    except JSONDecodeError as err:
        logger.warning(f"[JSON PARSE ERROR] {err}. Attempting regex extraction...")
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except JSONDecodeError:
                pass
        raise AIError(OPENAI_MALFORMED_RESPONSE, f"Failed to parse JSON response from OpenAI: {err}", status=502)


def _call_openai_rest(model_name: str, api_key: str, system_instruction: str, prompt: str, image_bytes: bytes | None = None, max_retries: int = 2) -> dict:
    """
    Execute HTTP POST request to OpenAI Chat Completions API with exponential backoff retry for transient errors.
    """
    if not api_key:
        raise AIError(OPENAI_AUTH_ERROR, "OPENAI_API_KEY belum dikonfigurasi di environment Vercel.", status=500)

    messages = []
    if system_instruction:
        messages.append({"role": "system", "content": system_instruction})

    if image_bytes:
        img_b64 = base64.b64encode(image_bytes).decode("utf-8")
        user_content = [
            {"type": "text", "text": prompt or "Analisis foto produk ini dan kembalikan format JSON sesuai instruksi."},
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{img_b64}"
                }
            }
        ]
        messages.append({"role": "user", "content": user_content})
    else:
        messages.append({"role": "user", "content": prompt or ""})

    payload = {
        "model": model_name or "gpt-4o-mini",
        "response_format": {"type": "json_object"},
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 4096
    }

    last_error = None
    for attempt in range(max_retries + 1):
        start_time = time.monotonic()
        logger.info(f"[AI] OpenAI request started model={model_name} attempt={attempt + 1}/{max_retries + 1} has_image={bool(image_bytes)}")

        try:
            resp = requests.post(
                OPENAI_COMPLETIONS_URL,
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}"
                },
                timeout=55
            )
            elapsed = round(time.monotonic() - start_time, 2)
            logger.info(f"[AI] OpenAI response received status={resp.status_code} in {elapsed}s")

            if resp.status_code == 200:
                res_json = resp.json()
                choices = res_json.get("choices", [])
                if not choices:
                    raise AIError(OPENAI_PROVIDER_ERROR, f"OpenAI returned 200 OK but choices is empty: {res_json}", status=502)

                raw_text = choices[0].get("message", {}).get("content", "")
                return _extract_json(raw_text)

            err_body = resp.text
            classification = _classify(resp.status_code, err_body)
            logger.warning(f"[AI] OpenAI request failed status={resp.status_code} classification={classification}")

            # Do not retry on Auth (401) or Bad Request (400)
            if resp.status_code in (400, 401, 403, 404):
                if resp.status_code == 401:
                    user_msg = "OpenAI authentication failed. Periksa OPENAI_API_KEY di Vercel / server."
                else:
                    user_msg = f"OpenAI API Error {resp.status_code}: {err_body}"
                raise AIError(classification, user_msg, status=resp.status_code)

            # For retryable errors (429, 500, 502, 503, 504), wait before retry
            last_error = AIError(classification, f"OpenAI Error {resp.status_code}: {err_body}", status=resp.status_code)
            if attempt < max_retries:
                backoff_secs = (attempt + 1) * 1.5
                logger.info(f"[AI] Retrying OpenAI call in {backoff_secs}s...")
                time.sleep(backoff_secs)

        except requests.exceptions.Timeout as t_err:
            logger.warning(f"[AI] OpenAI request timeout on attempt {attempt + 1}: {t_err}")
            last_error = AIError(OPENAI_TIMEOUT, "OpenAI request timed out. Silakan coba beberapa saat lagi.", status=504)
            if attempt < max_retries:
                time.sleep(1.5)
        except requests.exceptions.RequestException as req_err:
            logger.warning(f"[AI] OpenAI request connection error on attempt {attempt + 1}: {req_err}")
            last_error = AIError(OPENAI_PROVIDER_ERROR, f"Koneksi ke OpenAI API gagal: {req_err}", status=502)
            if attempt < max_retries:
                time.sleep(1.5)

    if last_error:
        raise last_error
    raise AIError(OPENAI_PROVIDER_ERROR, "OpenAI request failed after retries.", status=502)


async def analyze_image_json(session_id: str, system: str, prompt: str, image_bytes: bytes) -> dict:
    """
    Analyze product image via OpenAI (gpt-4o-mini Vision) as sole provider.
    """
    # Pre-process image with Pillow to ensure clean JPEG byte stream
    try:
        pil_img = PIL.Image.open(io.BytesIO(image_bytes))
        if pil_img.mode not in ("RGB", "L"):
            pil_img = pil_img.convert("RGB")
        # Resize if overly large (> 2048px on max side) while maintaining aspect ratio and quality
        max_dim = 2048
        if max(pil_img.size) > max_dim:
            pil_img.thumbnail((max_dim, max_dim), PIL.Image.Resampling.LANCZOS)
        out_buf = io.BytesIO()
        pil_img.save(out_buf, format="JPEG", quality=85)
        clean_bytes = out_buf.getvalue()
    except Exception as img_err:
        logger.warning(f"[AI] Pillow image processing notice: {img_err}. Using original bytes.")
        clean_bytes = image_bytes

    loop = asyncio.get_event_loop()
    openai_key = _openai_api_key()
    openai_model_name = _openai_model()

    if not openai_key:
        err_msg = "OPENAI_API_KEY belum dikonfigurasi di environment Vercel."
        logger.error(f"[AI CONFIG ERROR] {err_msg}")
        raise AIError(OPENAI_AUTH_ERROR, err_msg, status=500)

    result = await loop.run_in_executor(
        None,
        lambda: _call_openai_rest(
            model_name=openai_model_name,
            api_key=openai_key,
            system_instruction=system,
            prompt=prompt,
            image_bytes=clean_bytes
        )
    )
    logger.info(f"[AI] Product image analysis successful with model {openai_model_name}")
    return result


async def generate_json(session_id: str, system: str, prompt: str, analysis_context: dict = None, video_context: dict = None, creator_context: dict = None, language_context: str = "Bahasa Indonesia") -> dict:
    """
    Generate UGC video prompt via OpenAI (gpt-4o-mini) as sole provider.
    """
    loop = asyncio.get_event_loop()
    openai_key = _openai_api_key()
    openai_model_name = _openai_model()

    if not openai_key:
        err_msg = "OPENAI_API_KEY belum dikonfigurasi di environment Vercel."
        logger.error(f"[AI CONFIG ERROR] {err_msg}")
        raise AIError(OPENAI_AUTH_ERROR, err_msg, status=500)

    result = await loop.run_in_executor(
        None,
        lambda: _call_openai_rest(
            model_name=openai_model_name,
            api_key=openai_key,
            system_instruction=system,
            prompt=prompt
        )
    )
    logger.info(f"[AI] UGC prompt generation successful with model {openai_model_name}")
    return result


# Mock helper functions kept exclusively for unit testing / development mocks
def get_mock_product_analysis(default_name: str = "Produk Unggulan") -> dict:
    """Mock helper used strictly for testing."""
    return {
        "product_name": default_name,
        "category": "Lifestyle, Home & Daily Essentials",
        "product_type": "Daily Essential Product",
        "brand": "",
        "dominant_colors": ["Neutral", "Modern Aesthetic"],
        "materials": ["Durable High Quality Material"],
        "packaging_description": "Desain bodi produk modern, minimalis, dan fungsional siap digunakan.",
        "visual_features": ["Desain ergonomis", "Finishing rapi dan elegan", "Tampilan estetik modern"],
        "likely_use_case": "Mendukung kenyamanan, kepraktisan, dan produktivitas aktivitas harian.",
        "target_audience": "Pria & Wanita usia produktif yang aktif di media sosial dan mengutamakan gaya hidup praktis.",
        "visible_text": "",
        "product_positioning": "Modern, Fungsional & Berkualitas Tinggi"
    }


def get_mock_generated_prompt(analysis: dict = None, video: dict = None, creator: dict = None, language: str = "Bahasa Indonesia") -> dict:
    """Mock helper used strictly for testing."""
    analysis = analysis or {}
    video = video or {}
    creator = creator or {}

    p_name = analysis.get("product_name") or "Produk Pilihan"
    p_cat = analysis.get("category") or "Lifestyle & Daily Essentials"
    p_type = analysis.get("product_type") or "Produk Kebutuhan Harian"
    p_brand = analysis.get("brand") or ""
    brand_label = f" by {p_brand}" if p_brand else ""

    v_style = video.get("ugc_style") or "Problem -> Solution"
    v_dur = video.get("duration") or "30 seconds"
    v_ratio = video.get("aspect_ratio") or "9:16"

    c_gender = creator.get("gender") or "Female"
    c_age = creator.get("age") or "20s"
    c_loc = creator.get("location") or "Living Room"

    master_prompt = (
        f"[MASTER UGC VIDEO PROMPT - {v_style.upper()} - {v_dur}]\n"
        f"A viral, high-converting authentic UGC video for {p_name}{brand_label} ({p_type} / {p_cat}).\n"
        f"Format: Vertical {v_ratio}, {v_dur}, cinematic mobile camera aesthetic, natural daylight {c_loc.lower()} interior.\n"
        f"Creator Persona: Authentic Indonesian {c_gender.lower()} creator in {c_age}.\n"
    )

    scenes = [
        {
            "number": 1,
            "name": "Adegan 1: Hook Penasaran & Pain Point",
            "time": "0-4 detik",
            "dialogue": f"Kalian sering ngerasa butuh {p_name} yang beneran praktis?",
            "visual": f"Close-up shot kreator di {c_loc.lower()} memegang {p_name}.",
            "camera": "Handheld selfie camera, eye level",
            "lighting": "Soft natural daylight",
            "action": f"Kreator berbicara ekspresif sambil memegang {p_name}",
            "facial_expression": "Relatable curiosity",
            "gesture": "Pointing to product",
            "audio": "Clear natural vocal",
            "transition": "Fast whip pan",
            "character_continuity": f"Identical {c_gender.lower()} creator in {c_age}",
            "product_continuity": f"Identical {p_name}",
            "location_continuity": f"Consistent modern {c_loc.lower()}",
            "negative_constraints": "No CGI look"
        }
    ]

    return {
        "master_prompt": master_prompt,
        "scenes": scenes,
        "summary": {"headline": f"Viral UGC for {p_name}", "target_audience": "Digital Consumers"},
        "character_bible": {"name": f"Indonesian {c_gender} Creator"},
        "character_anchor": f"Indonesian {c_gender} creator in {c_age}",
        "product_lock": f"{p_name} exact appearance",
        "character_locked": True,
        "product_locked": True
    }
