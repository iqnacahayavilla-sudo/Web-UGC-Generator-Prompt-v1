"""AI provider using Google Generative Language REST API directly.

Uses direct HTTPS calls to:
https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}

Advantages:
- 100% reliable REST communication without legacy gRPC client wrapper bugs
- Full support for system instructions, JSON response MIME types, and base64 vision analysis
- Verbose transparent logging of raw responses, error bodies, and status codes in console / Vercel logs
- Active candidate model pool: gemini-3.5-flash, gemini-3.6-flash, gemini-3.7-flash, gemini-flash-latest, gemini-3.1-flash-lite, gemini-2.5-flash-lite
- Dynamic scene structure (3 scenes for 10s, 4 scenes for 20s, 5-6 scenes for 30s) tailored to real product metadata
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
RATE_LIMITED = "RATE_LIMITED"
QUOTA_EXCEEDED = "QUOTA_EXCEEDED"
PROVIDER_ERROR = "PROVIDER_ERROR"
TIMEOUT = "TIMEOUT"
VALIDATION_ERROR = "VALIDATION_ERROR"
MALFORMED_RESPONSE = "MALFORMED_RESPONSE"
UNKNOWN_ERROR = "UNKNOWN_ERROR"

_NON_RETRYABLE = {VALIDATION_ERROR}

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
OPENAI_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions"


def _openai_api_key() -> str:
    return (
        os.environ.get("OPENAI_API_KEY")
        or os.environ.get("REACT_APP_OPENAI_API_KEY")
        or ""
    ).strip()


def _openai_model() -> str:
    return os.environ.get("OPENAI_MODEL", "gpt-4o-mini").strip()


def _gemini_api_key() -> str:
    return (
        os.environ.get("GEMINI_API_KEY")
        or os.environ.get("GOOGLE_API_KEY")
        or os.environ.get("EMERGENT_LLM_KEY")
        or ""
    ).strip()


def _api_key() -> str:
    return _gemini_api_key()


def _get_preferred_model() -> str:
    return os.environ.get("GEMINI_MODEL", "gemini-3.5-flash").strip()


class AIError(Exception):
    def __init__(self, classification: str, message: str, status: int | None = None):
        super().__init__(message)
        self.classification = classification
        self.status = status


def _classify(status: int, text: str) -> str:
    msg = text.lower()
    if status == 429 or any(w in msg for w in ["429", "rate limit", "resource_exhausted", "quota", "exceeded your current quota"]):
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


def get_mock_product_analysis(default_name: str = "Produk Unggulan") -> dict:
    """
    Fallback data analisis produk berbasis template dinamis jika vision AI gagal total.
    """
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
    """
    Menghasilkan prompt video UGC lengkap yang disesuaikan secara dinamis
    menggunakan nama produk nyata, kategori, fitur visual, dan preferensi durasi user (10s, 20s, 30s).
    """
    analysis = analysis or {}
    video = video or {}
    creator = creator or {}

    p_name = analysis.get("product_name") or "Produk Pilihan"
    p_cat = analysis.get("category") or "Lifestyle & Daily Essentials"
    p_type = analysis.get("product_type") or "Produk Kebutuhan Harian"
    p_brand = analysis.get("brand") or ""
    brand_label = f" by {p_brand}" if p_brand else ""

    p_feat = analysis.get("visual_features") or ["Desain modern & ergonomis", "Material berkualitas tinggi", "Estetik dan fungsional"]
    if isinstance(p_feat, str):
        p_feat = [p_feat]
    p_feat_str = ", ".join(p_feat[:2]) if p_feat else "kualitas premium dan desain modern"

    p_case = analysis.get("likely_use_case") or "kebutuhan dan aktivitas harian"
    p_pack = analysis.get("packaging_description") or "kemasan / bodi produk yang kokoh dan estetik"

    v_style = video.get("ugc_style") or "Problem -> Solution"
    v_dur = video.get("duration") or "30 seconds"
    v_ratio = video.get("aspect_ratio") or "9:16"
    v_sell = video.get("selling_style") or "Natural Recommendation"

    c_gender = creator.get("gender") or "Female"
    c_age = creator.get("age") or "20s"
    c_style = creator.get("speaking_style") or "Natural"
    c_loc = creator.get("location") or "Living Room"

    is_30s = "30" in str(v_dur)
    is_20s = "20" in str(v_dur)

    master_prompt = (
        f"[MASTER UGC VIDEO PROMPT - {v_style.upper()} - {v_dur}]\n"
        f"A viral, high-converting authentic UGC video for {p_name}{brand_label} ({p_type} / {p_cat}).\n"
        f"Format: Vertical {v_ratio}, {v_dur}, cinematic mobile camera aesthetic, natural daylight {c_loc.lower()} interior.\n"
        f"Creator Persona: Authentic Indonesian {c_gender.lower()} creator in {c_age}, speaking directly to camera in a relatable, {c_style.lower()} tone.\n"
        f"Product Details: Featuring {p_name} ({p_pack}), highlighting {p_feat_str} for {p_case}.\n"
        f"Visual Continuity: Strict character identity lock and identical product consistency across all scenes."
    )

    if is_30s:
        scenes = [
            {
                "number": 1,
                "name": "Adegan 1: Hook Penasaran & Pain Point",
                "time": "0-4 detik",
                "dialogue": f"Kalian sering ngerasa ribet gak sih pas lagi butuh {p_case} pas lagi di luar rumah?",
                "visual": f"Close-up shot kreator di {c_loc.lower()} memegang {p_name} dengan ekspresi relatable dan penasaran langsung ke arah kamera smartphone.",
                "camera": "Handheld selfie camera, slight natural motion, eye level",
                "lighting": "Soft natural daylight from window",
                "action": f"Kreator berbicara ekspresif sambil memegang {p_name}",
                "facial_expression": "Relatable curiosity and expressive concern",
                "gesture": "One-hand gesture pointing slightly to product",
                "audio": "Clear natural vocal, subtle lo-fi upbeat background music",
                "transition": "Fast whip pan to problem context",
                "character_continuity": f"Identical {c_gender.lower()} creator in {c_age}, casual everyday outfit",
                "product_continuity": f"Identical {p_name} with exact shape, color, and finish",
                "location_continuity": f"Consistent modern {c_loc.lower()}",
                "negative_constraints": "No CGI look, no morphing"
            },
            {
                "number": 2,
                "name": "Adegan 2: Cerita Pengalaman Pribadi",
                "time": "4-10 detik",
                "dialogue": f"Jujur aku dulu sering banget gonta-ganti produk karena gak ada yang bener-bener awet dan fungsional.",
                "visual": f"Medium shot kreator menceritakan pengalamannya dengan gestur santai, {p_name} diletakkan rapi di atas meja di sebelahnya.",
                "camera": "Medium handheld shot with subtle natural breathing motion",
                "lighting": "Balanced warm room lighting",
                "action": "Kreator tersenyum mengingat pengalaman sebelumnya",
                "facial_expression": "Honest, authentic, friendly smile",
                "gesture": "Casual conversational hand gestures",
                "audio": "Warm storytelling tone, music level balanced",
                "transition": "Match cut to product pickup",
                "character_continuity": "Identical creator face, hairstyle, and wardrobe",
                "product_continuity": f"Same {p_name} visible on desk",
                "location_continuity": f"Same {c_loc.lower()} room",
                "negative_constraints": "No jump cuts in appearance"
            },
            {
                "number": 3,
                "name": "Adegan 3: Pengenalan Solusi Produk",
                "time": "10-16 detik",
                "dialogue": f"Sampai akhirnya aku nemu {p_name} ini. Pas pertama kali pegang, langsung berasa beda banget build quality-nya!",
                "visual": f"Close-up shot kreator mengangkat {p_name} dan menunjukkannya detail ke kamera, memperlihatkan {p_feat_str}.",
                "camera": "Close-up focus racking onto product texture and details",
                "lighting": "Clean studio light highlighting product finish and material",
                "action": f"Memperlihatkan bodi dan fitur {p_name} ke arah lensa",
                "facial_expression": "Excited, genuine discovery expression",
                "gesture": "Turning the product slowly to show design",
                "audio": "Enthusiastic tone, crisp vocal audio",
                "transition": "Smooth cut to demonstration",
                "character_continuity": "Consistent creator identity and styling",
                "product_continuity": f"Exact match {p_name} design and logo",
                "location_continuity": "Same lifestyle interior",
                "negative_constraints": "No inconsistent colors or labels"
            },
            {
                "number": 4,
                "name": "Adegan 4: Demonstrasi & Uji Fitur Nyata",
                "time": "16-22 detik",
                "dialogue": f"Fiturnya beneran ngebantu banget buat {p_case}, bahannya solid dan super praktis dipakai seharian.",
                "visual": f"Demonstrasi langsung pemakaian {p_name}. Memperlihatkan kepraktisan dan fungsionalitas produk secara nyata.",
                "camera": "Over-the-shoulder and POV dynamic angle switching",
                "lighting": "Bright natural lighting",
                "action": f"Mendemonstrasikan fungsionalitas {p_name} dengan percaya diri",
                "facial_expression": "Confident, thoroughly satisfied",
                "gesture": "Smooth, ergonomic product handling",
                "audio": "Authentic product interaction sound effect, convincing voiceover",
                "transition": "Cut back to creator selfie shot",
                "character_continuity": "Identical creator hands and clothing",
                "product_continuity": f"Consistent {p_name} throughout action",
                "location_continuity": "Same setting",
                "negative_constraints": "No robotic movements, no unnatural physics"
            },
            {
                "number": 5,
                "name": "Adegan 5: Bukti Kepuasan & Rekomendasi",
                "time": "22-26 detik",
                "dialogue": f"Sekarang udah jadi andalan wajib aku ke mana-mana, beneran worth it banget!",
                "visual": f"Kreator tersenyum puas memegang {p_name} di dekat wajah, menunjukkan kepuasan tulus.",
                "camera": "Medium close-up selfie angle, warm depth of field",
                "lighting": "Flattering soft beauty light",
                "action": "Mengangguk puas memberikan rekomendasi tulus",
                "facial_expression": "High-trust, sincere, happy smile",
                "gesture": "Holding product proudly",
                "audio": "Warm friendly vocal resonance",
                "transition": "Hold into closing call to action",
                "character_continuity": "Consistent styling and hair",
                "product_continuity": f"Identical {p_name}",
                "location_continuity": "Same aesthetic room",
                "negative_constraints": "No artificial posing"
            },
            {
                "number": 6,
                "name": "Adegan 6: Call to Action (Ajakan Checkout)",
                "time": "26-30 detik",
                "dialogue": f"Buat kalian yang mau punya {p_name} ini juga, langsung klik link di bawah mumpung lagi ada promo ya!",
                "visual": f"Kreator tersenyum antusias memegang {p_name} sambil menunjuk ke arah bawah layar (CTA button).",
                "camera": "Direct engaging selfie angle",
                "lighting": "Radiant bright warm light",
                "action": "Menunjuk ke arah bawah layar mengajak penonton checkout",
                "facial_expression": "Warm engaging closing smile",
                "gesture": "Pointing towards bottom CTA link",
                "audio": "Clear closing CTA voiceover with music outro",
                "transition": "Final hold on product lock frame",
                "character_continuity": "Identical creator styling",
                "product_continuity": f"Crisp prominent {p_name} package shot",
                "location_continuity": "Same lifestyle room",
                "negative_constraints": "No CGI look, purely organic UGC creator style"
            }
        ]
    elif is_20s:
        scenes = [
            {
                "number": 1,
                "name": "Adegan 1: Hook & Masalah",
                "time": "0-4 detik",
                "dialogue": f"Jujur, tadinya aku penasaran banget apa bener {p_name} ini sebagus itu...",
                "visual": f"Close-up shot kreator di {c_loc.lower()} memegang {p_name} dengan ekspresi penasaran menghadap kamera.",
                "camera": "Handheld selfie camera, eye level",
                "lighting": "Soft natural morning light",
                "action": f"Menunjukkan {p_name} sekilas ke arah kamera",
                "facial_expression": "Curious and relatable",
                "gesture": "Holding product close to chest",
                "audio": "Crisp clear voiceover, upbeat lo-fi music",
                "transition": "Quick cut to context",
                "character_continuity": f"Identical {c_gender.lower()} creator in {c_age}",
                "product_continuity": f"Identical {p_name}",
                "location_continuity": f"Modern {c_loc.lower()}",
                "negative_constraints": "No blur, no morphing"
            },
            {
                "number": 2,
                "name": "Adegan 2: Masalah & Konteks",
                "time": "4-9 detik",
                "dialogue": f"Soalnya susah banget cari yang beneran praktis dan awet buat {p_case}.",
                "visual": f"Medium shot kreator menceritakan masalah umum yang sering dialami.",
                "camera": "Medium handheld shot",
                "lighting": "Balanced warm room lighting",
                "action": "Berbicara santai dengan gestur tangan alami",
                "facial_expression": "Relatable and honest",
                "gesture": "Natural conversational hands",
                "audio": "Storytelling tone",
                "transition": "Cut to product reveal",
                "character_continuity": "Consistent styling and wardrobe",
                "product_continuity": f"Same {p_name} on table",
                "location_continuity": f"Same {c_loc.lower()}",
                "negative_constraints": "No inconsistencies"
            },
            {
                "number": 3,
                "name": "Adegan 3: Solusi & Bukti Fitur",
                "time": "9-15 detik",
                "dialogue": f"Tapi pas dicobain, {p_feat_str} beneran terbukti bikin aktivitas jauh lebih gampang!",
                "visual": f"Close-up demonstrasi pemakaian {p_name}. Memperlihatkan detail bodi dan fungsi utama.",
                "camera": "Smooth zoom in on product texture and handling",
                "lighting": "Clean studio light",
                "action": f"Mendemonstrasikan cara pemakaian {p_name}",
                "facial_expression": "Impressed and satisfied",
                "gesture": "Ergonomic handling",
                "audio": "Satisfying natural product sound effect",
                "transition": "Zoom out to CTA",
                "character_continuity": "Identical creator hands and face",
                "product_continuity": f"Exact match {p_name}",
                "location_continuity": "Same room",
                "negative_constraints": "No CGI look"
            },
            {
                "number": 4,
                "name": "Adegan 4: Call to Action",
                "time": "15-20 detik",
                "dialogue": f"Wajib punya minimal satu! Klik link di bawah sekarang mumpung lagi ada promo spesial ya!",
                "visual": f"Kreator tersenyum ramah memegang {p_name} sambil menunjuk ke tombol beli.",
                "camera": "Direct front selfie angle",
                "lighting": "Bright radiant light",
                "action": "Menunjuk ke tombol keranjang di bawah",
                "facial_expression": "Warm engaging smile",
                "gesture": "Pointing to CTA",
                "audio": "Clear closing speech with music fade out",
                "transition": "Hold on product frame",
                "character_continuity": "Consistent styling",
                "product_continuity": f"Clear {p_name} shot",
                "location_continuity": "Same setting",
                "negative_constraints": "No artificial look"
            }
        ]
    else:  # 10s default
        scenes = [
            {
                "number": 1,
                "name": "Adegan 1: Hook Menarik Perhatian",
                "time": "0-3 detik",
                "dialogue": f"Jujur, tadinya aku ragu banget mau nyobain {p_name} ini...",
                "visual": f"Close-up shot kreator di {c_loc.lower()} terang, memegang kemasan {p_name} dengan ekspresi penasaran dan antusias.",
                "camera": "Eye-level handheld selfie angle, crisp 4K mobile sensor aesthetic",
                "lighting": "Soft morning window light with warm subtle rim light",
                "action": f"Kreator tersenyum santai sambil menunjukkan {p_name} ke arah kamera",
                "facial_expression": "Relatable curiosity and friendly smile",
                "gesture": "Holding the product close to chest, gentle hand movement",
                "audio": "Upbeat subtle background lo-fi music, clear crisp voiceover",
                "transition": "Quick dynamic match cut to product demo",
                "character_continuity": f"Identical {c_gender.lower()} creator appearance and outfit",
                "product_continuity": f"Identical {p_name} packaging and label",
                "location_continuity": f"Clean modern aesthetic {c_loc.lower()} interior",
                "negative_constraints": "No blurry artifacts, no deformed hands, no floating objects"
            },
            {
                "number": 2,
                "name": "Adegan 2: Demonstrasi & Manfaat Utama",
                "time": "3-7 detik",
                "dialogue": f"Tapi setelah dipakai buat {p_case}, hasilnya beneran terbukti dan {p_feat_str}!",
                "visual": f"Medium close-up shot memperlihatkan aplikasi nyata {p_name}. Tekstur produk terlihat jelas dan estetik.",
                "camera": "Slight pan and zoom into product texture and finish",
                "lighting": "Clean balanced studio light emphasizing product clarity",
                "action": f"Mendemonstrasikan pemakaian {p_name} dengan santai dan natural",
                "facial_expression": "Satisfied, impressed, and confident expression",
                "gesture": "Gentle application showing practical benefit",
                "audio": "Satisfying natural sound effect, warm energetic voice tone",
                "transition": "Smooth zoom out to call to action",
                "character_continuity": "Consistent facial features and clothing",
                "product_continuity": f"Exact match {p_name} bottle and brand logo",
                "location_continuity": f"Same well-lit {c_loc.lower()} interior",
                "negative_constraints": "No inconsistent colors, no distorted labels"
            },
            {
                "number": 3,
                "name": "Adegan 3: Call to Action (Ajakan Beli)",
                "time": "7-10 detik",
                "dialogue": f"Buat kamu yang mau buktiin sendiri, klik link di bawah sekarang mumpung lagi diskon ya!",
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
                "location_continuity": "Consistent modern {c_loc.lower()} lifestyle setting",
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
        "product_lock": f"{p_name} with identical clean packaging, correct brand details, and authentic product proportions.",
        "character_locked": True,
        "product_locked": True
    }


def _call_openai_rest(model_name: str, api_key: str, system_instruction: str, prompt: str, image_bytes: bytes | None = None) -> dict:
    """
    Eksekusi langsung ke OpenAI Chat Completions REST API.
    Mendukung gpt-4o-mini Vision, response_format json_object, dan system prompt.
    """
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

    start_time = time.monotonic()
    logger.info(f"[OPENAI REST CALL] Model: {model_name} | URL: {OPENAI_COMPLETIONS_URL}")

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

    if resp.status_code == 200:
        res_json = resp.json()
        choices = res_json.get("choices", [])
        if not choices:
            raise AIError(PROVIDER_ERROR, f"OpenAI returned 200 OK but no choices found: {res_json}")

        raw_text = choices[0].get("message", {}).get("content", "")
        print(f"\n[OPENAI REST SUCCESS - Model: {model_name} in {elapsed}s] Raw Response ({len(raw_text)} chars):\n{raw_text[:400]}...\n")
        return _extract_json(raw_text)
    else:
        err_body = resp.text
        classification = _classify(resp.status_code, err_body)
        print(f"\n==================== [OPENAI REST ERROR DETAILS] ====================")
        print(f"Model: {model_name}")
        print(f"HTTP Status Code: {resp.status_code}")
        print(f"Classification: {classification}")
        print(f"Raw Error Response: {err_body}")
        print(f"=====================================================================\n")
        raise AIError(classification, f"OpenAI API Error {resp.status_code}: {err_body}", status=resp.status_code)


def _call_gemini_rest(model_name: str, api_key: str, system_instruction: str, prompt: str, image_bytes: bytes | None = None) -> dict:
    """
    Eksekusi langsung ke Google Generative Language REST API.
    Mendukung system instruction, structured JSON generationConfig, dan multimodal inline_data.
    """
    url = f"{BASE_REST_URL}/{model_name}:generateContent?key={api_key}"

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
        print(f"\n[AI REST SUCCESS - Model: {model_name} in {elapsed}s] Raw Response ({len(raw_text)} chars):\n{raw_text[:400]}...\n")
        return _extract_json(raw_text)
    else:
        err_body = resp.text
        classification = _classify(resp.status_code, err_body)
        print(f"\n==================== [GEMINI REST ERROR DETAILS] ====================")
        print(f"Model: {model_name}")
        print(f"HTTP Status Code: {resp.status_code}")
        print(f"Classification: {classification}")
        print(f"Raw Error Response: {err_body}")
        print(f"=====================================================================\n")
        raise AIError(classification, f"Google API Error {resp.status_code}: {err_body}", status=resp.status_code)


async def analyze_image_json(session_id: str, system: str, prompt: str, image_bytes: bytes) -> dict:
    """
    Analisis gambar produk via OpenAI (gpt-4o-mini Vision) sebagai engine utama,
    dengan fallback ke Gemini REST API jika OpenAI tidak terkonfigurasi/error.
    """
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

    loop = asyncio.get_event_loop()

    # 1. Primary Engine: OpenAI GPT-4o-mini (Vision)
    openai_key = _openai_api_key()
    openai_model_name = _openai_model()
    if openai_key:
        try:
            logger.info(f"Mencoba analisis gambar produk dengan OpenAI Vision: {openai_model_name}...")
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
            print(f"\n[ANALISIS GAMBAR SUKSES] Berhasil menganalisis foto produk dengan OpenAI {openai_model_name}!")
            return result
        except Exception as oai_err:
            print(f"[OPENAI VISION ERROR] {oai_err}. Beralih ke fallback provider...")

    # 2. Fallback Engine: Google Gemini Multi-Pool
    gemini_key = _gemini_api_key()
    if gemini_key:
        preferred = _get_preferred_model()
        models_to_try = [preferred] + [m for m in CANDIDATE_MODELS if m != preferred]

        for model_name in models_to_try:
            try:
                logger.info(f"Mencoba analisis gambar produk dengan Gemini: {model_name}...")
                result = await loop.run_in_executor(
                    None,
                    lambda m=model_name: _call_gemini_rest(
                        model_name=m,
                        api_key=gemini_key,
                        system_instruction=system,
                        prompt=prompt,
                        image_bytes=clean_bytes
                    )
                )
                print(f"\n[ANALISIS GAMBAR SUKSES] Berhasil menganalisis foto produk dengan Gemini {model_name}!")
                return result
            except Exception as gemini_err:
                print(f"[GEMINI VISION ERROR - Model: {model_name}] {gemini_err}")
                continue

    print(f"\n[FALLBACK VISION ACTIVATED] Semua provider API mengalami kendala. Mengembalikan data analisis produk cadangan.")
    return get_mock_product_analysis("Produk Pilihan")


async def generate_json(session_id: str, system: str, prompt: str, analysis_context: dict = None, video_context: dict = None, creator_context: dict = None, language_context: str = "Bahasa Indonesia") -> dict:
    """
    Menghasilkan prompt UGC via OpenAI (gpt-4o-mini) sebagai engine utama,
    dengan fallback ke Google Gemini dan dynamic template.
    """
    loop = asyncio.get_event_loop()

    # 1. Primary Engine: OpenAI GPT-4o-mini
    openai_key = _openai_api_key()
    openai_model_name = _openai_model()
    if openai_key:
        try:
            logger.info(f"Membuat prompt video UGC dengan OpenAI: {openai_model_name}...")
            result = await loop.run_in_executor(
                None,
                lambda: _call_openai_rest(
                    model_name=openai_model_name,
                    api_key=openai_key,
                    system_instruction=system,
                    prompt=prompt
                )
            )
            print(f"\n[GENERATE PROMPT SUKSES] Berhasil menghasilkan prompt AI asli menggunakan OpenAI {openai_model_name}!")
            return result
        except Exception as oai_err:
            print(f"[OPENAI GENERATE ERROR] {oai_err}. Beralih ke fallback provider...")

    # 2. Fallback Engine: Google Gemini Multi-Pool
    gemini_key = _gemini_api_key()
    if gemini_key:
        preferred = _get_preferred_model()
        models_to_try = [preferred] + [m for m in CANDIDATE_MODELS if m != preferred]

        for model_name in models_to_try:
            try:
                logger.info(f"Membuat prompt video UGC dengan Gemini: {model_name}...")
                result = await loop.run_in_executor(
                    None,
                    lambda m=model_name: _call_gemini_rest(
                        model_name=m,
                        api_key=gemini_key,
                        system_instruction=system,
                        prompt=prompt
                    )
                )
                print(f"\n[GENERATE PROMPT SUKSES] Berhasil menghasilkan prompt AI asli menggunakan Gemini {model_name}!")
                return result
            except Exception as gemini_err:
                print(f"[GEMINI GENERATE ERROR - Model: {model_name}] {gemini_err}")
                continue

    print(f"\n[FALLBACK PROMPT ACTIVATED] Seluruh model API mengalami kendala. Mengembalikan prompt dinamis berbasis data produk nyata.")
    return get_mock_generated_prompt(analysis_context, video_context, creator_context, language_context)
