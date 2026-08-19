"""Prompt template system — UGC prompt engine with character & product consistency.

Builds the (system, user) messages sent to the AI from structured inputs.
One creative request produces a Character Bible, a Character Anchor, a Product
Lock, a Google Flow master prompt and standalone per-scene prompts.
Adding a new UGC style = adding an entry here, not touching the UI.
"""
import json

STYLE_GUIDES = {
    "Talking Head": "Creator speaks directly to camera the whole time, holding the product.",
    "Product Review": "Creator gives an honest first-person review, showing pros and real usage.",
    "Unboxing": "Creator opens/reveals the product, reacting naturally to what they find.",
    "Problem \u2192 Solution": "Open with a relatable problem, then introduce the product as the fix.",
    "Soft Selling": "Casual, low-pressure recommendation woven into a lifestyle moment.",
    "Hard Selling": "Confident, direct pitch highlighting strong benefits and a clear ask.",
    "POV": "Filmed from a first-person point of view as if the viewer is experiencing it.",
    "Storytelling": "A short personal story arc that naturally features the product.",
    "Product Demo": "Step-by-step demonstration of how the product works and its results.",
    "Before \u2192 After": "Show the before state, use the product, reveal the improved after state.",
}

HOOK_GUIDES = {
    "Curiosity": "Open with an intriguing question or teaser that makes people keep watching.",
    "Problem": "Open by naming a frustrating problem the viewer relates to.",
    "Bold Statement": "Open with a strong, confident claim (only if truthful).",
    "Personal Experience": "Open with a genuine personal anecdote.",
    "Product Discovery": "Open as if the creator just discovered this product.",
    "Before / After": "Open by teasing a transformation.",
    "AI Chooses": "Pick the single most scroll-stopping hook for this product and audience.",
}

SELL_GUIDES = {
    "Soft Sell": "Gently suggest the product; prioritise authenticity over selling.",
    "Natural Recommendation": "Recommend it the way you'd tell a friend, no pressure.",
    "Direct Selling": "Clearly encourage the viewer to buy, with a confident but natural CTA.",
    "Urgency / Promo": "Add tasteful urgency (limited time / deal) without sounding spammy or inventing fake promos.",
}

LANGUAGE_GUIDES = {
    "Bahasa Indonesia": (
        "Write ALL dialogue in natural, conversational Bahasa Indonesia. Use everyday spoken "
        "phrasing such as 'Guys, aku baru nyobain ini...', 'Jujur, awalnya aku nggak terlalu "
        "expect...', 'Ternyata setelah dipakai...', 'Yang aku suka tuh...', 'Kalau kamu lagi "
        "cari...', 'Menurut aku ini worth it banget kalau...'. Use fillers (aku, kamu, ternyata, "
        "banget, jujur, sih, nih) sparingly and naturally. Do NOT start every scene with 'guys'. "
        "Avoid excessive slang and avoid formal/robotic wording."
    ),
    "English": "Write ALL dialogue in natural, conversational English, like a real creator talking to their phone.",
    "Malay": "Write ALL dialogue in natural, conversational Malay (Bahasa Melayu), like a real creator talking casually.",
}

# Duration -> recommended scene structure (approximate; adaptable to style).
DURATION_STRUCTURE = {
    "10 seconds": (
        "Total ~10 seconds. Use approximately 3 scenes: "
        "SCENE 1 HOOK (0-3s), SCENE 2 PRODUCT/BENEFIT (3-7s), SCENE 3 CTA (7-10s). "
        "The scene timings MUST add up to ~10 seconds."
    ),
    "20 seconds": (
        "Total ~20 seconds. Use approximately 4 scenes: "
        "SCENE 1 HOOK (0-4s), SCENE 2 PROBLEM/CONTEXT (4-9s), SCENE 3 PRODUCT/SOLUTION (9-15s), "
        "SCENE 4 CTA (15-20s). The scene timings MUST add up to ~20 seconds."
    ),
    "30 seconds": (
        "Total ~30 seconds. Use approximately 5 scenes: "
        "SCENE 1 HOOK (0-4s), SCENE 2 PROBLEM/STORY (4-10s), SCENE 3 PRODUCT INTRODUCTION (10-16s), "
        "SCENE 4 DEMONSTRATION/BENEFIT (16-24s), SCENE 5 CTA (24-30s). "
        "The scene timings MUST add up to ~30 seconds."
    ),
}

GLOBAL_NEGATIVE = (
    "NO character identity change, NO face morphing, NO different actor, NO different hairstyle, "
    "NO different clothing, NO different skin tone, NO age change, NO body proportion change, "
    "NO voice change, NO product redesign, NO product morphing, NO duplicate product, "
    "NO packaging change, NO logo change, NO unreadable product label, NO extra fingers, "
    "NO malformed hands, NO unnatural gestures, NO robotic movement, NO unnatural facial expressions, "
    "NO excessive beauty filter, NO plastic skin, NO commercial studio appearance unless requested, "
    "NO artificial lighting unless requested, NO floating objects, NO teleporting objects, "
    "NO discontinuous background, NO sudden camera style change."
)


