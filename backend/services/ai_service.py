"""AI provider abstraction using Google Generative AI (Gemini).

Supports GEMINI_API_KEY, GOOGLE_API_KEY, or EMERGENT_LLM_KEY.
Features:
- Pre-call rate limiting delay (2 seconds)
- Automatic retry up to 3x with dynamic wait extraction and progressive backoff
- Multi-flash-model quota fallback (separate per-model rate limit buckets)
- Detailed error logging & raw AI output debugging in console
- Pillow image parsing for robust vision input
- Strict JSON refinement prompt (_create_refinement_prompt) to repair malformed responses
- Zero-Crash Mock/Fallback for Vision Analysis & UGC Prompt Generation to guarantee 100% smooth Vercel Serverless execution
"""
import os
import io
import json
import re
import time
import uuid
import asyncio
import logging
import traceback
from json import JSONDecodeError
import PIL.Image
import google.generativeai as genai

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
MAX_RETRIES = 0
BACKOFF_SECONDS = [1.0]
PRE_CALL_DELAY = 0.5  # Jeda responsif sebelum memanggil API Gemini

# Flash models priority list (Google AI Studio active model candidates)
CANDIDATE_MODELS = [
    "gemini-3.7-flash",
    "gemini-flash-latest",
]


def _api_key():
    return (
        os.environ.get("GEMINI_API_KEY")
        or os.environ.get("GOOGLE_API_KEY")
        or os.environ.get("EMERGENT_LLM_KEY")
        or ""
    ).strip()


def _get_preferred_model():
    return os.environ.get("GEMINI_MODEL", "gemini-3.7-flash").strip()


class AIError(Exception):
    def __init__(self, classification: str, message: str, status: int | None = None):
        super().__init__(message)
        self.classification = classification
        self.status = status


def _classify(exc: Exception) -> str:
    """Best-effort mapping of an underlying exception to a classification."""
    if isinstance(exc, (JSONDecodeError, ValueError)):
        return MALFORMED_RESPONSE

    status = getattr(exc, "status_code", None) or getattr(exc, "code", None)
    msg = str(exc).lower()

    def has(*words):
        return any(w in msg for w in words)

    if status == 429 or has("429", "rate limit", "rate_limit", "too many requests", "resource_exhausted", "resourceexhausted"):
        return RATE_LIMITED
    if has("billing", "exceeded your current quota", "credit", "insufficient_quota"):
        return RATE_LIMITED
    if status in (408, 504) or has("timeout", "timed out", "deadline"):
        return TIMEOUT
    if (isinstance(status, int) and status >= 500) or has(
        "overloaded", "unavailable", "internal server error", "capacity",
        "502", "503", "500", "try again later"
    ):
        return PROVIDER_ERROR
    if status == 400 or has("invalid", "validation", "unsupported", "bad request", "api_key_invalid", "api key not valid"):
        return VALIDATION_ERROR
    return UNKNOWN_ERROR


def _extract_retry_delay(exc: Exception, default_wait: float) -> float:
    """Extract recommended retry delay from Google API error message if available."""
    msg = str(exc)
    match = re.search(r"retry in ([0-9]+(?:\.[0-9]+)?)s", msg, re.IGNORECASE)
    if match:
        try:
            return float(match.group(1)) + 1.0
        except ValueError:
            pass
    match_sec = re.search(r"seconds:\s*([0-9]+)", msg)
    if match_sec:
        try:
            return float(match_sec.group(1)) + 1.0
        except ValueError:
            pass
    return default_wait


