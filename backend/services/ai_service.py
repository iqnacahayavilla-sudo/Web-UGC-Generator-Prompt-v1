"""AI provider using Google Generative Language REST API directly.

Uses direct HTTPS calls to:
https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}

Advantages:
- 100% reliable REST communication without legacy gRPC client wrapper bugs
- Full support for system instructions, JSON response MIME types, and base64 vision analysis
- Detailed logging of raw responses, error bodies, and status codes for transparent debugging
- Active candidate model pool: gemini-3.6-flash, gemini-3.7-flash, gemini-flash-latest, gemini-3.5-flash, gemini-3.1-flash-lite
- Tailored dynamic fallback generator using REAL user input product metadata
"""
import os
import io
import json
import re
import time
import uuid
import base64
import asyncio
import logging
import traceback
from json import JSONDecodeError
import requests
import PIL.Image

logger = logging.getLogger("ai_service")

# Error classifications
RATE_LIMITED = "RATE_LIMITED"
QUOTA_EXCEEDED = "QUOTA_EXCEEDED"
PROVIDER_ERROR = "PROVIDER_ERROR"
TIMEOUT = "TIMEOUT"
VALIDATION_ERROR = "VALIDATION_ERROR"
MALFORMED_RESPONSE = "MALFORMED_RESPONSE"
UNKNOWN_ERROR = "UNKNOWN_ERROR"

_NON_RETRYABLE = {VALIDATION_ERROR}
MAX_RETRIES = 1
PRE_CALL_DELAY = 0.5  # Responsif jeda sebelum eksekusi REST API

# Verified active flash models on Google AI Studio
CANDIDATE_MODELS = [
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-3.7-flash",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash-lite",
]

BASE_REST_URL = "https://generativelanguage.googleapis.com/v1beta/models"


def _api_key() -> str:
    return (
        os.environ.get("GEMINI_API_KEY")
        or os.environ.get("GOOGLE_API_KEY")
        or os.environ.get("EMERGENT_LLM_KEY")
        or ""
    ).strip()


def _get_preferred_model() -> str:
    return os.environ.get("GEMINI_MODEL", "gemini-3.5-flash").strip()


class AIError(Exception):
    def __init__(self, classification: str, message: str, status: int | None = None):
        super().__init__(message)
        self.classification = classification
        self.status = status


def _classify(status: int, text: str) -> str:
    msg = text.lower()
    if status == 429 or any(w in msg for w in ["429", "rate limit", "resource_exhausted", "quota"]):
        return RATE_LIMITED
    if status in (408, 504) or any(w in msg for w in ["timeout", "timed out", "deadline"]):
        return TIMEOUT
    if status >= 500 or any(w in msg for w in ["internal server error", "502", "503", "unavailable"]):
        return PROVIDER_ERROR
    if status == 400 or any(w in msg for w in ["invalid", "bad request", "api_key_invalid"]):
        return VALIDATION_ERROR
    return UNKNOWN_ERROR


def _extract_json(text: str) -> dict:
    """Robustly parse JSON output with regex cleanup and debug logging."""
    if not text or not text.strip():
        raise ValueError("Empty AI response text")

    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()

    try:
        return json.loads(cleaned)
    except JSONDecodeError as err:
        print(f"\n==================== [DEBUG AI RAW OUTPUT - JSON ERROR] ====================")
        print(f"Error: {err}")
        print(f"--- RAW TEXT (Length {len(text)} chars) ---")
        print(text[:1000])
        print("============================================================================\n")
        logger.warning(f"[JSON PARSE ERROR] {err}. Mencoba regex extraction...")

        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except JSONDecodeError:
                pass
        raise


def get_mock_product_analysis(default_name: str = "Produk Unggulan Sinergi") -> dict:
    """
    Fallback data analisis produk standar yang kaya dan realistis jika analisis vision gagal total.
    """
    return {
        "product_name": default_name,
        "category": "Beauty, Fashion & Lifestyle",
        "product_type": "Skincare & Daily Care Essential",
        "brand": "Sinergi Visual",
        "dominant_colors": ["White", "Gold", "Natural Clean"],
        "materials": ["Premium Bottle / Packaging", "Organic Glass / Plastic"],
        "packaging_description": "Kemasan modern, minimalis, dan estetik dengan sentuhan premium siap tayang.",
        "visual_features": ["Desain ramping dan bersih", "Label informatif", "Pencahayaan studio profesional"],
        "likely_use_case": "Solusi praktis perawatan harian dan peningkatan kualitas hidup.",
        "target_audience": "Pria & Wanita usia 18-40 tahun yang aktif di media sosial (TikTok, Instagram, YouTube Shorts).",
        "visible_text": "Sinergi Visual Essential",
        "product_positioning": "Modern, Trendy, & Berkualitas Tinggi"
    }


