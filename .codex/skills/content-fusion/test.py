"""Regression tests for mandatory, auditable knowledge retrieval."""

import json
import sys
import tempfile
import unittest
from pathlib import Path


SKILL_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SKILL_DIR))

from main import ContentFusion
from modules import KnowledgeRetriever
from modules.knowledge_retriever import KnowledgeRetrievalError


REAL_KNOWLEDGE_API = Path(r"D:\项目仓库\闲鱼知识库\scripts\knowledge_api.py")


class KnowledgeRetrieverTests(unittest.TestCase):
    def _write_api(self, directory: Path, search_body: str) -> Path:
        """Create a minimal file with the same public KnowledgeAPI contract."""
        scripts_dir = directory / "scripts"
        scripts_dir.mkdir()
        api_path = scripts_dir / "knowledge_api.py"
        api_path.write_text(
            "class KnowledgeAPI:\n"
            "    def __init__(self, kb_root):\n"
            "        self.root = kb_root\n"
            "    def search_fulltext(self, query, limit=10):\n"
            f"        {search_body}\n"
            "    def check_violations(self, text):\n"
            "        return []\n",
            encoding="utf-8",
        )
        return api_path

    def test_real_knowledge_api_class_is_loaded_with_its_knowledge_root(self):
        self.assertTrue(REAL_KNOWLEDGE_API.is_file(), "真实 knowledge_api.py 不存在")
        retriever = KnowledgeRetriever(str(REAL_KNOWLEDGE_API))
        self.assertEqual(retriever.client.__class__.__name__, "KnowledgeAPI")
        self.assertEqual(retriever.client.root.resolve(), REAL_KNOWLEDGE_API.parent.parent.resolve())
        self.assertIsInstance(retriever.client.get_stats(), dict)

    def test_retrieval_builds_auditable_pack(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            api_path = self._write_api(
                Path(temp_dir),
                "return [{'title': '交付方法', 'content': '先确认范围，再说明交付方式。', "
                "'source': 'docs/delivery.md', 'category': '交付', 'tags': ['服务'], "
                "'match_score': 8, 'matched_in': ['content']}]",
            )
            retriever = KnowledgeRetriever(str(api_path))
            knowledge = retriever.retrieve_for_scenario("title", "服务", ["服务"])
            pack = retriever.build_knowledge_pack(knowledge, "title", "服务", ["服务"])

        self.assertEqual(pack["schema_version"], "1.0")
        self.assertTrue(any(pack["query"].values()))
        self.assertGreaterEqual(pack["minimum_used_sources"], 1)
        self.assertEqual(pack["retrieval"]["usable_source_count"], 1)
        source = pack["sources"][0]
        self.assertTrue(source["id"])
        self.assertEqual(source["source_id"], "knowledge-01")
        self.assertTrue(source["title"])
        self.assertEqual(source["locator"], "docs/delivery.md")
        self.assertTrue(source["excerpt"])
        self.assertEqual(len(source["content_sha256"]), 64)
        self.assertTrue(source["allowed_uses"])
        self.assertTrue(set(source["allowed_uses"]) <= {"explanation", "method", "mechanism", "risk"})

    def test_zero_results_stop_generation(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            retriever = KnowledgeRetriever(str(self._write_api(Path(temp_dir), "return []")))
            with self.assertRaisesRegex(KnowledgeRetrievalError, "停止生成"):
                retriever.retrieve_for_scenario("video", "服务")

    def test_result_without_content_stops_generation(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            retriever = KnowledgeRetriever(
                str(self._write_api(Path(temp_dir), "return [{'title': '空条目', 'content': '   '}]"))
            )
            with self.assertRaisesRegex(KnowledgeRetrievalError, "缺少正文"):
                retriever.retrieve_for_scenario("video", "服务")

    def test_missing_or_unreadable_api_stops_before_retrieval(self):
        with self.assertRaises(FileNotFoundError):
            KnowledgeRetriever(str(SKILL_DIR / "does-not-exist.py"))

        with tempfile.TemporaryDirectory() as temp_dir:
            broken = Path(temp_dir) / "knowledge_api.py"
            broken.write_text("this is not valid python", encoding="utf-8")
            with self.assertRaisesRegex(KnowledgeRetrievalError, "无法初始化"):
                KnowledgeRetriever(str(broken))


class ContentFusionKnowledgeRequirementTests(unittest.TestCase):
    def test_missing_knowledge_params_is_rejected(self):
        fusion = ContentFusion.__new__(ContentFusion)
        with self.assertRaisesRegex(ValueError, "knowledge_params"):
            fusion._require_knowledge_params({"scenario": "title"})

    def test_missing_product_type_is_rejected(self):
        fusion = ContentFusion.__new__(ContentFusion)
        with self.assertRaisesRegex(ValueError, "product_type"):
            fusion._require_knowledge_params({"knowledge_params": {}})

    def test_save_output_writes_knowledge_pack(self):
        fusion = ContentFusion.__new__(ContentFusion)
        fusion.output_formatter = __import__("modules.output_formatter", fromlist=["OutputFormatter"]).OutputFormatter()
        output = {
            "results": {},
            "compliance_report": {"safe": True, "violations": []},
            "material_list": {},
            "knowledge_pack": {
                "schema_version": "1.0",
                "sources": [{"source_id": "knowledge-01", "excerpt": "可审计内容"}],
            },
        }
        with tempfile.TemporaryDirectory() as temp_dir:
            fusion.save_output(output, temp_dir)
            saved = json.loads((Path(temp_dir) / "knowledge-pack.json").read_text(encoding="utf-8"))

        self.assertEqual(saved["sources"][0]["source_id"], "knowledge-01")


if __name__ == "__main__":
    unittest.main(verbosity=2)
