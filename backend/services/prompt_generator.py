"""Prompt generation orchestrator. Uses the template + AI service.

One creative request produces the Character Bible, Character Anchor, Product
Lock, master prompt and standalone scene prompts. The Character Anchor is
returned so it can be reused verbatim on regeneration (unless the creator
settings changed).
"""
import logging
from services import ai_service, prompt_templates

logger = logging.getLogger("prompt_generator")

_SCENE_FIELDS = [
    "character_continuity", "product_continuity", "location_continuity", "visual",
    "action", "facial_expression", "gesture", "camera", "lighting", "audio",
    "dialogue", "transition", "negative_constraints",
]


def _normalize_scene(s: dict, index: int) -> dict:
    """Guarantee every scene has all fields so the UI/copy never breaks."""
    s = dict(s or {})
    s["number"] = s.get("number", index)
    s["name"] = s.get("name", f"Scene {index}")
    s["time"] = s.get("time", "")
    for f in _SCENE_FIELDS:
        v = s.get(f, "")
        s[f] = "" if v is None else (v if isinstance(v, str) else str(v))
    return s


async def generate(session_id: str, analysis: dict, video: dict, creator: dict,
                   language: str, natural_language: bool,
                   modifier: str | None = None,
                   character_anchor: str | None = None,
                   reuse_character: bool = False) -> dict:
    """
    Eksekusi pembuatan prompt UGC dengan fallback otomatis.
    Jika terjadi kendala pada Gemini API / Timeout, otomatis mengembalikan prompt UGC terstruktur yang lengkap.
    """
    try:
        system, user = prompt_templates.build_generation_messages(
            analysis, video, creator, language, natural_language, modifier,
            character_anchor=character_anchor, reuse_character=reuse_character,
        )
        data = await ai_service.generate_json(session_id, system, user)
    except Exception as e:
        logger.warning(f"Error pada pemanggilan generate_json: {e}. Mengaktifkan mock prompt fallback.")
        data = ai_service.get_mock_generated_prompt(analysis, video, creator, language)

    if not isinstance(data, dict) or not data.get("master_prompt"):
        data = ai_service.get_mock_generated_prompt(analysis, video, creator, language)

    master = data.get("master_prompt", "")
    if isinstance(master, dict):
        master = str(master)
    anchor = data.get("character_anchor", "") or (character_anchor if reuse_character else "")
    if isinstance(anchor, dict):
        anchor = str(anchor)

    scenes = [_normalize_scene(s, i) for i, s in enumerate(data.get("scenes", []) or [], start=1)]

    # Jika scenes kosong, gunakan fallback scenes
    if not scenes:
        fallback_data = ai_service.get_mock_generated_prompt(analysis, video, creator, language)
        scenes = [_normalize_scene(s, i) for i, s in enumerate(fallback_data.get("scenes", []), start=1)]

    return {
        "master_prompt": (master or "").strip(),
        "scenes": scenes,
        "summary": data.get("summary", {}) or {},
        "character_bible": data.get("character_bible", {}) or {},
        "character_anchor": (anchor or "").strip(),
        "product_lock": (data.get("product_lock", "") or "").strip(),
        "character_locked": True,
        "product_locked": True,
    }