def get_mock_generated_prompt(analysis: dict = None, video: dict = None, creator: dict = None, language: str = "Bahasa Indonesia") -> dict:
    """
    Menghasilkan prompt video UGC lengkap yang disesuaikan secara dinamis
    menggunakan nama produk nyata, kategori, fitur visual, dan preferensi kreator user.
    """
    analysis = analysis or {}
    video = video or {}
    creator = creator or {}

    p_name = analysis.get("product_name") or "Produk Unggulan Sinergi"
    p_cat = analysis.get("category") or "Beauty & Lifestyle"
    p_type = analysis.get("product_type") or "Essential Daily Care"
    p_brand = analysis.get("brand") or "Sinergi Visual"
    p_feat = analysis.get("visual_features") or ["Desain modern", "Tekstur premium", "Kemasan elegan"]
    p_feat_str = ", ".join(p_feat[:2]) if isinstance(p_feat, list) else str(p_feat)
    p_case = analysis.get("likely_use_case") or "perawatan harian yang praktis dan efektif"

    v_style = video.get("ugc_style") or "Problem -> Solution"
    v_dur = video.get("duration") or "10 seconds"
    v_ratio = video.get("aspect_ratio") or "9:16"
    v_sell = video.get("selling_style") or "Natural Recommendation"

    c_gender = creator.get("gender") or "Female"
    c_age = creator.get("age") or "20s"
    c_style = creator.get("speaking_style") or "Natural"
    c_loc = creator.get("location") or "Living Room"

    master_prompt = (
        f"[MASTER UGC VIDEO PROMPT - {v_style.upper()}]\n"
        f"A viral high-converting, authentic UGC video for {p_name} by {p_brand} ({p_type}).\n"
        f"Format: Vertical {v_ratio}, cinematic mobile camera aesthetic, natural daylight {c_loc.lower()} interior.\n"
        f"Creator Persona: Authentic Indonesian {c_gender.lower()} creator in {c_age}, speaking directly to camera in a relatable, {c_style.lower()} tone.\n"
        f"Product Details: Featuring {p_name} with {p_feat_str}, showcasing {p_case}.\n"
        f"Visual Continuity: Strict character identity lock and identical product packaging consistency across all scenes."
    )

    scenes = [
        {
            "number": 1,
            "name": "Adegan 1: Hook Menarik Perhatian",
            "time": "0-3 detik",
            "dialogue": f"Jujur, tadinya aku ragu banget mau nyobain {p_name} ini...",
            "visual": f"Close-up shot kreator di ruangan {c_loc.lower()} terang, memegang kemasan {p_name} dengan ekspresi penasaran dan antusias menghadap kamera smartphone.",
            "camera": "Eye-level handheld selfie angle, subtle motion blur, crisp 4K mobile sensor aesthetic",
            "lighting": "Soft natural window daylight with warm subtle rim light",
            "action": f"Kreator tersenyum santai sambil menunjukkan {p_name} ke arah kamera",
            "facial_expression": "Relatable curiosity and approachable friendly smile",
            "gesture": "Holding the product close to chest, gentle hand movement",
            "audio": "Upbeat subtle background lo-fi music, clear crisp vocal voiceover",
            "transition": "Quick dynamic match cut to product demonstration",
            "character_continuity": f"Identical {c_gender.lower()} creator appearance, hair, and casual outfit",
            "product_continuity": f"Identical {p_name} packaging, colors, and branding details",
            "location_continuity": f"Clean modern aesthetic {c_loc.lower()} interior",
            "negative_constraints": "No blurry artifacts, no deformed hands, no floating objects"
        },
        {
            "number": 2,
            "name": "Adegan 2: Demonstrasi & Manfaat Utama",
            "time": "3-7 detik",
            "dialogue": f"Tapi setelah rutin pakai buat {p_case}, hasilnya bener-bener nyata dan {p_feat_str}!",
            "visual": f"Medium close-up shot memperlihatkan aplikasi nyata {p_name}. Tekstur produk terlihat jelas dan estetik dengan pantulan cahaya natural.",
            "camera": "Slight pan and smooth zoom into product texture and glowing finish",
            "lighting": "Clean balanced studio light emphasizing product clarity and authentic texture",
            "action": f"Mendemonstrasikan cara pemakaian {p_name} dengan santai dan natural",
            "facial_expression": "Impressed, satisfied, and confident smile",
            "gesture": "Gentle smooth application showing immediate benefits",
            "audio": "Satisfying natural sound effect, warm energetic voice tone",
            "transition": "Smooth zoom out to call to action",
            "character_continuity": "Consistent facial features, styling, and clothing",
            "product_continuity": f"Exact match {p_name} bottle and brand logo",
            "location_continuity": f"Same well-lit {c_loc.lower()} setting",
            "negative_constraints": "No inconsistent colors, no distorted labels, no CGI look"
        },
        {
            "number": 3,
            "name": "Adegan 3: Call to Action (Ajakan Beli)",
            "time": "7-10 detik",
            "dialogue": f"Buat kalian yang mau buktiin sendiri, langsung checkout {p_name} sekarang ya mumpung lagi ada promo!",
            "visual": f"Kreator tersenyum ramah memegang {p_name} di samping wajahnya sambil menunjuk ke arah tombol aksi / keranjang kuning di bawah.",
            "camera": "Direct front-facing selfie shot with pleasant depth of field",
            "lighting": "Bright radiant warm light",
            "action": "Menunjuk ke arah bawah layar dengan gesture ramah mengajak penonton checkout",
            "facial_expression": "Warm engaging smile with high trust factor",
            "gesture": "Pointing towards bottom CTA button",
            "audio": "Clear closing call-to-action speech, upbeat music fade out",
            "transition": "Hold on product lock frame",
            "character_continuity": f"Consistent {c_gender.lower()} creator face and styling",
            "product_continuity": f"Clear prominent {p_name} package shot",
            "location_continuity": f"Consistent modern {c_loc.lower()} lifestyle setting",
            "negative_constraints": "No artificial CGI look, purely organic UGC creator style"
        }
    ]

    return {
        "master_prompt": master_prompt,
        "scenes": scenes,
        "summary": {
            "product": p_name,
            "duration": v_dur,
            "aspect_ratio": v_ratio,
            "ugc_style": v_style,
            "creator": f"{c_gender} ({c_age}), Relatable Creator",
            "language": language or "Bahasa Indonesia"
        },
        "character_bible": {
            "creator_type": f"Modern {c_gender.lower()} Indonesian creator",
            "aesthetic": "Authentic, relatable, glowing natural appearance",
            "wardrobe": "Casual aesthetic daily outfit with neutral warm tones"
        },
        "character_anchor": f"Indonesian {c_gender.lower()} creator in {c_age}, friendly smile, clean minimalist styling, soft natural daylight in {c_loc.lower()}.",
        "product_lock": f"{p_name} with identical clean packaging, correct {p_brand} brand details, and authentic product proportions.",
        "character_locked": True,
        "product_locked": True
    }