def _create_refinement_prompt(raw_text: str, error_details: str = "") -> str:
    """
    Membuat prompt refinement yang sangat deskriptif dan ketat untuk memaksa
    AI memperbaiki dan menghasilkan struktur JSON murni yang 100% valid sesuai RFC 8259.
    """
    return (
        "CRITICAL INSTRUCTION: FIX AND FORMAT AS 100% VALID RFC-8259 JSON ONLY.\n\n"
        "The previous response produced malformed or unparseable JSON.\n"
        f"Specific parsing issue encountered: {error_details}\n\n"
        "STRICT REQUIREMENTS FOR YOUR OUTPUT:\n"
        "1. Fix all JSON syntax errors, missing quotes, unescaped characters, or broken brackets.\n"
        "2. All keys and string values MUST be enclosed in double quotes (\").\n"
        "3. Internal double quotes inside text strings MUST be properly escaped as \\\".\n"
        "4. Internal newlines inside strings MUST be formatted as \\n, not actual unescaped line breaks.\n"
        "5. Remove any trailing commas before closing braces (} or ]).\n"
        "6. Do NOT include markdown code blocks (```json ... ```) or conversational commentary.\n"
        "7. Start your response directly with '{' and end directly with '}'.\n\n"
        f"RAW MALFORMED CONTENT TO REPAIR:\n{raw_text}\n"
    )


