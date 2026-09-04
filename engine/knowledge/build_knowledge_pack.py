#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""知识包构建器（AI 直采内容流水线 · 第 3 环）

把闲鱼知识库正式接入生成链路：按选题主题/关键词检索现有知识库，
产出非空、可回读的 knowledge-pack.json，作为「三输入」之一
（事实 contract + 知识包 + 风格档案，缺一不可）交给生成链路。

硬规则（写进包头，供下游与人工把关）：
  知识包中的数字、案例、收益结论，不得直接写入稿件，
  必须先进事实卡由人确认。反证/冲突条目只能约束风险，不能变成核心方法。

零结果处理（按 docs/requirements.md）：
  知识库不可访问、零结果或无法验证实际使用时停止生成，不得空包放行。
  本工具在检索为空时打印明确失败状态并以非 0 退出，不写出知识包。

编码：全程走 UTF-8 buffer，规避 Windows 控制台默认 GBK/cp936 乱码坑。
建议以 `python -X utf8 build_knowledge_pack.py ...` 运行。

用法：
  build（默认）：
    python -X utf8 engine/knowledge/build_knowledge_pack.py \
        --topic "ai拼车" --keywords "拼车,合租,账号共享" \
        --out research-runs/2026-08-26_ai拼车_采集/knowledge-pack.json

  check（辅助报告，非门禁）：对成稿做商品侧违规词扫描
    python -X utf8 engine/knowledge/build_knowledge_pack.py check --file 稿件.md