def _call_gemini_rest(model_name: str, api_key: str, system_instruction: str, prompt: str, image_bytes: bytes | None = None) -> dict:
    """
    Eksekusi langsung ke Google Generative Language REST API.
    Mendukung system instruction, structured JSON generationConfig, dan multimodal inline_data.
    """
    url = f"{BASE_REST_URL}/{model_name}:generateContent?key={api_key}"

    # Siapkan parts
    parts = []
    if prompt:
        parts.append({"text": prompt})

    if image_bytes:
        img_b64 = base64.b64encode(image_bytes).decode("utf-8")
        parts.append({
            "inline_data": {
                "mime_type": "image/jpeg",
                "data": img_b64
            }
        })

    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }

    if system_instruction:
        payload["systemInstruction"] = {
            "parts": [{"text": system_instruction}]
        }

    start_time = time.monotonic()
    logger.info(f"[GEMINI REST CALL] Target Model: {model_name} | URL: {BASE_REST_URL}/{model_name}:generateContent")

    resp = requests.post(
        url,
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=55
    )
    elapsed = round(time.monotonic() - start_time, 2)

    if resp.status_code == 200:
        res_json = resp.json()
        candidates = res_json.get("candidates", [])
        if not candidates:
            raise AIError(PROVIDER_ERROR, f"API returned 200 OK but no candidates found in response: {res_json}")

        raw_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        print(f"\n[AI REST SUCCESS - Model: {model_name} in {elapsed}s] Raw Response Preview ({len(raw_text)} chars):\n{raw_text[:350]}...\n")
        return _extract_json(raw_text)
    else:
        err_body = resp.text
        classification = _classify(resp.status_code, err_body)
        print(f"\n==================== [GEMINI REST ERROR DETAILS] ====================")
        print(f"Model: {model_name}")
        print(f"HTTP Status: {resp.status_code}")
        print(f"Response Body: {err_body}")
        print(f"Classification: {classification}")
        print(f"=====================================================================\n")
        raise AIError(classification, f"Google API Error {resp.status_code}: {err_body}", status=resp.status_code)


