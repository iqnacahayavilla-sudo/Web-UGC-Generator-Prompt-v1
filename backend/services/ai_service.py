"""AI provider abstraction using Google Generative AI (Gemini).

Supports GEMINI_API_KEY, GOOGLE_API_KEY, or EMERGENT_LLM_KEY.
Features:
- Pre-call rate limiting delay (2 seconds)
- Automatic retry up to 3x with dynamic wait extraction and progressive backoff
- Multi-flash-model quota fallback (separate per-model rate limit buckets)
- Detailed error logging & raw AI output debugging in console
- Pillow image parsing for robust vision input
- Strict JSON refinement prompt (_create_refinement_prompt) to repair malformed responses
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
MAX_RETRIES = 3
BACKOFF_SECONDS = [3.0, 6.0, 12.0]
PRE_CALL_DELAY = 2.0  # Jeda 2 detik sebelum memanggil API Gemini

# Flash models priority list (each model has its own separate quota bucket in Google AI Studio Free Tier)
CANDIDATE_MODELS = [
    "gemini-1.5-flash",
    "gemini-2.5-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-flash-latest",
    "gemini-2.5-flash-lite",
]


def _api_key():
    return (
        os.environ.get("GEMINI_API_KEY")
        or os.environ.get("GOOGLE_API_KEY")
        or os.environ.get("EMERGENT_LLM_KEY")
        or ""
    ).strip()


def _get_preferred_model():
    return os.environ.get("GEMINI_MODEL", "gemini-1.5-flash").strip()


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


def _extract_json(text: str) -> dict:
    """Robustly pull a JSON object out of an LLM response with detailed debug logging."""
    if not text or not text.strip():
        logger.error("[RAW AI RESPONSE IS EMPTY]")
        raise ValueError("Empty AI response")

    cleaned = text.strip()
    # Remove markdown codeblock wrapper if present
    cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()

    try:
        return json.loads(cleaned)
    except JSONDecodeError as err:
        # Cetak output asli untuk debugging langsung di terminal
        print(f"\n==================== [DEBUG AI RAW OUTPUT - JSON ERROR] ====================")
        print(f"Error Message: {err}")
        print(f"--- RAW RESPONSE START (Length: {len(text)} chars) ---")
        print(text)
        print(f"--- RAW RESPONSE END ---")
        print(f"============================================================================\n")
        logger.warning(f"[JSON DECODE ERROR] {err}. Attempting regex fallback extraction...")

        # Fallback 1: Extract first outer {...} block
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
        # 1. Jeda 2 detik sebelum memanggil API untuk menghindari rate limit
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
            wait_time = _extract_retry_delay(exc, default_wait) if retry_allowed else 0

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
    request_id = str(uuid.uuid4())[:8]
    api_key = _api_key()
    if not api_key:
        logger.error("GEMINI_API_KEY tidak ditemukan pada environment variables.")
        raise AIError(VALIDATION_ERROR, "API Key belum dikonfigurasi. Masukkan GEMINI_API_KEY pada file backend/.env")

    genai.configure(api_key=api_key)

    # Process image with Pillow for 100% reliable format handling
    try:
        pil_img = PIL.Image.open(io.BytesIO(image_bytes))
        if pil_img.mode not in ("RGB", "RGBA"):
            pil_img = pil_img.convert("RGB")
    except Exception as img_err:
        logger.error(f"Gagal memproses file gambar dengan Pillow: {img_err}")
        raise AIError(VALIDATION_ERROR, f"Format gambar rusak atau tidak valid: {img_err}")

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
            
            # Print log respon AI asli untuk mempermudah debugging
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


async def generate_json(session_id: str, system: str, prompt: str) -> dict:
    request_id = str(uuid.uuid4())[:8]
    api_key = _api_key()
    if not api_key:
        logger.error("GEMINI_API_KEY tidak ditemukan pada environment variables.")
        raise AIError(VALIDATION_ERROR, "API Key belum dikonfigurasi. Masukkan GEMINI_API_KEY pada file backend/.env")

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
            
            # Print log respon AI asli untuk mempermudah debugging
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
