"""Product image analysis service using OpenAI Vision (gpt-4o-mini).

Extracts accurate, structured product facts from real uploaded photos without inventing details.
"""
import logging
from services import ai_service

logger = logging.getLogger("product_analysis")

_SCHEMA_KEYS = [
    "product_name", "category", "product_type", "brand", "dominant_colors",
    "materials", "packaging_description", "visual_features", "likely_use_case",
    "target_audience", "visible_text", "product_positioning",
]

SYSTEM = (
    "You are an expert AI product vision analyst for high-converting UGC (User-Generated Content) marketing. "
    "Carefully inspect the provided product photo with maximum visual precision. Accurately identify the exact product name "
    "(e.g. 'Stanley Quencher H2.0 Tumbler', 'SK-II Facial Treatment Essence', 'On Running Cloudmonster Shoes', 'Wireless Noise Cancelling Earbuds'), "
    "exact brand name if visible, dominant colors, materials, packaging characteristics, visible text/logos, and ideal target audience. "
    "Rule: If a detail cannot be reliably identified from the image, return an empty string or empty list instead of inventing information. "
    "Respond with valid JSON only."
)

PROMPT = """Carefully analyze this product photo and return ONLY a valid JSON object with the following fields:

{
  "product_name": "precise real-world name of the product identified in the photo",
  "category": "broad category (e.g. Fashion & Footwear / Beauty & Skincare / Home & Living / Electronics / Food & Beverage)",
  "product_type": "specific item type (e.g. Running Shoes, Treatment Essence, Insulated Tumbler, Wireless Earbuds)",
  "brand": "visible brand name, or empty string if not visible",
  "dominant_colors": ["list", "of", "exact", "colors", "visible"],
  "materials": ["list", "of", "materials", "e.g. mesh, rubber, stainless steel, glass"],
  "packaging_description": "detailed visual description of the product shape, bottle, lid, cap, sole, or packaging",
  "visual_features": ["key visual details, textures, and aesthetic design highlights"],
  "likely_use_case": "what the product is used for in daily life",
  "target_audience": "ideal consumer demographic who uses this product",
  "visible_text": "any legible text or logo printed on the product, or empty string",
  "product_positioning": "product vibe (e.g. Premium / Sporty / Aesthetic / Lifestyle / Practical / Luxury)"
}

Return JSON only, without markdown code fences."""


async def analyze(session_id: str, image_bytes: bytes) -> dict:
    """
    Execute product vision analysis via OpenAI and normalize all schema fields.
    Propagates AIError on failure so production surfaces authentic error status.
    """
    data = await ai_service.analyze_image_json(session_id, SYSTEM, PROMPT, image_bytes)

    if not isinstance(data, dict):
        raise ai_service.AIError(
            ai_service.OPENAI_MALFORMED_RESPONSE,
            "OpenAI did not return a valid dictionary structure.",
            status=502
        )

    # Normalization: ensure all schema keys exist and types match
    result = {}
    for k in _SCHEMA_KEYS:
        v = data.get(k)
        if v is None:
            v = [] if k in ("dominant_colors", "materials", "visual_features") else ""
        elif k in ("dominant_colors", "materials", "visual_features"):
            if isinstance(v, str):
                v = [s.strip() for s in v.split(",") if s.strip()]
            elif not isinstance(v, list):
                v = [str(v)]
        result[k] = v

    if not result.get("product_name"):
        result["product_name"] = "Produk Pilihan"

    return result
