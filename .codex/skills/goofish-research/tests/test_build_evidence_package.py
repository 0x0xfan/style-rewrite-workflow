import json
import tempfile
import unittest
from pathlib import Path
import sys

from PIL import Image

SCRIPT_DIR = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPT_DIR))

from build_evidence_package import build  # noqa: E402


class BuildEvidencePackageTests(unittest.TestCase):
    def make_capture(self, root: Path, include_image: bool = True) -> Path:
        image_path = root / "raw" / "browser" / "search.png"
        if include_image:
            image_path.parent.mkdir(parents=True)
            Image.new("RGB", (320, 180), (255, 223, 0)).save(image_path)
        capture = {
            "schema_version": "1.0",
            "source": "logged_in_chrome_goofish",
            "query": "测试服务",
            "source_url": "https://www.goofish.com/search?q=test",
            "page_indicator": "1/50",
            "captured_at": "2026-07-27T00:00:00Z",
            "status": "partial_real_browser_capture",
            "products": [
                {"rank": 1, "item_id": "123", "url": "https://www.goofish.com/item?id=123", "price": 9.9, "wants": 12, "raw_text": "测试商品 ¥9.9 12人想要"},
                {"rank": 2, "item_id": "456", "url": "https://www.goofish.com/item?id=456", "price": 19.9, "wants": None, "raw_text": "测试商品二 ¥19.9"},
            ],
            "screenshots": [
                {"id": "search_overview", "type": "search_results", "path": "raw/browser/search.png", "source_url": "https://www.goofish.com/search?q=test", "description": "测试截图"}
            ],
        }
        capture_path = root / "capture.json"
        capture_path.write_text(json.dumps(capture, ensure_ascii=False), encoding="utf-8")
        return capture_path

    def test_builds_verified_package(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            result = build(self.make_capture(root), root / "output")
            self.assertEqual(result["status"], "passed")
            self.assertEqual(result["screenshots"], 1)
            self.assertEqual(result["summary"]["price_median"], 14.9)
            manifest = json.loads((root / "output" / "screenshots" / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["total_screenshots"], 1)
            self.assertEqual(manifest["screenshots"][0]["width"], 320)

    def test_missing_image_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with self.assertRaisesRegex(ValueError, "missing or empty"):
                build(self.make_capture(root, include_image=False), root / "output")


if __name__ == "__main__":
    unittest.main()
