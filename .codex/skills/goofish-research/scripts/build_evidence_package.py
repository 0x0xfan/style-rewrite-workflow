#!/usr/bin/env python3
"""Validate a real Goofish browser capture and build a portable evidence package."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import statistics
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image


ALLOWED_STATUSES = {
    "real_browser_capture",
    "partial_real_browser_capture",
    "blocked_screenshot",
    "blocked_browser",
}


def read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError("capture root must be a JSON object")
    return value


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_product(product: dict[str, Any], index: int) -> None:
    item_id = str(product.get("item_id", ""))
    url = str(product.get("url", ""))
    if not item_id.isdigit():
        raise ValueError(f"products[{index}].item_id must be numeric")
    if "goofish.com/item" not in url or f"id={item_id}" not in url:
        raise ValueError(f"products[{index}].url does not match item_id")
    price = product.get("price")
    if not isinstance(price, (int, float)) or price < 0:
        raise ValueError(f"products[{index}].price must be a non-negative number")
    wants = product.get("wants")
    if wants is not None and (not isinstance(wants, int) or wants < 0):
        raise ValueError(f"products[{index}].wants must be null or a non-negative integer")
    if not str(product.get("raw_text", "")).strip():
        raise ValueError(f"products[{index}].raw_text is required")


def copy_and_verify_screenshots(capture: dict[str, Any], capture_path: Path, output: Path) -> list[dict[str, Any]]:
    screenshots = capture.get("screenshots")
    if not isinstance(screenshots, list) or not screenshots:
        raise ValueError("at least one real screenshot is required")

    destination_dir = output / "screenshots"
    destination_dir.mkdir(parents=True, exist_ok=True)
    verified = []
    seen_ids: set[str] = set()

    for index, item in enumerate(screenshots):
        if not isinstance(item, dict):
            raise ValueError(f"screenshots[{index}] must be an object")
        screenshot_id = str(item.get("id", "")).strip()
        if not screenshot_id or screenshot_id in seen_ids:
            raise ValueError(f"screenshots[{index}].id is missing or duplicated")
        seen_ids.add(screenshot_id)

        relative_path = Path(str(item.get("path", "")))
        if relative_path.is_absolute() or ".." in relative_path.parts:
            raise ValueError(f"screenshots[{index}].path must stay inside the capture directory")
        source = (capture_path.parent / relative_path).resolve()
        if not source.is_file() or source.stat().st_size <= 0:
            raise ValueError(f"screenshot file is missing or empty: {source}")

        try:
            with Image.open(source) as image:
                image.verify()
            with Image.open(source) as image:
                width, height = image.size
                image_format = image.format or source.suffix.lstrip(".").upper()
        except Exception as error:
            raise ValueError(f"screenshot cannot be decoded: {source}: {error}") from error

        extension = source.suffix.lower() or ".png"
        destination = destination_dir / f"{screenshot_id}{extension}"
        if source != destination.resolve():
            shutil.copy2(source, destination)

        verified.append({
            "id": screenshot_id,
            "type": item.get("type", "unspecified"),
            "file": destination.relative_to(output).as_posix(),
            "source_url": item.get("source_url"),
            "description": item.get("description", ""),
            "captured_at": item.get("captured_at", capture.get("captured_at")),
            "sha256": sha256(destination),
            "bytes": destination.stat().st_size,
            "width": width,
            "height": height,
            "format": image_format,
        })

    return verified


def summarize(capture: dict[str, Any]) -> dict[str, Any]:
    products = capture["products"]
    prices = [float(product["price"]) for product in products]
    wants_values = [int(product["wants"]) for product in products if product.get("wants") is not None]
    return {
        "sampled_products": len(products),
        "page_indicator": capture.get("page_indicator"),
        "price_min": min(prices),
        "price_max": max(prices),
        "price_median": round(statistics.median(prices), 2),
        "products_with_visible_wants": len(wants_values),
        "visible_wants_sum": sum(wants_values),
        "visible_wants_max": max(wants_values) if wants_values else None,
        "visible_wants_scope": "sampled listing cards only; not sales, orders, or total market demand",
    }


def build(capture_path: Path, output: Path) -> dict[str, Any]:
    capture_path = capture_path.resolve()
    output = output.resolve()
    capture = read_json(capture_path)

    if capture.get("schema_version") != "1.0":
        raise ValueError("schema_version must be 1.0")
    if capture.get("source") != "logged_in_chrome_goofish":
        raise ValueError("source must be logged_in_chrome_goofish")
    status = capture.get("status")
    if status not in ALLOWED_STATUSES:
        raise ValueError(f"unsupported capture status: {status}")
    if status in {"blocked_screenshot", "blocked_browser"}:
        raise ValueError(f"blocked capture cannot be packaged as complete evidence: {status}")
    products = capture.get("products")
    if not isinstance(products, list) or not products:
        raise ValueError("products must contain at least one real item")
    for index, product in enumerate(products):
        if not isinstance(product, dict):
            raise ValueError(f"products[{index}] must be an object")
        validate_product(product, index)

    output.mkdir(parents=True, exist_ok=True)
    verified_screenshots = copy_and_verify_screenshots(capture, capture_path, output)
    summary = summarize(capture)
    generated_at = datetime.now(timezone.utc).isoformat()

    meta = {
        "schema_version": "1.0",
        "query": capture.get("query"),
        "source": capture.get("source"),
        "source_url": capture.get("source_url"),
        "page_indicator": capture.get("page_indicator"),
        "captured_at": capture.get("captured_at"),
        "capture_status": status,
        "package_status": "verified_real_browser_evidence",
        "generated_at": generated_at,
        "summary": summary,
    }
    products_payload = {
        "query": capture.get("query"),
        "captured_at": capture.get("captured_at"),
        "products": products,
        "detail_evidence": capture.get("detail_evidence", []),
    }
    analysis = {
        "query": capture.get("query"),
        "scope": "visible sampled cards from one logged-in Chrome session",
        "summary": summary,
        "detail_evidence": capture.get("detail_evidence", []),
        "limitations": [
            "Visible wants are interest signals, not sales or orders.",
            "Sampled card count is not the platform's total result count.",
            "Seller delivery times and outcomes are seller-authored claims.",
            "Dynamic values may differ between search and detail pages; timestamps remain separate.",
        ],
    }
    manifest = {
        "status": "verified",
        "total_screenshots": len(verified_screenshots),
        "screenshots": verified_screenshots,
        "generated_at": generated_at,
    }

    write_json(output / "meta.json", meta)
    write_json(output / "products.json", products_payload)
    write_json(output / "analysis.json", analysis)
    write_json(output / "screenshots" / "manifest.json", manifest)

    report_lines = [
        f"# {capture.get('query')}：闲鱼项目事实采集",
        "",
        f"- 采集时间：{capture.get('captured_at')}",
        f"- 数据来源：已登录 Chrome 的闲鱼页面",
        f"- 采集状态：{status}",
        f"- 页面标识：{capture.get('page_indicator') or '未读取'}",
        f"- 实际截图：{len(verified_screenshots)} 张（均已解码与哈希校验）",
        "",
        "## 本次可复核事实",
        "",
        f"- 记录商品卡片：{summary['sampled_products']} 条；这只是采样数，不是搜索结果总量。",
        f"- 可见价格范围：{summary['price_min']:.2f}—{summary['price_max']:.2f} 元；中位价格 {summary['price_median']:.2f} 元。",
        f"- 明确显示‘人想要’的卡片：{summary['products_with_visible_wants']} 张；可见数值合计 {summary['visible_wants_sum']}，最高 {summary['visible_wants_max']}。",
        "- ‘人想要’仅是卡片显示的兴趣信号，不能写成订单、销量或总市场需求。",
        "",
        "## 截图证据",
        "",
    ]
    for image in verified_screenshots:
        report_lines.append(f"- `{image['file']}`：{image['description']}（{image['width']}×{image['height']}，SHA-256 `{image['sha256']}`）")
    report_lines.extend(["", "## 边界", ""])
    for limitation in analysis["limitations"]:
        report_lines.append(f"- {limitation}")
    (output / "report.md").write_text("\n".join(report_lines) + "\n", encoding="utf-8")

    return {
        "status": "passed",
        "output": str(output),
        "products": len(products),
        "screenshots": len(verified_screenshots),
        "summary": summary,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--capture", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        result = build(args.capture, args.output)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as error:
        print(json.dumps({"status": "failed", "error": str(error)}, ensure_ascii=False))
        raise SystemExit(1) from error


if __name__ == "__main__":
    main()
