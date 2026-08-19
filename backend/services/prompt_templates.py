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

# Duration -> recommended scene structure (strictly enforced).
DURATION_STRUCTURE = {
    "10 seconds": (
        "Total ~10 seconds. Use EXACTLY 3 scenes: "
        "SCENE 1 HOOK (0-3s), SCENE 2 PRODUCT/BENEFIT (3-7s), SCENE 3 CTA (7-10s). "
        "The scene timings MUST add up to 10 seconds."
    ),
    "20 seconds": (
        "Total ~20 seconds. Use EXACTLY 4 scenes: "
        "SCENE 1 HOOK (0-4s), SCENE 2 PROBLEM/CONTEXT (4-9s), SCENE 3 PRODUCT/SOLUTION (9-15s), "
        "SCENE 4 CTA (15-20s). The scene timings MUST add up to 20 seconds."
    ),
    "30 seconds": (
        "Total ~30 seconds. Use EXACTLY 5 to 6 scenes: "
        "SCENE 1 HOOK / PAIN POINT (0-4s), SCENE 2 PERSONAL STORY / CONTEXT (4-10s), "
        "SCENE 3 PRODUCT INTRODUCTION & KEY FEATURES (10-16s), "
        "SCENE 4 REAL-LIFE DEMONSTRATION & BENEFITS (16-22s), "
        "SCENE 5 SATISFACTION / SOCIAL PROOF (22-26s), "
        "SCENE 6 CALL TO ACTION (26-30s). "
        "The scene timings MUST add up to 30 seconds."
    ),
    "60 seconds": (
        "Total ~60 seconds. Use EXACTLY 6 to 8 scenes: "
        "SCENE 1 HOOK (0-5s), SCENE 2 PROBLEM & FRUSTRATION (5-15s), "
        "SCENE 3 DISCOVERY / PRODUCT INTRO (15-25s), "
        "SCENE 4 IN-DEPTH DEMONSTRATION & FEATURES (25-40s), "
        "SCENE 5 BEFORE/AFTER OR PROOF OF VALUE (40-50s), "
        "SCENE 6 CLOSING SUMMARY & CTA (50-60s). "
        "The scene timings MUST add up to 60 seconds."
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

    prod_name = analysis.get("product_name") or "Produk Unggulan"
    prod_type = analysis.get("product_type") or "Produk"
    prod_cat = analysis.get("category") or "General"
    prod_brand = analysis.get("brand") or ""

    system = (
        "You are an elite UGC (user-generated content) video director, casting director, and viral affiliate copywriter. "
        "You turn exact product details and creative user choices into ONE cohesive, cinematic-yet-authentic "
        "prompt and multi-scene script for AI video generators (Google Flow / Sora / Runway). "
        f"Your highest priority is 100% FAITHFULNESS to the specific product '{prod_name}' ({prod_type}, {prod_cat}). "
        "Every scene, spoken dialogue, and visual prompt MUST explicitly reference and showcase this exact product, its packaging, and its actual benefits. "
        "The SAME creator and the SAME product must appear consistently in EVERY scene. Respond with valid JSON only."
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

    user = f"""Create ONE complete, consistent UGC video prompt for an AI video generator (Google Flow & Sora).

## TARGET PRODUCT (From Step 1 visual analysis & user refinement — preserve this EXACT product in all scenes):
- Product Name: {prod_name}
- Brand: {prod_brand if prod_brand else 'Authentic Brand from photo'}
- Category: {prod_cat}
- Product Type: {prod_type}
- Complete Product Specs:
{json.dumps(analysis, ensure_ascii=False, indent=2)}

## VIDEO SETTINGS (From Step 2):
- Aspect ratio: {aspect}
- Duration: {duration}
- Scene structure: {DURATION_STRUCTURE.get(duration, DURATION_STRUCTURE['10 seconds'])}
- UGC style: {style} — {STYLE_GUIDES.get(style, "")}
- Hook style: {hook} — {HOOK_GUIDES.get(hook, "")}
- Selling style: {sell} — {SELL_GUIDES.get(sell, "")}

## CREATOR SETTINGS (From Step 3):
- Gender: {creator.get('gender', 'Any')}
- Age: {creator.get('age', 'AI Chooses')}
- Personality: {creator.get('personality', 'Relatable')}
- Speaking style: {creator.get('speaking_style', 'Natural')}
- Location / Environment: {creator.get('location', 'Product Appropriate')}

{character_block}

## LANGUAGE & DIALOGUE (From Step 4):
{LANGUAGE_GUIDES.get(language, LANGUAGE_GUIDES['English'])}
{natural_note}

## STYLE & REALISM
{realism_note}

## AFFILIATE STORY ARC
Follow an authentic affiliate arc adapted to {duration}: HOOK -> PROBLEM/DESIRE -> DISCOVERY OF {prod_name.upper()} -> DEMONSTRATION & TEXTURE/PACKAGING -> BENEFIT -> NATURAL CTA. The creator shares a genuine recommendation.

## HARD CONSISTENCY RULES (CRITICAL)
1. CHARACTER: The SAME creator appears in EVERY scene — identical facial identity, hairstyle, hair color, skin tone, body proportions, apparent age, outfit, accessories, voice and personality. Never cast a new person between scenes.
2. PRODUCT: Every scene shows the EXACT same physical product '{prod_name}' — same shape, proportions, color, packaging, label, logo, and finish as described in the product specs.
3. CONTINUITY: Each scene continues seamlessly from the previous one. Keep consistent handheld smartphone camera movement.
4. Product interaction must be physically realistic (pick up, hold, show to camera, open, apply/drink/use, place down).
5. Voice continuity: The creator speaks with the exact same voice in every scene.

## STANDALONE SCENE REQUIREMENT
Each scene prompt must be usable INDEPENDENTLY in Google Flow. Therefore each scene's `character_continuity` MUST embed the full Character Anchor text plus: "The SAME creator described in the Character Continuity section — maintain identical facial identity, hairstyle, clothing, accessories, body proportions, voice and personality."
{f"## EXTRA USER DIRECTION: {modifier}" if modifier else ""}

## OUTPUT FORMAT — return ONLY this JSON object:
{{
  "summary": {{
    "product": "{prod_name}",
    "duration": "{duration}",
    "aspect_ratio": "{aspect}",
    "ugc_style": "{style}",
    "creator": "{creator.get('gender', 'Creator')}, {creator.get('age', '20-an')}",
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
  "product_lock": "one paragraph describing '{prod_name}' with exact colors, packaging, and label details to preserve in every scene",
  "master_prompt": "The FULL Google Flow master prompt as ONE clean plain-text block for {prod_name}, including Overview, Creator Lock, Product Lock, Location, Lighting, Scene-by-Scene breakdown, Dialogue, and Negative Prompts.",

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