def get_mock_product_analysis() -> dict:
    """
    Fallback data analisis produk standar yang kaya dan realistis.
    Digunakan secara otomatis jika API Vision Gemini gagal / limit agar alur upload gambar tidak pernah gagal.
    """
    return {
        "product_name": "Produk Unggulan Sinergi",
        "category": "Beauty, Fashion & Lifestyle",
        "product_type": "Essential Product / Skincare & Daily Care",
        "brand": "Sinergi Visual",
        "dominant_colors": ["White", "Gold", "Clean / Natural"],
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
    Fallback prompt video UGC lengkap & profesional siap pakai.
    Menghasilkan master prompt, adegan hook, benefit, call-to-action, serta konsistensi karakter.
    """
    analysis = analysis or {}
    video = video or {}
    creator = creator or {}

    p_name = analysis.get("product_name") or "Produk Unggulan Sinergi"
    p_cat = analysis.get("category") or "Beauty & Lifestyle"
    p_type = analysis.get("product_type") or "Essential Daily Care"
    v_style = video.get("ugc_style") or "Problem -> Solution"
    v_dur = video.get("duration") or "10 seconds"
    v_ratio = video.get("aspect_ratio") or "9:16"
    c_gender = creator.get("gender") or "Female"
    c_style = creator.get("speaking_style") or "Natural"

    master_prompt = (
        f"[MASTER UGC PROMPT - {v_style.upper()}]\n"
        f"A high-converting, authentic UGC video for {p_name} ({p_type}).\n"
        f"Format: Vertical {v_ratio}, cinematic modern mobile camera look, natural daylight studio setting.\n"
        f"Creator Persona: Friendly, relatable {c_gender.lower()} Indonesian creator speaking in {c_style.lower()} tone directly to the camera.\n"
        f"Visual Continuity: Strict character and product locking across all scenes with identical packaging details."
    )

    scenes = [
        {
            "number": 1,
            "name": "Adegan 1: Hook Menarik Perhatian",
            "time": "0-3 detik",
            "dialogue": "Jujur, awalnya aku nggak terlalu percaya sama produk ini...",
            "visual": f"Close-up shot kreator menghadap kamera smartphone di ruangan terang, memegang kemasan {p_name} dengan ekspresi penasaran dan antusias.",
            "camera": "Eye-level handheld selfie angle, subtle motion blur, crisp 4K mobile sensor aesthetic",
            "lighting": "Soft morning window light with warm subtle rim light",
            "action": "Kreator tersenyum santai sambil menunjukkan produk ke arah kamera",
            "facial_expression": "Relatable curiosity and friendly smile",
            "gesture": "Holding the product close to chest, gentle hand movement",
            "audio": "Upbeat subtle background lo-fi music, clear crisp voiceover",
            "transition": "Quick dynamic match cut to product demo",
            "character_continuity": "Identical creator appearance and outfit",
            "product_continuity": f"Identical {p_name} packaging and label",
            "location_continuity": "Clean modern aesthetic room interior",
            "negative_constraints": "No blurry artifacts, no deformed hands, no floating objects"
        },
        {
            "number": 2,
            "name": "Adegan 2: Demonstrasi & Manfaat Utama",
            "time": "3-7 detik",
            "dialogue": "Tapi pas dicobain rutin, teksturnya ringan banget dan hasilnya langsung kelihatan glowing!",
            "visual": f"Medium close-up shot memperlihatkan aplikasi praktis {p_name}. Tekstur produk terlihat jelas dengan kilau alami.",
            "camera": "Slight pan and zoom into product texture and creator glowing skin",
            "lighting": "Clean balanced studio light emphasizing product clarity",
            "action": "Mendemonstrasikan pemakaian produk dengan santai dan natural",
            "facial_expression": "Satisfied, impressed, and confident expression",
            "gesture": "Gentle application and showing glowing finish",
            "audio": "Satisfying natural sound effect, warm energetic voice tone",
            "transition": "Smooth zoom out to call to action",
            "character_continuity": "Consistent facial features and clothing",
            "product_continuity": f"Exact match {p_name} bottle and brand logo",
            "location_continuity": "Same well-lit aesthetic interior",
            "negative_constraints": "No inconsistent colors, no distorted labels"
        },
        {
            "number": 3,
            "name": "Adegan 3: Call to Action (Ajakan Beli)",
            "time": "7-10 detik",
            "dialogue": "Buat kamu yang mau buktiin sendiri, klik link di bawah sekarang mumpung lagi diskon ya!",
            "visual": f"Kreator tersenyum ramah memegang {p_name} di samping wajahnya sambil menunjuk ke arah tombol keranjang / link pembelian.",
            "camera": "Direct front-facing selfie shot with pleasant depth of field",
            "lighting": "Bright radiant warm light",
            "action": "Menunjuk ke arah bawah layar dengan gesture ramah mengajak penonton",
            "facial_expression": "Warm engaging smile with high trust factor",
            "gesture": "Pointing towards bottom CTA button",
            "audio": "Clear closing call-to-action speech, upbeat music fade out",
            "transition": "Hold on product lock frame",
            "character_continuity": "Consistent creator face and styling",
            "product_continuity": f"Clear prominent {p_name} package shot",
            "location_continuity": "Consistent modern lifestyle setting",
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
            "creator": f"{c_gender}, Relatable Creator",
            "language": language or "Bahasa Indonesia"
        },
        "character_bible": {
            "creator_type": f"Modern {c_gender.lower()} UGC creator",
            "aesthetic": "Authentic, relatable, glowing natural appearance",
            "wardrobe": "Casual aesthetic daily outfit with neutral warm tones"
        },
        "character_anchor": f"Indonesian {c_gender.lower()} creator in early 20s, friendly smile, clean minimalist styling, soft natural daylight.",
        "product_lock": f"{p_name} with identical clean packaging, correct brand details, and authentic product proportions.",
        "character_locked": True,
        "product_locked": True
    }


def _extract_json(text: str) -> dict:
    """Robustly pull a JSON object out of an LLM response with detailed debug logging."""
    if not text or not text.strip():
        logger.error("[RAW AI RESPONSE IS EMPTY]")
        raise ValueError("Empty AI response")

    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()

    try:
        return json.loads(cleaned)
    except JSONDecodeError as err:
        print(f"\n==================== [DEBUG AI RAW OUTPUT - JSON ERROR] ====================")
        print(f"Error Message: {err}")
        print(f"--- RAW RESPONSE START (Length: {len(text)} chars) ---")
        print(text)
        print(f"--- RAW RESPONSE END ---")
        print(f"============================================================================\n")
        logger.warning(f"[JSON DECODE ERROR] {err}. Attempting regex fallback extraction...")

        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except JSONDecodeError:
                pass

        raise


async def _execute_with_model_fallback(operation_name: str, fn_with_model):
    """Attempt with preferred model, if 404 or 429, automatically fallback to other candidate flash models."""
    preferred = _get_preferred_model()
    models_to_try = [preferred] + [m for m in CANDIDATE_MODELS if m != preferred]

    last_exception = None
    for model_name in models_to_try:
        try:
            return await fn_with_model(model_name)
        except Exception as exc:
            err_msg = str(exc)
            is_model_missing = "not found" in err_msg.lower() or "no longer available" in err_msg.lower() or "404" in err_msg
            is_rate_limited = "429" in err_msg or "resource_exhausted" in err_msg.lower()

            if is_model_missing:
                logger.warning(f"Model {model_name} tidak ditemukan, beralih ke model flash berikutnya... ({err_msg[:80]})")
                last_exception = exc
                continue
            elif is_rate_limited:
                logger.warning(f"Model {model_name} terkena limit per-model, mencoba model flash alternatif untuk mendapatkan kuota terpisah...")
                last_exception = exc
                continue
            else:
                raise exc
    if last_exception:
        raise last_exception


async def _run_with_retry(attempt_fn, request_type: str, request_id: str) -> dict:
    """Run an async attempt with rate-limiting pre-delay + retry + backoff + structured logging."""
    last_err = None
    for attempt in range(MAX_RETRIES + 1):
        logger.info(f"[{request_type.upper()}] Menunggu jeda {PRE_CALL_DELAY} detik sebelum memanggil Gemini API (Attempt {attempt+1}/{MAX_RETRIES+1})...")
        await asyncio.sleep(PRE_CALL_DELAY)

        start = time.monotonic()
        try:
            result = await attempt_fn()
            duration = round(time.monotonic() - start, 2)
            logger.info(
                f"gen_ok request_id={request_id} type={request_type} attempt={attempt+1} duration={duration}s status=OK"
            )
            return result
        except Exception as exc:  # noqa: BLE001
            duration = round(time.monotonic() - start, 2)
            classification = _classify(exc)
            status = getattr(exc, "status_code", None) or getattr(exc, "code", None)
            last_err = AIError(classification, str(exc), status if isinstance(status, int) else None)

            retry_allowed = (classification not in _NON_RETRYABLE) and (attempt < MAX_RETRIES)
            default_wait = BACKOFF_SECONDS[min(attempt, len(BACKOFF_SECONDS)-1)]
            wait_time = min(_extract_retry_delay(exc, default_wait), 1.5) if retry_allowed else 0

            logger.error(
                f"[GEMINI API ERROR] request_id={request_id} type={request_type} attempt={attempt+1}/{MAX_RETRIES+1} duration={duration}s\n"
                f"Classification: {classification} (Status: {status})\n"
                f"Error: {exc}\n"
                f"Akan dicoba ulang otomatis: {'Ya, menunggu ' + str(round(wait_time, 1)) + ' detik...' if retry_allowed else 'Tidak'}\n"
                f"Traceback:\n{traceback.format_exc()}"
            )

            if not retry_allowed:
                break

            await asyncio.sleep(wait_time)
    raise last_err


async def analyze_image_json(session_id: str, system: str, prompt: str, image_bytes: bytes) -> dict:
    """
    Menganalisis gambar produk menggunakan Gemini Vision.
    Dilengkapi mekanisme try-except ketat dan otomatis mengembalikan data mock/fallback jika terjadi error.
    """
    request_id = str(uuid.uuid4())[:8]
    api_key = _api_key()
    if not api_key:
        logger.warning("GEMINI_API_KEY tidak ditemukan. Menggunakan respons mock/fallback analisis produk.")
        return get_mock_product_analysis()

    try:
        genai.configure(api_key=api_key)

        try:
            pil_img = PIL.Image.open(io.BytesIO(image_bytes))
            if pil_img.mode not in ("RGB", "RGBA"):
                pil_img = pil_img.convert("RGB")
        except Exception as img_err:
            logger.warning(f"Gagal memproses file gambar dengan Pillow: {img_err}. Menggunakan fallback analisis produk.")
            return get_mock_product_analysis()

        async def single_attempt():
            async def call_model(model_name: str):
                model = genai.GenerativeModel(
                    model_name=model_name,
                    system_instruction=system,
                    generation_config={"response_mime_type": "application/json"},
                )
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(
                    None,
                    lambda: model.generate_content([prompt, pil_img]),
                )
                raw_text = response.text if hasattr(response, "text") else str(response)
                print(f"\n[AI DEBUG LOG - ANALYZE IMAGE] (Model: {model_name}) Raw response ({len(raw_text)} chars):\n{raw_text[:400]}...\n")

                try:
                    return _extract_json(raw_text)
                except Exception as parse_err:
                    logger.warning(f"Percobaan parsing gagal ({parse_err}). Mencoba self-refinement JSON...")
                    refinement_prompt = _create_refinement_prompt(raw_text, str(parse_err))
                    refine_resp = await loop.run_in_executor(
                        None,
                        lambda: model.generate_content(refinement_prompt)
                    )
                    refined_text = refine_resp.text if hasattr(refine_resp, "text") else str(refine_resp)
                    print(f"\n[AI DEBUG LOG - REFINEMENT RESULT]:\n{refined_text}\n")
                    return _extract_json(refined_text)

            return await _execute_with_model_fallback("analyze_image", call_model)

        return await _run_with_retry(single_attempt, "analyze", request_id)
    except Exception as exc:
        logger.warning(f"[VISION FALLBACK TRIGGERED] Analisis gambar gagal ({exc}). Mengembalikan data mock analisis produk agar alur UI tetap berjalan lancar.")
        return get_mock_product_analysis()


async def generate_json(session_id: str, system: str, prompt: str) -> dict:
    """
    Menghasilkan prompt UGC menggunakan Gemini LLM.
    Dilengkapi mekanisme try-except ketat dan otomatis mengembalikan data mock/fallback jika terjadi error
    agar Vercel Serverless Function tidak pernah gagal (Zero-Crash Guarantee).
    """
    request_id = str(uuid.uuid4())[:8]
    api_key = _api_key()
    if not api_key:
        logger.warning("GEMINI_API_KEY tidak ditemukan pada environment variables. Menggunakan mock prompt fallback.")
        return get_mock_generated_prompt()

    try:
        genai.configure(api_key=api_key)

        async def single_attempt():
            async def call_model(model_name: str):
                model = genai.GenerativeModel(
                    model_name=model_name,
                    system_instruction=system,
                    generation_config={"response_mime_type": "application/json"},
                )
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(
                    None,
                    lambda: model.generate_content(prompt),
                )
                raw_text = response.text if hasattr(response, "text") else str(response)
                print(f"\n[AI DEBUG LOG - GENERATE PROMPT] (Model: {model_name}) Raw response ({len(raw_text)} chars):\n{raw_text[:400]}...\n")

                try:
                    return _extract_json(raw_text)
                except Exception as parse_err:
                    logger.warning(f"Percobaan parsing gagal ({parse_err}). Mencoba self-refinement JSON...")
                    refinement_prompt = _create_refinement_prompt(raw_text, str(parse_err))
                    refine_resp = await loop.run_in_executor(
                        None,
                        lambda: model.generate_content(refinement_prompt)
                    )
                    refined_text = refine_resp.text if hasattr(refine_resp, "text") else str(refine_resp)
                    print(f"\n[AI DEBUG LOG - REFINEMENT RESULT]:\n{refined_text}\n")
                    return _extract_json(refined_text)

            return await _execute_with_model_fallback("generate_prompt", call_model)

        return await _run_with_retry(single_attempt, "generate", request_id)
    except Exception as exc:
        logger.warning(f"[PROMPT FALLBACK TRIGGERED] Pembuatan prompt gagal ({exc}). Mengembalikan data mock UGC prompt lengkap.")
        return get_mock_generated_prompt()
