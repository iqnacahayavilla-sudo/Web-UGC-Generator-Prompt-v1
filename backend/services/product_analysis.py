"""Product image analysis. Runs once per uploaded image; result is stored."""
from services import ai_service

_SCHEMA_KEYS = [
    "product_name", "category", "product_type", "brand", "dominant_colors",
    "materials", "packaging_description", "visual_features", "likely_use_case",
    "target_audience", "visible_text", "product_positioning",
]

SYSTEM = (
    "You are a product analyst for UGC video marketing. You look at a single "
    "product photo and extract accurate, structured facts about the product. "
    "Only describe what is visibly evident. Never invent a brand or text that "
    "is not clearly visible. Respond with valid JSON only."
)

PROMPT = """Analyze this product image and return ONLY a JSON object with exactly these keys:

{
  "product_name": "short descriptive name of the product",
  "category": "high level category e.g. Skincare, Electronics, Food",
  "product_type": "specific type e.g. Serum bottle, Wireless earbuds",
  "brand": "visible brand name or empty string if none visible",
  "dominant_colors": ["list", "of", "colors"],
  "materials": ["list of materials e.g. glass, plastic, metal"],
  "packaging_description": "describe the packaging shape, cap, label",
  "visual_features": ["notable visual details"],
  "likely_use_case": "what the product is used for",
  "target_audience": "who typically buys this",
  "visible_text": "any text legibly visible on the product, else empty string",
  "product_positioning": "premium / affordable / natural / clinical etc."
}

Return JSON only, no explanation, no markdown fences."""


async def analyze(session_id: str, image_bytes: bytes) -> dict:
    data = await ai_service.analyze_image_json(session_id, SYSTEM, PROMPT, image_bytes)
    # normalize: ensure all keys exist
    result = {}
    for k in _SCHEMA_KEYS:
        v = data.get(k, [] if k in ("dominant_colors", "materials", "visual_features") else "")
        result[k] = v
    return result