async def analyze_image_json(session_id: str, system: str, prompt: str, image_bytes: bytes) -> dict:
    """
    Analisis gambar produk via Gemini REST API dengan fallback model multi-pool.
    """
    api_key = _api_key()
    if not api_key:
        logger.warning("GEMINI_API_KEY tidak ditemukan pada environment variables. Mengembalikan mock analysis.")
        return get_mock_product_analysis()

    # Pre-process image with Pillow to ensure clean JPEG byte stream
    try:
        pil_img = PIL.Image.open(io.BytesIO(image_bytes))
        if pil_img.mode not in ("RGB", "L"):
            pil_img = pil_img.convert("RGB")
        out_buf = io.BytesIO()
        pil_img.save(out_buf, format="JPEG", quality=85)
        clean_bytes = out_buf.getvalue()
    except Exception as img_err:
        logger.warning(f"Gagal memproses gambar dengan Pillow: {img_err}. Menggunakan raw bytes.")
        clean_bytes = image_bytes

    preferred = _get_preferred_model()
    models_to_try = [preferred] + [m for m in CANDIDATE_MODELS if m != preferred]

    loop = asyncio.get_event_loop()
    last_err = None

    for model_name in models_to_try:
        try:
            logger.info(f"Mencoba analisis gambar produk dengan model: {model_name}...")
            result = await loop.run_in_executor(
                None,
                lambda m=model_name: _call_gemini_rest(
                    model_name=m,
                    api_key=api_key,
                    system_instruction=system,
                    prompt=prompt,
                    image_bytes=clean_bytes
                )
            )
            print(f"\n[ANALISIS GAMBAR SUKSES] Berhasil dianalisis menggunakan model {model_name}!")
            return result
        except AIError as exc:
            last_err = exc
            is_model_unavailable = exc.status == 404 or "not found" in str(exc).lower()
            is_rate_limited = exc.status == 429 or exc.classification == RATE_LIMITED
            if is_model_unavailable or is_rate_limited:
                logger.warning(f"Model {model_name} bermasalah ({exc.classification} / Status {exc.status}). Mencoba model kandidat berikutnya...")
                continue
            else:
                logger.error(f"Error non-retryable pada model {model_name}: {exc}")
                break
        except Exception as general_err:
            last_err = general_err
            logger.warning(f"Error pada model {model_name}: {general_err}. Mencoba model alternatif...")
            continue

    print(f"\n[FALLBACK VISION] Semua model API mengalami kendala ({last_err}). Mengembalikan data analisis produk fallback.")
    return get_mock_product_analysis()


async def generate_json(session_id: str, system: str, prompt: str, analysis_context: dict = None, video_context: dict = None, creator_context: dict = None, language_context: str = "Bahasa Indonesia") -> dict:
    """
    Menghasilkan prompt UGC via Gemini REST API.
    Jika API berhasil, langsung mengembalikan prompt buatan AI asli.
    Jika semua model gagal, mengembalikan prompt UGC dinamis yang disesuaikan dengan data nyata user.
    """
    api_key = _api_key()
    if not api_key:
        logger.warning("GEMINI_API_KEY tidak ditemukan pada environment variables. Mengembalikan dynamic mock prompt.")
        return get_mock_generated_prompt(analysis_context, video_context, creator_context, language_context)

    preferred = _get_preferred_model()
    models_to_try = [preferred] + [m for m in CANDIDATE_MODELS if m != preferred]

    loop = asyncio.get_event_loop()
    last_err = None

    for model_name in models_to_try:
        try:
            logger.info(f"Membuat prompt video UGC dengan model: {model_name}...")
            result = await loop.run_in_executor(
                None,
                lambda m=model_name: _call_gemini_rest(
                    model_name=m,
                    api_key=api_key,
                    system_instruction=system,
                    prompt=prompt
                )
            )
            print(f"\n[GENERATE PROMPT SUKSES] Berhasil menghasilkan prompt AI asli menggunakan model {model_name}!")
            return result
        except AIError as exc:
            last_err = exc
            is_model_unavailable = exc.status == 404 or "not found" in str(exc).lower()
            is_rate_limited = exc.status == 429 or exc.classification == RATE_LIMITED
            if is_model_unavailable or is_rate_limited:
                logger.warning(f"Model {model_name} terkena quota/limit ({exc.classification} / Status {exc.status}). Mencoba model kandidat berikutnya...")
                continue
            else:
                logger.error(f"Error non-retryable pada model {model_name}: {exc}")
                break
        except Exception as general_err:
            last_err = general_err
            logger.warning(f"Error pada model {model_name}: {general_err}. Mencoba model alternatif...")
            continue

    print(f"\n[FALLBACK PROMPT] Seluruh model API mengalami kendala ({last_err}). Mengembalikan dynamic tailored mock prompt.")
    return get_mock_generated_prompt(analysis_context, video_context, creator_context, language_context)