def build_generation_messages(analysis: dict, video: dict, creator: dict,
                              language: str, natural_language: bool,
                              modifier: str | None = None,
                              character_anchor: str | None = None,
                              reuse_character: bool = False):
    style = video.get("ugc_style", "Problem \u2192 Solution")
    hook = video.get("hook_style", "AI Chooses")
    sell = video.get("selling_style", "Natural Recommendation")
    duration = video.get("duration", "10 seconds")
    aspect = video.get("aspect_ratio", "9:16")
    is_premium = "premium" in style.lower() or creator.get("personality") == "Premium" or creator.get("speaking_style") == "Luxury"

    system = (
        "You are an elite UGC (user-generated content) video director, casting director and "
        "affiliate copywriter. You turn a product and a few creative choices into ONE cohesive, "
        "cinematic-yet-authentic prompt for AI video generators like Google Flow. Your #1 priority "
        "is CONSISTENCY: the SAME creator (identical face, hair, skin, body, age, outfit, accessories, "
        "voice and personality) and the SAME product must appear in EVERY scene. You never cast a new "
        "person or redesign the product between scenes. You write authentic phone-shot UGC (not a "
        "polished commercial) unless a premium style is requested. You never invent unverified claims "
        "(no fake medical results, prices, discounts, testimonials, awards, stats or before/after). "
        "You always respond with valid JSON only."
    )

    # Character handling block.
    if reuse_character and character_anchor:
        character_block = (
            "## CHARACTER — REUSE EXACTLY (DO NOT CHANGE)\n"
            "The creator has already been cast. Use this EXACT Character Anchor verbatim as the creator "
            "for every scene. Do NOT alter any physical detail, outfit, accessories, hair, age, skin tone, "
            "voice or personality. Return it unchanged in `character_anchor` and fill `character_bible` "
            "consistently with it.\n"
            f'CHARACTER ANCHOR: "{character_anchor}"'
        )
    else:
        character_block = (
            "## CHARACTER — CAST ONE NEW CREATOR\n"
            "Cast ONE single creator for the whole video based on the creator settings below. Write a "
            "detailed internal Character Bible and then a single vivid Character Anchor paragraph "
            "(one paragraph, ~40-70 words) that captures the creator's exact identity so it can be reused "
            "verbatim in every scene. If the language implies a region (e.g. Bahasa Indonesia -> Indonesian), "
            "reflect a fitting ethnicity/regional appearance. Respect the creator settings; where a setting is "
            "'Any' or 'AI Chooses', choose one specific value and lock it."
        )

    realism_note = (
        "This is a PREMIUM style: allow cleaner, more polished framing and lighting, but keep the SAME "
        "creator and product consistent across scenes."
        if is_premium else
        "Default to AUTHENTIC SMARTPHONE UGC: handheld phone camera, subtle natural movement, realistic "
        "autofocus, slightly imperfect framing, natural exposure, real indoor lighting and room ambience, "
        "genuine expressions, spontaneous gestures, natural blinking and believable pauses. Avoid "
        "advertising-style posing, dramatic commercial lighting, excessive slow-motion, robotic gestures, "
        "exaggerated expressions and constant direct eye contact. The creator feels like a real person "
        "recording on their phone."
    )

    natural_note = (
        "Dialogue must sound spontaneous and human — like a real creator sharing a genuine discovery, not "
        "reading an ad. Avoid lines like 'This revolutionary product is the ultimate solution' or "
        "'Introducing the best product that will transform your life'. Translate features into relatable "
        "benefits (feature -> why it matters -> user benefit)."
        if natural_language else ""
    )

    user = f"""Create ONE complete, consistent UGC video prompt for an AI video generator (Google Flow).

## PRODUCT (from reference image analysis — this is the visual source of truth; preserve exactly)
{json.dumps(analysis, ensure_ascii=False, indent=2)}

## VIDEO SETTINGS
- Aspect ratio: {aspect}
- Duration: {duration}
- Scene structure: {DURATION_STRUCTURE.get(duration, DURATION_STRUCTURE['10 seconds'])}
- UGC style: {style} \u2014 {STYLE_GUIDES.get(style, "")}
- Hook style: {hook} \u2014 {HOOK_GUIDES.get(hook, "")}
- Selling style: {sell} \u2014 {SELL_GUIDES.get(sell, "")}

## CREATOR SETTINGS
- Gender: {creator.get('gender', 'Any')}
- Age: {creator.get('age', 'AI Chooses')}
- Personality: {creator.get('personality', 'Relatable')}
- Speaking style: {creator.get('speaking_style', 'Natural')}
- Location: {creator.get('location', 'Product Appropriate')}

{character_block}

## LANGUAGE
{LANGUAGE_GUIDES.get(language, LANGUAGE_GUIDES['English'])}
{natural_note}

## STYLE & REALISM
{realism_note}

## AFFILIATE STORY
Follow an affiliate arc adapted to the duration: HOOK -> PROBLEM/DESIRE -> DISCOVERY -> PRODUCT -> DEMONSTRATION -> BENEFIT -> CTA. The creator shares a genuine recommendation. The CTA must match the selling style and feel natural (no aggressive sales language, no invented promos/prices).

## HARD CONSISTENCY RULES (CRITICAL)
1. CHARACTER: The SAME creator appears in EVERY scene — identical facial identity, hairstyle, hair color, skin tone, body proportions, apparent age, outfit, accessories, voice and personality. Never cast a new person, never change wardrobe/hair/face/age/skin/voice between scenes (accessories only if the concept truly requires it).
2. PRODUCT: Every scene shows the EXACT same physical product from the reference image — same shape, proportions, color, packaging, label, logo, typography, cap/lid, material, texture, size and distinctive details. Never redesign, morph, duplicate or re-text the product.
3. CONTINUITY: Each scene continues from the previous one (same creator, outfit, hair, location, product, time-of-day lighting and overall visual style) and states only what changes. Keep a consistent handheld smartphone camera language across scenes; camera changes only when motivated.
4. Product interaction must be physically realistic (pick up, hold, show to camera, open, apply, place down). No floating/teleporting/duplicated/morphing products.
5. Describe realistic facial expressions and gestures per scene (e.g. briefly raises eyebrows, glances at product, light nod, one-hand gesture, short pause before a benefit) — not "she talks to camera".
6. Voice continuity: define the creator's voice once and repeat that it is the exact same voice in every scene.

## STANDALONE SCENE REQUIREMENT
Each scene prompt must be usable INDEPENDENTLY in Google Flow. Therefore each scene's `character_continuity` MUST embed the full Character Anchor text plus: "The SAME creator described in the Character Continuity section — maintain identical facial identity, hairstyle, clothing, accessories, body proportions, voice and personality. Use the exact same creator voice as all previous scenes." Never refer to the creator only as "the woman"/"the man".
{f"## EXTRA USER DIRECTION: {modifier}" if modifier else ""}

## OUTPUT FORMAT — return ONLY this JSON object:
{{
  "summary": {{
    "product": "product name",
    "duration": "{duration}",
    "aspect_ratio": "{aspect}",
    "ugc_style": "{style}",
    "creator": "short one-line creator description",
    "language": "{language}"
  }},
  "character_bible": {{
    "character_id": "", "gender": "", "age": "", "ethnicity": "", "face_shape": "",
    "skin_tone": "", "hair_color": "", "hair_length": "", "hair_style": "", "eye_color": "",
    "body_type": "", "height_impression": "", "distinctive_features": "", "makeup_level": "",
    "outfit": "", "clothing_colors": "", "accessories": "", "voice": "", "speaking_style": "",
    "personality": "", "energy_level": ""
  }},
  "character_anchor": "one vivid paragraph describing the exact creator identity, reusable verbatim in every scene",
  "product_lock": "one paragraph describing the exact product to preserve in every scene, based on the reference analysis",
  "master_prompt": "The FULL Google Flow master prompt as ONE clean plain-text block, in this order: VIDEO OVERVIEW (format, duration, platform, realism), UGC STYLE, CHARACTER CONSISTENCY LOCK (the same-creator-in-every-scene paragraph), CHARACTER ANCHOR (the anchor paragraph), PRODUCT CONSISTENCY LOCK (the do-not-change product paragraph), LOCATION, GLOBAL CAMERA STYLE, GLOBAL LIGHTING, AUDIO STYLE, then SCENE 1..N (each labelled 'SCENE X — TITLE' with TIME, CHARACTER CONTINUITY, PRODUCT CONTINUITY, LOCATION CONTINUITY, VISUAL, ACTION, FACIAL EXPRESSION, GESTURE, CAMERA, LIGHTING, AUDIO, DIALOGUE, TRANSITION/CONTINUITY INTO NEXT SCENE, NEGATIVE CONSTRAINTS), then CTA, then GLOBAL NEGATIVE PROMPT. Use plain text with real line breaks (\\n). Do NOT wrap it in JSON or markdown fences. This is exactly what the user copies into Google Flow.",
  "scenes": [
    {{
      "number": 1,
      "name": "Hook",
      "time": "0-3 sec",
      "character_continuity": "full Character Anchor + the SAME-creator continuity sentence",
      "product_continuity": "restate the exact product to keep identical",
      "location_continuity": "same/changed location note",
      "visual": "",
      "action": "",
      "facial_expression": "",
      "gesture": "",
      "camera": "",
      "lighting": "",
      "audio": "",
      "dialogue": "",
      "transition": "how it continues into the next scene",
      "negative_constraints": "scene-specific do-not list"
    }}
  ]
}}

The GLOBAL NEGATIVE PROMPT section inside master_prompt must include: {GLOBAL_NEGATIVE}

Return JSON only. No explanation. No markdown fences."""

    return system, user
