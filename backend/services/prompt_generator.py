"""Prompt generation orchestrator. Uses the template + AI service.

One creative request produces the Character Bible, Character Anchor, Product
Lock, master prompt and standalone scene prompts. The Character Anchor is
returned so it can be reused verbatim on regeneration (unless the creator
settings changed).
"""
from services import ai_service, prompt_templates

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
    system, user = prompt_templates.build_generation_messages(
        analysis, video, creator, language, natural_language, modifier,
        character_anchor=character_anchor, reuse_character=reuse_character,
    )
    data = await ai_service.generate_json(session_id, system, user)

    master = data.get("master_prompt", "")
    if isinstance(master, dict):
        master = str(master)
    anchor = data.get("character_anchor", "") or (character_anchor if reuse_character else "")
    if isinstance(anchor, dict):
        anchor = str(anchor)

    scenes = [_normalize_scene(s, i) for i, s in enumerate(data.get("scenes", []) or [], start=1)]
    return {
        "master_prompt": master.strip(),
        "scenes": scenes,
        "summary": data.get("summary", {}) or {},
        "character_bible": data.get("character_bible", {}) or {},
        "character_anchor": (anchor or "").strip(),
        "product_lock": (data.get("product_lock", "") or "").strip(),
        "character_locked": True,
        "product_locked": True,
    }