"""

import argparse
import datetime
import hashlib
import io
import json
import sys
from pathlib import Path
from typing import Dict, List, Optional

# ---- 路径常量 -------------------------------------------------------------
KNOWLEDGE_BASE_PATH = Path("D:/项目仓库/闲鱼知识库")
REPO_ROOT = Path(__file__).resolve().parents[2]

# 硬规则包头（写进产物，供下游与人工把关）
HARD_RULES = [
    "知识包中的数字、案例、收益结论不得直接写入稿件，必须先进事实卡由人确认。",
    "反证/冲突（counterevidence）条目只能用于约束风险，不能变成核心方法。",
    "知识用于丰富解释与方法，不得改变事实卡的数据、单位、主体、时间范围、条件与步骤含义。",
    "知识库零结果/不可访问/无法验证实际使用时停止生成，不得空包放行。",
]

# 反证/风险信号词：命中则该条粗分为 counterevidence（警示类）
RISK_SIGNALS = [
    "封号", "被封", "永久封", "封店", "违规", "起诉", "赔", "被罚", "处罚",
    "投诉", "举报", "冻结", "扣款", "扣分", "扣保证金", "维权", "风险",
    "坑", "被骗", "诈骗", "陷阱", "避雷", "避坑", "翻车", "下架", "警告",
]


# ---- UTF-8 安全输出（绕开 cp936 控制台）---------------------------------
def _wrap_utf8():
    for name in ("stdout", "stderr"):
        stream = getattr(sys, name)
        buf = getattr(stream, "buffer", None)
        if buf is not None:
            setattr(sys, name, io.TextIOWrapper(buf, encoding="utf-8", errors="replace", newline="\n"))


def eprint(*args):
    print(*args, file=sys.stderr)


# ---- 加载知识库 API ------------------------------------------------------
def load_api():
    """导入并初始化闲鱼知识库检索 API（只读）。"""
    sys.path.insert(0, str(KNOWLEDGE_BASE_PATH))
    try:
        from scripts.knowledge_api import KnowledgeAPI
    except Exception as exc:  # 知识库不可访问 → 硬停
        eprint(f"[FAIL] 无法导入闲鱼知识库 API：{exc}")
        eprint(f"       请确认知识库位于：{KNOWLEDGE_BASE_PATH}")
        sys.exit(2)
    try:
        return KnowledgeAPI(KNOWLEDGE_BASE_PATH)
    except Exception as exc:
        eprint(f"[FAIL] 初始化知识库 API 失败：{exc}")
        sys.exit(2)


# ---- 关键词扩展 ----------------------------------------------------------
def build_queries(topic: str, keywords: List[str]) -> List[str]:
    """把主题 + 关键词展开为检索词列表。

    现有索引 tags/category 均为空（索引重建后），只有全文检索可用，
    且直连长词（如"账号共享"）常零命中，故对每个词做 jieba 分词补召回。
    只扩展用户给定的主题/关键词本身，不引入外部臆造词。
    """
    seeds: List[str] = []
    for s in [topic] + list(keywords):
        s = (s or "").strip()
        if s:
            seeds.append(s)

    expanded: List[str] = []
    seen = set()

    def add(term: str):
        term = (term or "").strip()
        if len(term) >= 2 and term.lower() not in seen:
            seen.add(term.lower())
            expanded.append(term)

    # 原词优先
    for s in seeds:
        add(s)

    # jieba 分词补召回（长词如"账号共享"直连常零命中，切成"账号/共享"提升召回）
    for tok in jieba_cut(seeds):
        add(tok)

    return expanded


def jieba_cut(seeds: List[str]) -> List[str]:
    """对种子词做 jieba 搜索引擎式分词。

    先尝试本进程 import jieba；venv 常缺 jieba，则回退到候选解释器
    子进程（与 engine/naturalness/check-lexicon.mjs 同一约定：优先环境变量
    指定，其次 python / py / python3——本机全局 python 装有 jieba）。
    全部不可用时返回空列表，仅用原词检索（并告警）。
    """
    # 1) 本进程
    try:
        import jieba
        toks: List[str] = []
        for s in seeds:
            toks.extend(jieba.cut_for_search(s))
        return toks
    except Exception:
        pass

    # 2) 候选解释器子进程
    import os
    import subprocess
    code = (
        "import sys,jieba\n"
        "seeds=sys.stdin.buffer.read().decode('utf-8','ignore').split('\\n')\n"
        "out=[]\n"
        "[out.extend(jieba.cut_for_search(s)) for s in seeds if s]\n"
        "sys.stdout.buffer.write('\\n'.join(out).encode('utf-8'))\n"
    )
    candidates: List[str] = []
    if os.environ.get("KP_PYTHON"):
        candidates.append(os.environ["KP_PYTHON"])
    candidates += ["python", "py", "python3"]
    payload = "\n".join(seeds).encode("utf-8")
    for bin_ in candidates:
        try:
            proc = subprocess.run(
                [bin_, "-X", "utf8", "-c", code],
                input=payload, capture_output=True, timeout=30,
            )
            if proc.returncode == 0 and proc.stdout.strip():
                return proc.stdout.decode("utf-8", "ignore").split("\n")
        except Exception:
            continue

    eprint("[WARN] jieba 不可用（本进程与候选解释器均失败），仅用原词检索。")
    return []


# ---- 关系粗分 ------------------------------------------------------------
def is_primary_hit(title: str, excerpt: str, matched_queries: List[str],
                   primary_terms: List[str]) -> bool:
    """该条是否真正命中用户给定的主题/关键词本身（而非 jieba 拆出的宽泛碎片）。

    这是相关性的诚实信号：主题词/关键词以子串出现在标题或摘录中，
    或该条正是被某个主关键词直接检索命中。宽泛碎片（如"ai""账号"）不算。
    """
    blob = f"{title}\n{excerpt}".lower()
    prims = [t.lower() for t in primary_terms if len(t) >= 2]
    if any(p in blob for p in prims):
        return True
    mq = [q.lower() for q in matched_queries]
    if any(p in mq for p in prims):
        return True
    return False


def classify_relation(title: str, excerpt: str, agg_score: float,
                      matched_in: List[str], primary_hit: bool) -> str:
    """粗分知识条目与选题的关系：support / supplement / counterevidence。

    规则（优先级从上到下）：
      1) 命中风险/警示信号词 → counterevidence（封号、起诉、被罚…）
      2) 真正命中主题/主关键词，且命中标题或聚合分较高 → support
      3) 真正命中主题/主关键词但较弱 → supplement
      4) 仅靠宽泛碎片（如"ai""账号"）召回、未命中主词 → supplement
    只有真正对得上选题的条目才判 support，避免把噪声当核心方法。
    """
    blob = f"{title}\n{excerpt}"
    if any(sig in blob for sig in RISK_SIGNALS):
        return "counterevidence"
    if primary_hit and ("title" in matched_in or agg_score >= 12):
        return "support"
    return "supplement"


# ---- 检索 & 汇聚 ---------------------------------------------------------
def retrieve(api, queries: List[str], primary_terms: List[str],
             per_query: int, top_n: int, min_score: int) -> List[Dict]:
    """多查询检索 → 按文档去重汇聚 → 关系粗分 → 取 Top N。"""
    merged: Dict[str, Dict] = {}

    for q in queries:
        try:
            hits = api.search_fulltext(q, limit=per_query)
        except Exception as exc:
            eprint(f"[WARN] 检索 '{q}' 失败：{exc}")
            continue
        for h in hits:
            key = h.get("cleaned_path") or h.get("title") or ""
            if not key:
                continue
            rec = merged.get(key)
            if rec is None:
                rec = {
                    "title": h.get("title", ""),
                    "cleaned_path": h.get("cleaned_path", ""),
                    "source": h.get("source", ""),
                    "content": h.get("content", ""),
                    "category": h.get("category", ""),
                    "agg_score": 0.0,
                    "matched_in": set(),
                    "matched_queries": [],
                }
                merged[key] = rec
            rec["agg_score"] += float(h.get("match_score", 0))
            rec["matched_in"].update(h.get("matched_in", []) or [])
            if q not in rec["matched_queries"]:
                rec["matched_queries"].append(q)

    # 过滤纯噪声 + 排序
    ranked = [r for r in merged.values() if r["agg_score"] >= min_score]
    ranked.sort(key=lambda r: (r["agg_score"], len(r["matched_queries"])), reverse=True)
    ranked = ranked[:top_n]

    sources: List[Dict] = []
    for i, r in enumerate(ranked, 1):
        content = (r.get("content") or "").strip()
        excerpt = content[:500]
        matched_in = sorted(r["matched_in"])
        primary_hit = is_primary_hit(
            r["title"], excerpt, r["matched_queries"], primary_terms
        )
        relation = classify_relation(
            r["title"], excerpt, r["agg_score"], matched_in, primary_hit
        )
        locator = r.get("cleaned_path", "")
        sources.append({
            "id": f"knowledge-{i:02d}",
            "title": r["title"],
            "locator": locator,
            "source": r.get("source", ""),
            "excerpt": excerpt,
            "content_sha256": _sha256_of(locator, content),
            "match_score": round(r["agg_score"], 2),
            "matched_in": matched_in,
            "matched_queries": r["matched_queries"],
            "matched_primary_term": primary_hit,
            "relation": relation,
        })
    return sources


def _sha256_of(locator: str, content: str) -> str:
    """优先按落盘文件计算 SHA-256（可回读校验）；失败则退回内容哈希。"""
    try:
        p = Path(locator)
        if p.is_file():
            return hashlib.sha256(p.read_bytes()).hexdigest()
    except Exception:
        pass
    return hashlib.sha256(content.encode("utf-8", "ignore")).hexdigest()


# ---- 构建包 --------------------------------------------------------------
def build_pack(topic: str, keywords: List[str], queries: List[str],
               sources: List[Dict], min_used: int) -> Dict:
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    rel_counts = {"support": 0, "supplement": 0, "counterevidence": 0}
    for s in sources:
        rel_counts[s["relation"]] = rel_counts.get(s["relation"], 0) + 1
    primary_hits = sum(1 for s in sources if s.get("matched_primary_term"))
    coverage_warning = None
    if primary_hits == 0:
        coverage_warning = (
            "知识库对本选题无直接覆盖：全部条目仅靠宽泛扩展词召回，"
            "无一命中主题/主关键词本身。这些条目只宜作背景补充，"
            "生成时不得据此提出选题特有的方法或数字；建议向知识库补充该题材内容。"
        )
    return {
        "schema_version": "2.0",
        "generated_at": now,
        "producer": {
            "name": "engine/knowledge/build_knowledge_pack.py",
            "knowledge_base_path": str(KNOWLEDGE_BASE_PATH),
            "knowledge_api_path": str(KNOWLEDGE_BASE_PATH / "scripts" / "knowledge_api.py"),
        },
        "hard_rules": HARD_RULES,
        "topic": topic,
        "query": {
            "topic": topic,
            "keywords": keywords,
            "expanded_queries": queries,
            "retrieval_mode": "fulltext",
            "note": "当前索引 tags/category 为空，仅全文检索可用；长词经 jieba 分词补召回。",
        },
        "retrieval": {
            "result_count": len(sources),
            "usable_source_count": len(sources),
            "minimum_used_sources": min_used,
            "relation_distribution": rel_counts,
            "primary_term_hits": primary_hits,
            "coverage_warning": coverage_warning,
        },
        "minimum_used_sources": min_used,
        "sources": sources,
    }


# ---- 违规词辅助扫描（非门禁）--------------------------------------------
def cmd_check(args) -> int:
    """辅助报告：对成稿做商品侧违规词扫描。复用 knowledge_client.check_violations。

    这是生成后的辅助报告，不是门禁；违规词命中提示人工复核，不阻断。
    """
    sys.path.insert(0, str(REPO_ROOT))
    try:
        from knowledge_client import KnowledgeClient
    except Exception as exc:
        eprint(f"[FAIL] 无法导入 knowledge_client：{exc}")
        return 2

    if args.file:
        text = Path(args.file).read_text(encoding="utf-8", errors="ignore")
    elif args.text:
        text = args.text
    else:
        text = sys.stdin.buffer.read().decode("utf-8", "ignore")

    client = KnowledgeClient()
    result = client.check_violations(text)
    report = {
        "kind": "violation_scan",
        "note": "辅助报告，非门禁；命中提示人工复核，不阻断生成。",
        "safe": result["safe"],
        "violation_count": len(result["violations"]),
        "violations": result["violations"],
    }
    sys.stdout.write(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    # 辅助报告：无论是否命中都以 0 退出（不作门禁）
    return 0


# ---- build 子命令 --------------------------------------------------------
def cmd_build(args) -> int:
    topic = args.topic.strip()
    keywords = [k.strip() for k in (args.keywords or "").split(",") if k.strip()]
    if not topic:
        eprint("[FAIL] --topic 不能为空")
        return 2

    primary_terms = [topic] + keywords
    queries = build_queries(topic, keywords)
    eprint(f"[INFO] 选题：{topic}")
    eprint(f"[INFO] 关键词：{keywords}")
    eprint(f"[INFO] 展开检索词（{len(queries)}）：{queries}")

    api = load_api()
    sources = retrieve(
        api, queries, primary_terms,
        per_query=args.per_query, top_n=args.top, min_score=args.min_score,
    )

    # 零结果硬停：不写空包，非 0 退出
    if not sources:
        eprint("=" * 60)
        eprint("[FAIL] 检索零结果：知识库对该选题无可用覆盖。")
        eprint("       按 requirements.md：零结果时停止生成，不得空包放行。")
        eprint("       建议：换更贴近商品的具体词，或先向知识库补充该题材内容。")
        eprint("=" * 60)
        return 1

    pack = build_pack(topic, keywords, queries, sources, args.min_used)

    # 严格覆盖度模式：无一命中主题/主关键词本身，视同"对本选题零覆盖"，硬停不写包。
    # 默认关闭——默认仍产出包，靠 coverage_warning + primary_term_hits 传递质量信号。
    if args.strict_coverage and pack["retrieval"]["primary_term_hits"] == 0:
        eprint("=" * 60)
        eprint("[FAIL] 严格覆盖度：召回条目无一命中主题/主关键词本身。")
        eprint("       视同对本选题零覆盖，按 requirements.md 停止，不写出知识包。")
        eprint("       建议：换更贴近商品的具体词，或先向知识库补充该题材内容。")
        eprint("=" * 60)
        return 1

    out_path = Path(args.out)
    if not out_path.is_absolute():
        out_path = (REPO_ROOT / out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(pack, ensure_ascii=False, indent=2), encoding="utf-8")

    rc = pack["retrieval"]["relation_distribution"]
    ph = pack["retrieval"]["primary_term_hits"]
    eprint("=" * 60)
    eprint(f"[OK] 知识包已写出：{out_path}")
    eprint(f"     条目 {len(sources)} 条  关系分布：{rc}")
    eprint(f"     命中主题/主关键词本身的条目：{ph} / {len(sources)}")
    eprint(f"     Top: {sources[0]['title'][:36]}  (score {sources[0]['match_score']})")
    if pack["retrieval"]["coverage_warning"]:
        eprint(f"[WARN] 覆盖度告警：{pack['retrieval']['coverage_warning']}")
    eprint("=" * 60)
    # 也把产物路径打到 stdout，方便管道取用
    sys.stdout.write(str(out_path) + "\n")
    return 0


def main() -> int:
    _wrap_utf8()
    parser = argparse.ArgumentParser(
        prog="build-knowledge-pack",
        description="知识包构建器：按选题检索闲鱼知识库，产出非空可回读的 knowledge-pack.json",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    pb = sub.add_parser("build", help="构建知识包（默认；不写子命令时默认走 build）")
    pb.add_argument("--topic", required=True, help="选题主题，如 ai拼车")
    pb.add_argument("--keywords", default="", help="逗号分隔关键词，如 拼车,合租,账号共享")
    pb.add_argument("--out", required=True, help="输出 knowledge-pack.json 路径（相对仓库根或绝对）")
    pb.add_argument("--top", type=int, default=12, help="最多保留条目数（默认 12）")
    pb.add_argument("--per-query", type=int, default=8, dest="per_query", help="每个检索词取回条数（默认 8）")
    pb.add_argument("--min-score", type=int, default=1, dest="min_score", help="聚合分下限，过滤纯噪声（默认 1）")
    pb.add_argument("--min-used", type=int, default=1, dest="min_used", help="下游最少需实际使用的条目数（默认 1）")
    pb.add_argument("--strict-coverage", action="store_true", dest="strict_coverage",
                    help="严格覆盖度：无一命中主题/主关键词本身则硬停不写包（默认关闭）")

    pc = sub.add_parser("check", help="违规词辅助扫描（非门禁）")
    g = pc.add_mutually_exclusive_group()
    g.add_argument("--file", help="待扫描稿件文件（UTF-8）")
    g.add_argument("--text", help="待扫描文本")

    # 不写子命令时默认走 build（兼容示例中的直接调用写法）
    argv = sys.argv[1:]
    if argv and argv[0] not in ("build", "check", "-h", "--help"):
        argv = ["build"] + argv

    args = parser.parse_args(argv)
    if args.cmd == "check":
        return cmd_check(args)
    return cmd_build(args)


if __name__ == "__main__":
    sys.exit(main())
