"""Automated unit tests for OpenAI GPT-4o-mini Vision and Prompt Engine.

Tests all required failure modes and success paths:
1. Missing API key handling
2. Invalid image format handling
3. Valid image vision analysis success (structured output)
4. OpenAI 401 authentication error
5. OpenAI 429 rate limit / quota exceeded
6. OpenAI network timeout
7. Malformed AI JSON response handling
"""
import io
import os
import json
import unittest
import asyncio
from unittest.mock import patch, MagicMock
from PIL import Image

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services import ai_service, product_analysis, prompt_generator


def create_sample_jpeg_bytes() -> bytes:
    """Helper to generate valid JPEG image bytes in memory."""
    img = Image.new("RGB", (100, 100), color=(73, 109, 137))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


class TestOpenAIService(unittest.TestCase):

    # -------------------------------------------------------------
    # Test 1: Missing API Key
    # -------------------------------------------------------------
    def test_missing_api_key(self):
        """Verify missing OPENAI_API_KEY raises a clear OPENAI_AUTH_ERROR (500)."""
        async def _run():
            with patch.dict(os.environ, {"OPENAI_API_KEY": ""}, clear=False):
                jpeg_bytes = create_sample_jpeg_bytes()
                with self.assertRaises(ai_service.AIError) as cm:
                    await ai_service.analyze_image_json(
                        session_id="test-session",
                        system="system instruction",
                        prompt="analyze this",
                        image_bytes=jpeg_bytes
                    )
                self.assertEqual(cm.exception.status, 500)
                self.assertEqual(cm.exception.classification, ai_service.OPENAI_AUTH_ERROR)
                self.assertIn("OPENAI_API_KEY", str(cm.exception))

        asyncio.run(_run())

    # -------------------------------------------------------------
    # Test 2: Invalid Image Handling
    # -------------------------------------------------------------
    def test_invalid_image_handling(self):
        """Verify invalid bytes are safely handled by Pillow pre-processor without crashing."""
        async def _run():
            corrupt_bytes = b"NOT_A_REAL_IMAGE_DATA_CORRUPT"
            with patch.object(ai_service, "_call_openai_rest", return_value={"product_name": "Test Item"}):
                with patch.dict(os.environ, {"OPENAI_API_KEY": "sk-test-mock-key"}):
                    result = await ai_service.analyze_image_json(
                        session_id="test-session",
                        system="system instruction",
                        prompt="prompt",
                        image_bytes=corrupt_bytes
                    )
                    self.assertEqual(result.get("product_name"), "Test Item")

        asyncio.run(_run())

    # -------------------------------------------------------------
    # Test 3: Valid Image Vision Analysis Success
    # -------------------------------------------------------------
    def test_analyze_image_success(self):
        """Verify structured product analysis output contains all required fields."""
        async def _run():
            mock_openai_response = {
                "product_name": "On Running Cloudmonster",
                "category": "Fashion & Footwear",
                "product_type": "Running Shoes",
                "brand": "On Running",
                "dominant_colors": ["White", "Flame Orange"],
                "materials": ["Mesh", "Helion Superfoam", "Rubber"],
                "packaging_description": "Modern lightweight performance sneaker with distinctive CloudTec sole pods.",
                "visual_features": ["CloudTec cushioning pods", "Speedboard plate", "Breathable upper mesh"],
                "likely_use_case": "Road running, marathon training, and lifestyle comfort",
                "target_audience": "Runners, athletes, and active lifestyle enthusiasts",
                "visible_text": "On Running Cloudmonster",
                "product_positioning": "Premium Athletic Footwear"
            }

            with patch.object(ai_service, "_call_openai_rest", return_value=mock_openai_response):
                with patch.dict(os.environ, {"OPENAI_API_KEY": "sk-test-mock-key"}):
                    jpeg_bytes = create_sample_jpeg_bytes()
                    analysis = await product_analysis.analyze(
                        session_id="test-proj-123",
                        image_bytes=jpeg_bytes
                    )

                    self.assertEqual(analysis["product_name"], "On Running Cloudmonster")
                    self.assertEqual(analysis["category"], "Fashion & Footwear")
                    self.assertEqual(analysis["brand"], "On Running")
                    self.assertIn("Mesh", analysis["materials"])
                    self.assertIsInstance(analysis["dominant_colors"], list)
                    self.assertEqual(analysis["product_positioning"], "Premium Athletic Footwear")

        asyncio.run(_run())

    # -------------------------------------------------------------
    # Test 4: OpenAI 401 Authentication Error
    # -------------------------------------------------------------
    def test_openai_401_auth_error(self):
        """Verify OpenAI 401 response results in OPENAI_AUTH_ERROR without retrying."""
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.text = json.dumps({"error": {"message": "Incorrect API key provided"}})

        with patch("requests.post", return_value=mock_response):
            with patch.dict(os.environ, {"OPENAI_API_KEY": "sk-invalid-key"}):
                with self.assertRaises(ai_service.AIError) as cm:
                    ai_service._call_openai_rest(
                        model_name="gpt-4o-mini",
                        api_key="sk-invalid-key",
                        system_instruction="sys",
                        prompt="prompt"
                    )
                self.assertEqual(cm.exception.status, 401)
                self.assertEqual(cm.exception.classification, ai_service.OPENAI_AUTH_ERROR)

    # -------------------------------------------------------------
    # Test 5: OpenAI 429 Rate Limited / Quota Exceeded
    # -------------------------------------------------------------
    def test_openai_429_rate_limited(self):
        """Verify OpenAI 429 response results in OPENAI_RATE_LIMITED classification."""
        mock_response = MagicMock()
        mock_response.status_code = 429
        mock_response.text = json.dumps({"error": {"message": "You exceeded your current quota"}})

        with patch("requests.post", return_value=mock_response):
            with patch("time.sleep", return_value=None):
                with self.assertRaises(ai_service.AIError) as cm:
                    ai_service._call_openai_rest(
                        model_name="gpt-4o-mini",
                        api_key="sk-test-key",
                        system_instruction="sys",
                        prompt="prompt",
                        max_retries=1
                    )
                self.assertEqual(cm.exception.status, 429)
                self.assertEqual(cm.exception.classification, ai_service.OPENAI_RATE_LIMITED)

    # -------------------------------------------------------------
    # Test 6: OpenAI Timeout
    # -------------------------------------------------------------
    def test_openai_timeout(self):
        """Verify network timeouts result in OPENAI_TIMEOUT with HTTP 504."""
        import requests
        with patch("requests.post", side_effect=requests.exceptions.Timeout("Connection timed out")):
            with patch("time.sleep", return_value=None):
                with self.assertRaises(ai_service.AIError) as cm:
                    ai_service._call_openai_rest(
                        model_name="gpt-4o-mini",
                        api_key="sk-test-key",
                        system_instruction="sys",
                        prompt="prompt",
                        max_retries=0
                    )
                self.assertEqual(cm.exception.status, 504)
                self.assertEqual(cm.exception.classification, ai_service.OPENAI_TIMEOUT)

    # -------------------------------------------------------------
    # Test 7: Malformed AI JSON Response Handling
    # -------------------------------------------------------------
    def test_malformed_json_extraction(self):
        """Verify JSON with markdown fences or surrounding commentary is correctly extracted."""
        # Fenced JSON
        fenced = "```json\n{\"product_name\": \"SK-II Facial Treatment Essence\"}\n```"
        res1 = ai_service._extract_json(fenced)
        self.assertEqual(res1["product_name"], "SK-II Facial Treatment Essence")

        # Embedded JSON with pre and post text
        embedded = "Here is the product analysis:\n{\"product_name\": \"Tumbler Stanley\", \"brand\": \"Stanley\"}\nHope this helps!"
        res2 = ai_service._extract_json(embedded)
        self.assertEqual(res2["product_name"], "Tumbler Stanley")
        self.assertEqual(res2["brand"], "Stanley")

        # Truly unparseable text raises OPENAI_MALFORMED_RESPONSE
        with self.assertRaises(ai_service.AIError) as cm:
            ai_service._extract_json("Just random words without any braces or json at all.")
        self.assertEqual(cm.exception.classification, ai_service.OPENAI_MALFORMED_RESPONSE)

    # -------------------------------------------------------------
    # Test 8: Health Check Status
    # -------------------------------------------------------------
    def test_health_check_status(self):
        """Verify is_openai_configured returns boolean and never exposes key value."""
        with patch.dict(os.environ, {"OPENAI_API_KEY": "sk-1234567890abcdef"}, clear=False):
            self.assertTrue(ai_service.is_openai_configured())
        with patch.dict(os.environ, {"OPENAI_API_KEY": ""}, clear=False):
            self.assertFalse(ai_service.is_openai_configured())


if __name__ == "__main__":
    unittest.main()
