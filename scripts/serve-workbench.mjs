import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { basename, extname, isAbsolute, join, relative, resolve } from "node:path";
import { createServer } from "node:http";
import { promisify } from "node:util";
import { createHash } from "node:crypto";

const root = resolve("workbench-ui");
const importsRoot = resolve("workbench_imports");
const rewritesRoot = resolve("workbench_rewrites");
const audioRoot = resolve("workbench_audio");
const profilesRoot = resolve("profiles");
const styleDnaVersionsRoot = resolve("profiles", ".dna-versions");
const styleCardFile = resolve("profiles", "钱十七-闲鱼风格拆解.md");
const port = Number(process.env.PORT || 4188);
const execFileAsync = promisify(execFile);
const defaultFeishuUrl = "https://yq9pu32e9v.feishu.cn/wiki/RQj2wuwaQiz9p8kDdTPc2aU5nCe";

const envFile = resolve(".env.local");
if (existsSync(envFile)) {
  const envText = await readFile(envFile, "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

const larkNodeBin = process.env.LARK_NODE_BIN || "E:\\DevTools\\Node22\\node.exe";
const larkCliEntry =
  process.env.LARK_CLI_ENTRY || "E:\\DevTools\\Node22\\node_modules\\@larksuite\\cli\\scripts\\run.js";

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".aac": "audio/aac",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".opus": "audio/ogg",
  ".flac": "audio/flac",
};

const isPathInside = (file, base) => {
  const rel = relative(base, file);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

const sendJson = (response, status, body) => {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
};

const readJsonFile = async (file, fallback) => {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
};

const publicStyleId = (value) => {
  const styleId = String(value || "").trim();
  if (!styleId || styleId.includes("/") || styleId.includes("\\") || styleId.includes("..")) return "";
  return styleId.endsWith(".md") ? styleId : `${styleId}.md`;
};

const safeFilePart = (value, fallback = "file") => {
  const cleaned = String(value || "")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 96);
  return cleaned || fallback;
};

const styleNameFromMarkdown = (fileName, content) => {
  const h1 = String(content || "").match(/^#\s+(.+?)\s*$/m)?.[1]?.trim();
  return h1 || fileName.replace(/\.md$/i, "");
};

const listStyleProfiles = async () => {
  let entries = [];
  try {
    entries = await readdir(profilesRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const styles = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md")) continue;
    const file = resolve(profilesRoot, entry.name);
    if (!isPathInside(file, profilesRoot)) continue;
    let content = "";
    try {
      content = await readFile(file, "utf8");
    } catch {
      content = "";
    }
    styles.push({
      id: entry.name,
      name: styleNameFromMarkdown(entry.name, content),
      file,
      is_default: file === styleCardFile,
      dna_available: existsSync(styleDnaFileForStyle(file)),
    });
  }

  styles.sort((a, b) => Number(b.is_default) - Number(a.is_default) || a.name.localeCompare(b.name, "zh-Hans-CN"));
  return styles;
};

const loadStyleProfile = async (styleIdValue = "") => {
  const styles = await listStyleProfiles();
  const requestedId = publicStyleId(styleIdValue);
  const selected =
    styles.find((style) => style.id === requestedId) ||
    styles.find((style) => style.file === styleCardFile) ||
    styles[0];
  if (!selected) {
    throw new Error(`没有可用风格卡，请先在 ${profilesRoot} 放入 Markdown 风格卡。`);
  }
  const content = await readFile(selected.file, "utf8");
  return {
    ...selected,
    content,
    style_dna: normalizeStyleDna(await readJsonFile(styleDnaFileForStyle(selected.file), null)),
    style_dna_versions: await loadStyleDnaVersions(selected.file),
  };
};

const saveStyleProfile = async (payload = {}) => {
  const rawContent = String(payload.content || payload.markdown || payload.style_card || "").trim();
  const rawName = String(payload.name || payload.title || "").trim();
  if (!rawContent) throw new Error("风格内容为空，不能保存。");

  const fileName = publicStyleId(payload.id || payload.file || rawName || styleNameFromMarkdown("style.md", rawContent));
  if (!fileName) throw new Error("风格名称无效。");
  const safeFileName = safeFilePart(fileName.replace(/\.md$/i, ""), "style") + ".md";
  const file = resolve(profilesRoot, safeFileName);
  if (!isPathInside(file, profilesRoot)) throw new Error("风格文件路径无效。");

  const name = rawName || styleNameFromMarkdown(safeFileName, rawContent);
  const markdown = rawContent.startsWith("#") ? rawContent : `# ${name}\n\n${rawContent}`;
  let dna = normalizeStyleDna(payload.style_dna || payload.styleDna || payload.dna || null);
  const health = dna?.style_metadata?.sample_health || null;
  const requestedApproval = payload.style_dna_approval || payload.styleDnaApproval || payload.dna_approval || {};
  const approved = Boolean(requestedApproval.approved || requestedApproval.status === "approved");
  if (approved && health?.grade === "serious") {
    throw new Error("样本健康度为严重风险，只能保存草稿；请先补样本或处理近重复问题。");
  }

  await mkdir(profilesRoot, { recursive: true });
  await writeFile(file, `${markdown.trim()}\n`, "utf8");
  if (dna) {
    const changeReason = cleanLine(requestedApproval.change_reason || requestedApproval.changeReason || "").slice(0, 240);
    // Saving with the explicit checkbox is the human review gate; analysis may happen before that review.
    const reviewedHealth = health
      ? {
          ...health,
          review_status: health.review_required ? (approved ? "reviewed" : "needs_review") : "not_required",
        }
      : null;
    dna = {
      ...dna,
      style_metadata: {
        ...dna.style_metadata,
        ...(reviewedHealth ? { sample_health: reviewedHealth } : {}),
        approval: {
          status: approved ? "approved" : "draft",
          reviewed_at: approved ? new Date().toISOString() : null,
          change_reason: changeReason,
        },
      },
    };
    const versionInfo = await persistStyleDnaVersion(file, dna);
    dna = {
      ...dna,
      style_metadata: {
        ...dna.style_metadata,
        version: versionInfo,
      },
    };
    await writeFile(styleDnaFileForStyle(file), `${JSON.stringify(dna, null, 2)}\n`, "utf8");
  }

  const styles = await listStyleProfiles();
  const saved = styles.find((style) => style.id === safeFileName) || { id: safeFileName, name, file };
  return {
    ok: true,
    style: {
      ...saved,
      content: await readFile(file, "utf8"),
      style_dna: dna || normalizeStyleDna(await readJsonFile(styleDnaFileForStyle(file), null)),
      style_dna_versions: await loadStyleDnaVersions(file),
    },
    styles,
  };
};

const styleLibraryResponse = async () => {
  const styles = await listStyleProfiles();
  const detailed = [];
  for (const style of styles) {
    let content = "";
    try {
      content = await readFile(style.file, "utf8");
    } catch {
      content = "";
    }
    detailed.push({
      ...style,
      copy_prompt: content.slice(0, 1200),
      content,
      style_dna_summary: summarizeStyleDna(normalizeStyleDna(await readJsonFile(styleDnaFileForStyle(style.file), null))),
    });
  }
  return {
    ok: true,
    path: profilesRoot,
    active_style_id: detailed.find((style) => style.is_default)?.id || detailed[0]?.id || "",
    styles: detailed,
  };
};

const readRequestJson = async (request, maxBytes = 20 * 1024 * 1024) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw new Error("请求体超过 20MB。");
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
};

const decodeEntities = (value) =>
  String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));

const splitText = (text) =>
  String(text || "")
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

const stripMarkdownHeading = (value) => String(value || "").replace(/^#{1,6}\s*/, "").trim();

const normalizeDocText = (content, options = {}) => {
  const preserveHeadings = Boolean(options.preserveHeadings);
  return decodeEntities(String(content || ""))
    .replace(/<title[^>]*>([\s\S]*?)<\/title>/gi, (_, title) => `\n# ${String(title).replace(/\s+/g, " ").trim()}\n`)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*]\([^)]*\)/g, (match) => match.replace(/^\[|\]\([^)]*\)$/g, ""))
    .replace(/<[^>]+>/g, "\n")
    .split(/\r?\n/)
    .map((line) => {
      const raw = line.replace(/\s+/g, " ").trim();
      const heading = raw.match(/^(#{1,6})\s*(.+)$/);
      const prefix = preserveHeadings && heading ? `${heading[1]} ` : "";
      const cleaned = raw
        .replace(/^#{1,6}\s*/, "")
        .replace(/^[-*+]\s+/, "")
        .replace(/^\d+[.)]\s+/, "")
        .replace(/^\|+|\|+$/g, "")
        .trim();
      return `${prefix}${cleaned}`.trim();
    })
    .filter((line) => line.length >= 2)
    .join("\n")
    .trim();
};

const htmlToReadableText = (html, options = {}) =>
  normalizeDocText(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, text) => `\n${"#".repeat(Number(level))} ${text}\n`)
      .replace(/<(p|div|br|li|h[1-6]|tr|section|article)[^>]*>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n"),
    options,
  );

const parseLarkCliJson = (stdout) => {
  const trimmed = String(stdout || "").trim();
  if (!trimmed) throw new Error("lark-cli did not return JSON.");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("lark-cli returned non-JSON output.");
  }
};

const extractMarkdownImages = (content) => {
  const images = [];
  const pattern = /!\[([^\]]*)]\(([^)\s]+)[^)]*\)/g;
  let match;
  while ((match = pattern.exec(String(content || "")))) {
    images.push({ alt: match[1] || "", url: match[2] });
  }
  return images;
};

const extractMarkdownImagesWithContext = (content) => {
  const images = [];
  const source = String(content || "");
  const pattern = /!\[([^\]]*)]\(([^)\s]+)[^)]*\)/g;
  let match;
  while ((match = pattern.exec(source))) {
    const before = source
      .slice(Math.max(0, match.index - 260), match.index)
      .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const after = source
      .slice(pattern.lastIndex, Math.min(source.length, pattern.lastIndex + 260))
      .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    images.push({
      order: images.length + 1,
      alt: match[1] || "",
      url: match[2],
      context_before: before.slice(-220),
      context_after: after.slice(0, 220),
    });
  }
  return images;
};

const extFromContentType = (contentType) => {
  if (/png/i.test(contentType)) return ".png";
  if (/webp/i.test(contentType)) return ".webp";
  if (/gif/i.test(contentType)) return ".gif";
  return ".jpg";
};

const buildSegments = (text) =>
  splitText(text).map((rawText, index) => ({
    segment_id: `seg_${String(index + 1).padStart(3, "0")}`,
    order: index + 1,
    raw_text: rawText,
    normalized_text: rawText,
    status: "imported",
  }));

const publicImportId = (value) => {
  const importId = String(value || "").trim();
  return /^feishu_\d{14}$/.test(importId) ? importId : "";
};

const loadImportAssetContext = async (importIdValue) => {
  const importId = publicImportId(importIdValue);
  if (!importId) return { import_id: "", source_title: "", assets: [], warnings: [] };
  const importRoot = resolve(importsRoot, importId);
  if (!isPathInside(importRoot, importsRoot)) {
    return { import_id: "", source_title: "", assets: [], warnings: ["invalid_import_path"] };
  }

  const assets = await readJsonFile(resolve(importRoot, "feishu_asset_index.json"), []);
  const manifest = await readJsonFile(resolve(importRoot, "import_manifest.json"), {});
  let sourceSnapshot = "";
  try {
    sourceSnapshot = await readFile(resolve(importRoot, "source_snapshot.md"), "utf8");
  } catch {
    sourceSnapshot = "";
  }
  const imageContexts = extractMarkdownImagesWithContext(sourceSnapshot);
  const normalized = (Array.isArray(assets) ? assets : [])
    .filter((asset) => asset && asset.download_status === "downloaded")
    .map((asset, index) => {
      const context = imageContexts[index] || {};
      return {
        asset_id: String(asset.asset_id || `asset_${String(index + 1).padStart(3, "0")}`),
        order: index + 1,
        alt: String(asset.alt || context.alt || ""),
        file: asset.file,
        local_url: asset.local_url,
        mime: asset.mime || "image/png",
        size: Number(asset.size || 0),
        sha1: asset.sha1 || "",
        context_before: context.context_before || "",
        context_after: context.context_after || "",
      };
    });

  return {
    import_id: importId,
    source_title: manifest.source?.title || "",
    assets: normalized,
    warnings: normalized.length ? [] : ["no_downloaded_feishu_assets"],
  };
};

const assetContextPrompt = (assetContext) => {
  const assets = Array.isArray(assetContext?.assets) ? assetContext.assets : [];
  if (!assets.length) return "没有可用的飞书内联图片。";
  return assets
    .map((asset) =>
      [
        `asset_id: ${asset.asset_id}`,
        `local_url: ${asset.local_url || ""}`,
        `mime: ${asset.mime || ""}`,
        `context_before: ${asset.context_before || "空"}`,
        `context_after: ${asset.context_after || "空"}`,
      ].join("\n"),
    )
    .join("\n\n");
};

const downloadImages = async (images, importId) => {
  const assetDir = resolve(importsRoot, importId, "assets");
  await mkdir(assetDir, { recursive: true });
  const assets = [];

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    const assetId = `asset_${String(index + 1).padStart(3, "0")}`;
    try {
      const result = await fetch(image.url);
      if (!result.ok) {
        assets.push({
          asset_id: assetId,
          source_url: image.url,
          alt: image.alt,
          download_status: "failed",
          error: `HTTP ${result.status}`,
        });
        continue;
      }
      const contentType = result.headers.get("content-type") || "image/jpeg";
      const bytes = Buffer.from(await result.arrayBuffer());
      const sha1 = createHash("sha1").update(bytes).digest("hex");
      const ext = extFromContentType(contentType);
      const fileName = `${assetId}_${sha1.slice(0, 10)}${ext}`;
      const filePath = resolve(assetDir, fileName);
      await writeFile(filePath, bytes);
      assets.push({
        asset_id: assetId,
        source_url: image.url,
        alt: image.alt,
        file: filePath,
        local_url: `/imports/${importId}/assets/${fileName}`,
        mime: contentType,
        size: bytes.length,
        sha1,
        download_status: "downloaded",
      });
    } catch (error) {
      assets.push({
        asset_id: assetId,
        source_url: image.url,
        alt: image.alt,
        download_status: "failed",
        error: error instanceof Error ? error.message : "download failed",
      });
    }
  }

  return assets;
};

const persistImport = async ({ docUrl, title, text, content, finalUrl, source }) => {
  const importId = `feishu_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
  const importRoot = resolve(importsRoot, importId);
  await mkdir(importRoot, { recursive: true });
  const images = extractMarkdownImages(content);
  const assets = await downloadImages(images, importId);
  const segments = buildSegments(text);
  const manifest = {
    import_id: importId,
    source: {
      type: "feishu",
      url: docUrl,
      final_url: finalUrl || docUrl,
      title,
      reader: source,
    },
    stats: {
      paragraph_count: splitText(text).length,
      segment_count: segments.length,
      image_count: images.length,
      downloaded_count: assets.filter((asset) => asset.download_status === "downloaded").length,
      failed_count: assets.filter((asset) => asset.download_status === "failed").length,
    },
    created_at: new Date().toISOString(),
  };

  await writeFile(resolve(importRoot, "import_manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  await writeFile(resolve(importRoot, "source_snapshot.md"), content, "utf8");
  await writeFile(resolve(importRoot, "normalized_script.txt"), text, "utf8");
  await writeFile(resolve(importRoot, "script_segments.json"), JSON.stringify(segments, null, 2), "utf8");
  await writeFile(resolve(importRoot, "feishu_asset_index.json"), JSON.stringify(assets, null, 2), "utf8");

  return { importId, importRoot, assets, segments, manifest };
};

const extractLarkError = (output) => {
  try {
    const parsed = JSON.parse(String(output || "").trim());
    return parsed.error || parsed;
  } catch {
    return { message: String(output || "").trim() };
  }
};

const fetchFeishuWithLarkCli = async (docUrl) => {
  try {
    const { stdout } = await execFileAsync(
      larkNodeBin,
      [
        larkCliEntry,
        "docs",
        "+fetch",
        "--api-version",
        "v2",
        "--as",
        "user",
        "--doc",
        docUrl,
        "--doc-format",
        "markdown",
        "--format",
        "json",
      ],
      { windowsHide: true, maxBuffer: 20 * 1024 * 1024 },
    );
    const result = parseLarkCliJson(stdout);
    if (!result.ok) return { ok: false, larkError: result.error || result };

    const document = result.data?.document || {};
    const content = document.content || "";
    const text = normalizeDocText(content, { preserveHeadings: true });
    if (!text) {
      return {
        ok: false,
        code: "NO_READABLE_TEXT",
        message: "飞书 API 已返回文档，但没有解析到正文。",
        lark: result,
      };
    }

    const title = document.title || stripMarkdownHeading(splitText(text)[0]) || "飞书文档";
    const persisted = await persistImport({
      docUrl,
      title,
      text,
      content,
      finalUrl: docUrl,
      source: "lark-cli",
    });
    const sourceBrief = await persistSourceBriefPreview(persisted.importId, text);

    return {
      ok: true,
      title,
      finalUrl: docUrl,
      text,
      paragraphCount: splitText(text).length,
      source: "lark-cli",
      import_id: persisted.importId,
      paths: {
        import_root: persisted.importRoot,
        import_manifest: resolve(persisted.importRoot, "import_manifest.json"),
        script_segments: resolve(persisted.importRoot, "script_segments.json"),
        feishu_asset_index: resolve(persisted.importRoot, "feishu_asset_index.json"),
        normalized_script: resolve(persisted.importRoot, "normalized_script.txt"),
        source_brief: resolve(persisted.importRoot, "source_brief_preview.json"),
      },
      stats: persisted.manifest.stats,
      source_brief: sourceBrief,
      assets: persisted.assets.map((asset) => ({
        asset_id: asset.asset_id,
        local_url: asset.local_url,
        mime: asset.mime,
        size: asset.size,
        sha1: asset.sha1,
        download_status: asset.download_status,
        alt: asset.alt,
        error: asset.error,
      })),
      segments: persisted.segments.slice(0, 12).map((segment) => ({
        segment_id: segment.segment_id,
        order: segment.order,
        text_preview: segment.raw_text.slice(0, 120),
        status: segment.status,
      })),
    };
  } catch (error) {
    const larkError = extractLarkError(`${error.stdout || ""}${error.stderr || ""}`);
    return {
      ok: false,
      larkError,
      message: larkError.message || error.message || "lark-cli 读取飞书失败。",
    };
  }
};

const larkErrorToResponse = (larkError) => {
  const missing = larkError?.missing_scopes || [];
  if (larkError?.subtype === "missing_scope" || missing.length) {
    return {
      ok: false,
      code: "AUTH_REQUIRED",
      message: `飞书授权缺少 scope：${missing.join(" ") || "unknown"}。请完成飞书授权后再读取。`,
      missing_scopes: missing,
      auth_hint: larkError.hint,
    };
  }

  return {
    ok: false,
    code: "LARK_CLI_FAILED",
    message: larkError?.message || "lark-cli 读取飞书失败。",
    lark_error: larkError,
  };
};

const importFeishu = async (url) => {
  const parsed = new URL(url);
  if (!/^https?:$/.test(parsed.protocol)) {
    return { ok: false, code: "INVALID_URL", message: "只支持 http/https 飞书链接。" };
  }

  const larkResult = await fetchFeishuWithLarkCli(parsed.href);
  if (larkResult.ok) return larkResult;
  if (larkResult.larkError) return larkErrorToResponse(larkResult.larkError);

  const result = await fetch(parsed.href, {
    redirect: "follow",
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  const html = await result.text();
  const finalUrl = result.url || parsed.href;

  if (/accounts\.feishu\.cn|accounts\.larksuite\.com/i.test(finalUrl) || /suite-passport|login_redirect/i.test(html)) {
    return {
      ok: false,
      code: "AUTH_REQUIRED",
      message: "飞书页面跳转到登录页，当前环境没有可用授权。",
    };
  }

  const text = htmlToReadableText(html, { preserveHeadings: true });
  if (!text) return { ok: false, code: "NO_READABLE_TEXT", message: "页面可访问，但没有解析到可读正文。" };
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = stripMarkdownHeading(decodeEntities(titleMatch?.[1] || splitText(text)[0] || "飞书文档"));
  const persisted = await persistImport({
    docUrl: parsed.href,
    title,
    text,
    content: html,
    finalUrl,
    source: "public-html",
  });
  const sourceBrief = await persistSourceBriefPreview(persisted.importId, text);

  return {
    ok: true,
    title,
    finalUrl,
    text,
    paragraphCount: splitText(text).length,
    source: "public-html",
    import_id: persisted.importId,
    paths: {
      import_root: persisted.importRoot,
      import_manifest: resolve(persisted.importRoot, "import_manifest.json"),
      script_segments: resolve(persisted.importRoot, "script_segments.json"),
      feishu_asset_index: resolve(persisted.importRoot, "feishu_asset_index.json"),
      normalized_script: resolve(persisted.importRoot, "normalized_script.txt"),
      source_brief: resolve(persisted.importRoot, "source_brief_preview.json"),
    },
    stats: persisted.manifest.stats,
    source_brief: sourceBrief,
    assets: persisted.assets,
    segments: persisted.segments.slice(0, 12),
  };
};

const cleanLine = (value) => String(value || "").replace(/\s+/g, " ").trim();
const hasAny = (text, patterns) => patterns.some((pattern) => pattern.test(text));

const clampScore = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));
const styleDnaFileForStyle = (styleFile) => `${styleFile}.dna.json`;
const styleDnaVersionDirectoryForStyle = (styleFile) => resolve(styleDnaVersionsRoot, safeFilePart(basename(styleFile, ".md"), "style"));
const styleDnaVersionManifestForStyle = (styleFile) => join(styleDnaVersionDirectoryForStyle(styleFile), "manifest.json");

const dnaVersionComparable = (dna) => {
  const normalized = normalizeStyleDna(dna);
  if (!normalized) return "";
  const copy = JSON.parse(JSON.stringify(normalized));
  if (copy.style_metadata) {
    delete copy.style_metadata.analyzed_at;
    delete copy.style_metadata.version;
  }
  return JSON.stringify(copy);
};

const loadStyleDnaVersions = async (styleFile) => {
  const manifest = await readJsonFile(styleDnaVersionManifestForStyle(styleFile), null);
  const versions = Array.isArray(manifest?.versions) ? manifest.versions : [];
  return {
    latest_version: Number(manifest?.latest_version || 0),
    versions: versions.slice(-8).reverse(),
  };
};

const loadStyleDnaVersion = async (styleFile, requestedVersion) => {
  const version = Number(requestedVersion);
  if (!Number.isInteger(version) || version < 1) throw new Error("DNA 版本号无效。");
  const manifest = await readJsonFile(styleDnaVersionManifestForStyle(styleFile), null);
  const versions = Array.isArray(manifest?.versions) ? manifest.versions : [];
  const selected = versions.find((item) => Number(item.version) === version);
  if (!selected?.file) throw new Error(`未找到 DNA v${version}。`);
  const directory = styleDnaVersionDirectoryForStyle(styleFile);
  const file = resolve(directory, selected.file);
  if (!isPathInside(file, directory)) throw new Error("DNA 版本文件路径无效。");
  const dna = normalizeStyleDna(await readJsonFile(file, null));
  if (!dna) throw new Error(`DNA v${version} 内容无效。`);
  return { version: selected, dna };
};

const persistStyleDnaVersion = async (styleFile, dna) => {
  const directory = styleDnaVersionDirectoryForStyle(styleFile);
  const manifestFile = styleDnaVersionManifestForStyle(styleFile);
  const existing = await readJsonFile(manifestFile, null);
  const existingVersions = Array.isArray(existing?.versions) ? existing.versions : [];
  const latest = existingVersions.at(-1);
  const latestFile = latest?.file ? resolve(directory, latest.file) : "";
  const latestDna = latestFile && isPathInside(latestFile, directory) ? normalizeStyleDna(await readJsonFile(latestFile, null)) : null;
  const comparable = dnaVersionComparable(dna);
  const unchanged = latestDna && comparable === dnaVersionComparable(latestDna);
  const version = unchanged ? Number(latest.version) : Number(existing?.latest_version || 0) + 1;
  const savedAt = new Date().toISOString();
  const metadata = dna.style_metadata || {};
  const approval = metadata.approval || {};
  const health = metadata.sample_health || {};
  const file = `v${String(version).padStart(4, "0")}.json`;
  const versionInfo = {
    version,
    saved_at: unchanged ? latest.saved_at : savedAt,
    file,
    approval_status: approval.status || "draft",
    change_reason: approval.change_reason || "",
    sample_health: {
      grade: health.grade || "unknown",
      unit_count: health.unit_count || metadata.sample_unit_count || 0,
      near_duplicate_pair_count: health.near_duplicate_pair_count || 0,
      template_candidate_count: health.template_candidate_count || 0,
      excluded_template_count: health.excluded_template_count || 0,
    },
  };

  if (!unchanged) {
    await mkdir(directory, { recursive: true });
    const snapshot = {
      ...dna,
      style_metadata: {
        ...metadata,
        version: versionInfo,
      },
    };
    await writeFile(join(directory, file), `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    existingVersions.push(versionInfo);
    await writeFile(
      manifestFile,
      `${JSON.stringify({ schema_version: "1.0", style_id: basename(styleFile), latest_version: version, versions: existingVersions }, null, 2)}\n`,
      "utf8",
    );
  }
  return { ...versionInfo, created: !unchanged };
};

const countTextMatches = (text, patterns) =>
  (Array.isArray(patterns) ? patterns : [patterns]).reduce(
    (total, pattern) => total + (String(text || "").match(pattern)?.length || 0),
    0,
  );

const rounded = (value, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
};

const sentenceLengths = (text) =>
  String(text || "")
    .split(/[。！？!?]+/)
    .map((sentence) => sentence.replace(/\s+/g, "").length)
    .filter((length) => length > 0);

const median = (values) => {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : rounded((sorted[middle - 1] + sorted[middle]) / 2);
};

const styleCorpusUnits = (sourceText) => {
  const text = normalizeDocText(sourceText, { preserveHeadings: true }).trim();
  if (!text) return { units: [], strategy: "empty" };
  const explicit = text
    .split(/\n\s*(?:---{3,}|={3,})\s*\n/g)
    .map((unit) => unit.trim())
    .filter(Boolean);
  if (explicit.length >= 2) return { units: explicit, strategy: "separator" };

  const lines = text.split(/\r?\n/);
  const sections = [];
  let current = [];
  for (const line of lines) {
    if (/^#{1,2}\s+/.test(line) && current.join("\n").trim()) {
      sections.push(current.join("\n").trim());
      current = [];
    }
    current.push(line);
  }
  if (current.join("\n").trim()) sections.push(current.join("\n").trim());
  if (sections.length >= 2) return { units: sections, strategy: "headings" };
  return { units: [text], strategy: "single_document" };
};

const characterTrigramSet = (value) => {
  const normalized = String(value || "").replace(/[#*`>\s\p{P}]/gu, "");
  const set = new Set();
  for (let index = 0; index <= normalized.length - 3; index += 1) set.add(normalized.slice(index, index + 3));
  return set;
};

const jaccard = (left, right) => {
  if (!left.size && !right.size) return 0;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  return intersection / Math.max(1, left.size + right.size - intersection);
};

const repeatedTemplateCandidates = (units) => {
  if (units.length < 2) return [];
  const unitSentenceSets = units.map((unit) => {
    const seen = new Set();
    const candidates = String(unit || "")
      .split(/\r?\n|[。！？!?]/)
      .map((part) => part.replace(/^#{1,6}\s+/, "").replace(/[*`]/g, "").replace(/\s+/g, "").trim())
      .filter((part) => part.length >= 8 && part.length <= 72);
    for (const candidate of candidates) seen.add(candidate);
    return seen;
  });
  const coverage = new Map();
  for (const sentences of unitSentenceSets) {
    for (const sentence of sentences) coverage.set(sentence, (coverage.get(sentence) || 0) + 1);
  }
  const threshold = Math.max(2, Math.ceil(units.length * 0.6));
  return [...coverage.entries()]
    .filter(([, count]) => count >= threshold)
    .sort((left, right) => right[1] - left[1] || right[0].length - left[0].length)
    .slice(0, 8)
    .map(([phrase, count], index) => ({ id: `template-${index + 1}`, phrase, coverage_count: count, coverage_ratio: rounded(count / units.length, 2) }));
};

const assessStyleSampleHealth = (sourceText, options = {}) => {
  const corpus = styleCorpusUnits(sourceText);
  const units = corpus.units;
  const lengths = units.map((unit) => unit.replace(/\s+/g, "").length);
  const trigrams = units.map(characterTrigramSet);
  const nearDuplicates = [];
  for (let left = 0; left < trigrams.length; left += 1) {
    for (let right = left + 1; right < trigrams.length; right += 1) {
      const similarity = rounded(jaccard(trigrams[left], trigrams[right]), 2);
      if (similarity >= 0.78) nearDuplicates.push({ left_unit: left + 1, right_unit: right + 1, similarity });
    }
  }
  const templateCandidates = repeatedTemplateCandidates(units);
  const excluded = [...new Set(Array.isArray(options.template_exclusions || options.templateExclusions) ? options.template_exclusions : [])]
    .map((phrase) => String(phrase || "").trim())
    .filter(Boolean)
    .filter((phrase) => templateCandidates.some((candidate) => candidate.phrase === phrase));
  const maximum = Math.max(0, ...lengths);
  const total = lengths.reduce((sum, value) => sum + value, 0);
  const dominantRatio = total ? rounded(maximum / total, 2) : 0;
  const warnings = [];
  if (units.length < 3) warnings.push("样本单元少于 3 个，暂时无法区分稳定风格与单篇偶然写法。");
  if (nearDuplicates.length) warnings.push(`发现 ${nearDuplicates.length} 组高相似样本；近重复会放大单一写法。`);
  if (dominantRatio >= 0.65 && units.length >= 3) warnings.push("存在单一长样本占比过高，建议补充长度更均衡的样本。");
  if (templateCandidates.length && !excluded.length) warnings.push("发现跨样本重复句，先确认它们是模板还是个人表达，再保存 DNA。");
  const grade = units.length < 3 || nearDuplicates.length >= 2 ? "serious" : warnings.length ? "warning" : "healthy";
  return {
    schema_version: "1.0",
    grade,
    unit_strategy: corpus.strategy,
    unit_count: units.length,
    character_distribution: { min: lengths.length ? Math.min(...lengths) : 0, median: median(lengths), max: maximum, dominant_unit_ratio: dominantRatio },
    near_duplicate_pair_count: nearDuplicates.length,
    near_duplicates: nearDuplicates.slice(0, 8),
    template_candidate_count: templateCandidates.length,
    template_candidates: templateCandidates,
    excluded_template_count: excluded.length,
    excluded_template_phrases: excluded,
    review_required: Boolean(templateCandidates.length || warnings.length),
    warnings,
    limitations: "健康报告只用于样本质量诊断；模板候选不会自动删除，也不会写入保存的 Style DNA。",
  };
};

const removeSelectedTemplates = (sourceText, phrases = []) => {
  let result = String(sourceText || "");
  for (const phrase of phrases) {
    if (!phrase) continue;
    result = result.split(phrase).join("");
  }
  return result;
};

const confidenceForStyleDna = (characterCount, unitCount) => {
  const textBonus = Math.min(characterCount / 20000, 0.15);
  const value =
    unitCount >= 20
      ? Math.min(0.9, rounded(0.72 + textBonus, 2))
      : unitCount >= 10
        ? Math.min(0.74, rounded(0.57 + textBonus, 2))
        : unitCount >= 3
          ? Math.min(0.59, rounded(0.4 + textBonus, 2))
          : Math.min(0.42, rounded(0.24 + textBonus, 2));
  return {
    value,
    label: unitCount >= 20 ? "高" : unitCount >= 10 ? "中" : unitCount >= 3 ? "初步可用" : "初步",
    note:
      unitCount >= 20
        ? "样本数量达到稳定风格蒸馏的最低建议值，仍需覆盖不同主题交叉验证。"
        : `当前只有 ${unitCount} 个样本单元；用于生成可编辑风格卡可以，但不能宣称为稳定作者风格。`,
  };
};

const styleAxisLabels = {
  oralness: "口播感",
  energy: "能量",
  directness: "直接性",
  evidence_density: "证据密度",
  conversion_intensity: "转化力度",
};

const extractStyleDna = (sourceText, options = {}) => {
  const source = normalizeDocText(sourceText, { preserveHeadings: true }).trim();
  if (!source) throw new Error("风格提取文本为空。");
  const sampleHealth = assessStyleSampleHealth(source, options);
  const text = removeSelectedTemplates(source, sampleHealth.excluded_template_phrases).trim();
  if (!text) throw new Error("剥离所选模板后没有可用于提取风格的文本。");

  const lines = splitText(text);
  const lengths = sentenceLengths(text);
  const characterCount = text.replace(/\s+/g, "").length;
  const sentenceCount = Math.max(1, lengths.length);
  const averageSentenceLength = rounded(lengths.reduce((sum, length) => sum + length, 0) / sentenceCount);
  const shortSentenceRatio = rounded(lengths.filter((length) => length <= 22).length / sentenceCount, 2);
  const headingCount = lines.filter((line) => /^#{1,6}\s/.test(line)).length;
  const requestedUnitCount = Number(options.sample_count || options.sampleCount);
  const inferredUnitCount = Math.max(1, headingCount || Math.round(lines.length / 8) || 1);
  const sampleUnitCount = Number.isFinite(requestedUnitCount) && requestedUnitCount > 0 ? Math.floor(requestedUnitCount) : sampleHealth.unit_count || inferredUnitCount;

  const questions = countTextMatches(text, /[？?]/g);
  const exclamations = countTextMatches(text, /[！!]/g);
  const numberedSteps = countTextMatches(text, /(?:第[一二三四五六七八九十\d]+|[一二三四五六七八九十]+、|\d+[、.)])/g);
  const evidenceSignals = countTextMatches(text, /截图|数据|订单|销量|成本|价格|对比|案例|后台|搜索|表格|清单|模板|证明/g);
  const ctaSignals = countTextMatches(text, /点赞|收藏|关注|评论|回复|私信|领取|截图保存|下期|关键词/g);
  const riskSignals = countTextMatches(text, /风险|违规|侵权|禁售|承诺|保证|躺赚|必爆|自动化|多账号/g);
  const transitionSignals = countTextMatches(text, /今天|接下来|这里|重点|一定要|记住|最后一点|简单来说|原因很简单|不是.+而是/g);
  const intensitySignals = countTextMatches(text, /保姆级|讲清楚|讲透|毫无保留|踩坑|排雷|爆品|少走弯路/g);
  const hookSignals = {
    pain_first: countTextMatches(text, /新手|小白|不会|不知道|卡住|踩坑|麻烦/g),
    proof_first: countTextMatches(text, /数据|销量|订单|截图|案例|对比/g),
    warning_first: countTextMatches(text, /先别|避坑|排雷|风险|注意/g),
    contrast_first: countTextMatches(text, /不是.+而是|从.+到|差在哪里|为什么/g),
  };

  const perThousandCharacters = (count) => (count / Math.max(characterCount, 1)) * 1000;
  const numberedRate = perThousandCharacters(numberedSteps);
  const evidenceRate = perThousandCharacters(evidenceSignals);
  const ctaRate = perThousandCharacters(ctaSignals);
  const transitionRate = perThousandCharacters(transitionSignals);
  const intensityRate = perThousandCharacters(intensitySignals);
  const warningRate = perThousandCharacters(hookSignals.warning_first);
  const questionRate = questions / sentenceCount;
  const exclamationRate = exclamations / sentenceCount;

  const axes = {
    oralness: clampScore(30 + Math.min(transitionRate * 8, 30) + Math.min(questionRate * 32, 12) + Math.min(numberedRate * 3, 14) + shortSentenceRatio * 18),
    energy: clampScore(22 + Math.min(exclamationRate * 18, 10) + Math.min(intensityRate * 15, 34) + Math.min(warningRate * 8, 16) + Math.min(questionRate * 12, 8)),
    directness: clampScore(36 + shortSentenceRatio * 28 + Math.min(numberedRate * 2.2, 18) + Math.min(questionRate * 12, 10) - Math.max(0, averageSentenceLength - 42) * 0.7),
    evidence_density: clampScore(10 + Math.min(evidenceRate * 10, 68)),
    conversion_intensity: clampScore(8 + Math.min(ctaRate * 18, 70) + Math.min(numberedRate * 1.5, 10)),
  };

  const signatureSignals = [
    "今天",
    "接下来",
    "这里",
    "重点",
    "一定要",
    "记住",
    "最后一点",
    "不是",
    "而是",
    "简单来说",
    "原因很简单",
  ]
    .map((phrase) => ({ phrase, count: countTextMatches(text, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || a.phrase.localeCompare(b.phrase, "zh-Hans-CN"))
    .slice(0, 8);

  const baseConfidence = confidenceForStyleDna(characterCount, sampleUnitCount);
  const reviewConfirmed = Boolean(options.health_review_confirmed || options.healthReviewConfirmed || options.review_confirmed || options.reviewConfirmed);
  const confidence =
    sampleHealth.grade === "serious"
      ? { value: Math.min(baseConfidence.value, 0.35), label: "样本待清理", note: "样本数量或近重复存在明显问题；可先预览，但不应当把它当作稳定风格。" }
      : sampleHealth.grade === "warning"
        ? { value: Math.min(baseConfidence.value, 0.52), label: "待复核", note: "样本存在需要人工复核的模板、长度或相似度问题；确认后再保存为可用风格卡。" }
        : baseConfidence;
  const safeHealth = {
    grade: sampleHealth.grade,
    unit_strategy: sampleHealth.unit_strategy,
    unit_count: sampleHealth.unit_count,
    character_distribution: sampleHealth.character_distribution,
    near_duplicate_pair_count: sampleHealth.near_duplicate_pair_count,
    template_candidate_count: sampleHealth.template_candidate_count,
    excluded_template_count: sampleHealth.excluded_template_count,
    review_required: sampleHealth.review_required,
    review_status: sampleHealth.review_required ? (reviewConfirmed ? "reviewed" : "needs_review") : "not_required",
    warnings: sampleHealth.warnings,
    limitations: sampleHealth.limitations,
  };
  const dna = {
    schema_version: "1.1",
    style_metadata: {
      content_type: String(options.content_type || options.contentType || "中文短视频口播"),
      sample_unit_count: sampleUnitCount,
      character_count: characterCount,
      confidence,
      sample_health: safeHealth,
      source_boundary: "仅保存可复用风格信号；不保存或授权复用来源事实、收益、案例、账号、素材链接或 CTA 关键词。",
      analyzed_at: new Date().toISOString(),
    },
    metrics: {
      paragraph_count: lines.length,
      sentence_count: sentenceCount,
      average_sentence_length: averageSentenceLength,
      short_sentence_ratio: shortSentenceRatio,
      question_count: questions,
      exclamation_count: exclamations,
      heading_count: headingCount,
      numbered_step_count: numberedSteps,
      evidence_signal_count: evidenceSignals,
      cta_signal_count: ctaSignals,
      risk_signal_count: riskSignals,
      transition_signal_count: transitionSignals,
      intensity_signal_count: intensitySignals,
    },
    axes,
    signature_signals: signatureSignals,
    structure: {
      hook_signals: hookSignals,
      numbered_method_signal: numberedSteps > 0,
      interaction_signal: ctaSignals > 0,
      evidence_signal: evidenceSignals > 0,
      risk_signal: riskSignals > 0,
    },
    replication_blueprint: {
      do: [
        axes.oralness >= 55 ? "使用口语推进词，把每段限制为一个推进动作。" : "保持清晰直接，不强行堆叠口语连接词。",
        numberedSteps > 0 ? "先交代框架，再用编号推进方法或判断维度。" : "按样本中的自然段落节奏推进，不强行套编号。",
        evidenceSignals > 0 ? "让截图、数据、清单或页面承担具体证明职责。" : "只有真实素材能证明时才加入证据位。",
        ctaSignals > 0 ? "保留互动和 CTA 的形态，但使用新稿自己的渠道、关键词和交付物。" : "CTA 以用户自己的目标为准，不从样本补造。",
      ],
      do_not: [
        "不复制来源样本的具体产品、收益、案例、资源清单、账号名、关键词或平台操作。",
        "不把 Style DNA 分数当成事实真实性、合规性或商业效果证明。",
      ],
    },
  };
  return { dna, sample_health: sampleHealth };
};

const summarizeStyleDna = (dna) => {
  if (!dna?.axes) return null;
  return {
    confidence: dna.style_metadata?.confidence || null,
    axes: dna.axes,
    metrics: {
      sample_unit_count: dna.style_metadata?.sample_unit_count || 0,
      character_count: dna.style_metadata?.character_count || 0,
      average_sentence_length: dna.metrics?.average_sentence_length || 0,
      numbered_step_count: dna.metrics?.numbered_step_count || 0,
      evidence_signal_count: dna.metrics?.evidence_signal_count || 0,
      cta_signal_count: dna.metrics?.cta_signal_count || 0,
    },
    signature_signals: (dna.signature_signals || []).slice(0, 6),
  };
};

const styleDnaMarkdown = (name, dna) => {
  const confidence = dna.style_metadata?.confidence || {};
  const signatureText = (dna.signature_signals || []).map((item) => `\`${item.phrase}\`（${item.count}）`).join("、") || "未检测到稳定高频推进词";
  const hookSignals = Object.entries(dna.structure?.hook_signals || {})
    .filter(([, count]) => Number(count) > 0)
    .map(([key, count]) => `${key}（${count}）`)
    .join("、");
  return `# ${name}\n\n## Style DNA 使用范围与置信度\n\n- 内容类型：${dna.style_metadata?.content_type || "中文短视频口播"}\n- 样本单元：${dna.style_metadata?.sample_unit_count || 1}\n- 样本字符：${dna.style_metadata?.character_count || 0}\n- 置信度：${confidence.label || "初步"}（${confidence.value ?? 0}）\n- 说明：${confidence.note || "需要补充更多完整样本。"}\n\n## L1 语言与口播节奏\n\n- 平均句长：${dna.metrics?.average_sentence_length || 0} 字；短句占比：${dna.metrics?.short_sentence_ratio || 0}\n- 高频推进信号：${signatureText}\n- 口播感：${dna.axes?.oralness ?? 0}/100；能量：${dna.axes?.energy ?? 0}/100；直接性：${dna.axes?.directness ?? 0}/100。\n\n## L2 结构与说服路径\n\n- 钩子信号：${hookSignals || "当前样本不足以判断稳定钩子类型"}\n- 编号方法信号：${dna.structure?.numbered_method_signal ? "有" : "弱"}\n- 互动信号：${dna.structure?.interaction_signal ? "有" : "弱"}\n- 证据位信号：${dna.structure?.evidence_signal ? "有" : "弱"}\n\n## L3 证据、CTA 与风险边界\n\n- 证据密度：${dna.axes?.evidence_density ?? 0}/100；转化力度：${dna.axes?.conversion_intensity ?? 0}/100。\n- 风险信号计数：${dna.metrics?.risk_signal_count || 0}。风险词只用于提醒，不能自动变成新稿事实。\n- CTA 只复用互动形态；渠道、关键词、资料包和承诺必须来自新稿。\n\n## 可执行改写约束\n\n${(dna.replication_blueprint?.do || []).map((item) => `- ${item}`).join("\n")}\n\n## 不可吸收内容\n\n${(dna.replication_blueprint?.do_not || []).map((item) => `- ${item}`).join("\n")}\n`;
};

const normalizeStyleDna = (dna) => {
  if (!dna || typeof dna !== "object" || !dna.axes) return null;
  const nonNegativeInteger = (value) => Math.max(0, Math.round(Number(value) || 0));
  const metadata = dna.style_metadata && typeof dna.style_metadata === "object" ? dna.style_metadata : {};
  const confidence = metadata.confidence && typeof metadata.confidence === "object" ? metadata.confidence : {};
  const health = metadata.sample_health && typeof metadata.sample_health === "object" ? metadata.sample_health : {};
  const approval = metadata.approval && typeof metadata.approval === "object" ? metadata.approval : {};
  const metrics = dna.metrics && typeof dna.metrics === "object" ? dna.metrics : {};
  const structure = dna.structure && typeof dna.structure === "object" ? dna.structure : {};
  const hookSignals = structure.hook_signals && typeof structure.hook_signals === "object" ? structure.hook_signals : {};
  const allowedSignals = new Set(["今天", "接下来", "这里", "重点", "一定要", "记住", "最后一点", "不是", "而是", "简单来说", "原因很简单"]);
  const axes = {};
  for (const key of Object.keys(styleAxisLabels)) axes[key] = clampScore(Number(dna.axes[key] || 0));
  return {
    // Persist only the project-owned DNA contract. Unknown caller fields cannot enter snapshots.
    schema_version: "1.1",
    axes,
    style_metadata: {
      content_type: cleanLine(metadata.content_type || "中文短视频口播").slice(0, 80) || "中文短视频口播",
      sample_unit_count: nonNegativeInteger(metadata.sample_unit_count),
      character_count: nonNegativeInteger(metadata.character_count),
      confidence: {
        value: Math.max(0, Math.min(1, Number(confidence.value) || 0)),
        label: cleanLine(confidence.label || "初步").slice(0, 32) || "初步",
        note: cleanLine(confidence.note || "需要补充更多完整样本。").slice(0, 160),
      },
      sample_health: {
        grade: ["healthy", "warning", "serious"].includes(health.grade) ? health.grade : "unknown",
        unit_strategy: ["separator", "headings", "single_document", "empty"].includes(health.unit_strategy) ? health.unit_strategy : "unknown",
        unit_count: nonNegativeInteger(health.unit_count),
        character_distribution: {
          min: nonNegativeInteger(health.character_distribution?.min),
          median: nonNegativeInteger(health.character_distribution?.median),
          max: nonNegativeInteger(health.character_distribution?.max),
          dominant_unit_ratio: Math.max(0, Math.min(1, Number(health.character_distribution?.dominant_unit_ratio) || 0)),
        },
        near_duplicate_pair_count: nonNegativeInteger(health.near_duplicate_pair_count),
        template_candidate_count: nonNegativeInteger(health.template_candidate_count),
        excluded_template_count: nonNegativeInteger(health.excluded_template_count),
        review_required: Boolean(health.review_required),
        review_status: ["reviewed", "needs_review", "not_required"].includes(health.review_status) ? health.review_status : "needs_review",
        warnings: [],
        limitations: "健康报告只用于样本质量诊断；模板候选不会自动删除，也不会写入保存的 Style DNA。",
      },
      approval: {
        status: approval.status === "approved" ? "approved" : "draft",
        reviewed_at: typeof approval.reviewed_at === "string" ? approval.reviewed_at : null,
        change_reason: cleanLine(approval.change_reason || "").slice(0, 240),
      },
      source_boundary: "仅保存可复用风格信号；不保存或授权复用来源事实、收益、案例、账号、素材链接或 CTA 关键词。",
    },
    metrics: {
      paragraph_count: nonNegativeInteger(metrics.paragraph_count),
      sentence_count: nonNegativeInteger(metrics.sentence_count),
      average_sentence_length: Math.max(0, Number(metrics.average_sentence_length) || 0),
      short_sentence_ratio: Math.max(0, Math.min(1, Number(metrics.short_sentence_ratio) || 0)),
      question_count: nonNegativeInteger(metrics.question_count),
      exclamation_count: nonNegativeInteger(metrics.exclamation_count),
      heading_count: nonNegativeInteger(metrics.heading_count),
      numbered_step_count: nonNegativeInteger(metrics.numbered_step_count),
      evidence_signal_count: nonNegativeInteger(metrics.evidence_signal_count),
      cta_signal_count: nonNegativeInteger(metrics.cta_signal_count),
      risk_signal_count: nonNegativeInteger(metrics.risk_signal_count),
      transition_signal_count: nonNegativeInteger(metrics.transition_signal_count),
      intensity_signal_count: nonNegativeInteger(metrics.intensity_signal_count),
    },
    signature_signals: (Array.isArray(dna.signature_signals) ? dna.signature_signals : [])
      .filter((item) => allowedSignals.has(item?.phrase))
      .map((item) => ({ phrase: item.phrase, count: nonNegativeInteger(item.count) }))
      .slice(0, 8),
    structure: {
      hook_signals: {
        pain_first: nonNegativeInteger(hookSignals.pain_first),
        proof_first: nonNegativeInteger(hookSignals.proof_first),
        warning_first: nonNegativeInteger(hookSignals.warning_first),
        contrast_first: nonNegativeInteger(hookSignals.contrast_first),
      },
      numbered_method_signal: Boolean(structure.numbered_method_signal),
      interaction_signal: Boolean(structure.interaction_signal),
      evidence_signal: Boolean(structure.evidence_signal),
      risk_signal: Boolean(structure.risk_signal),
    },
    replication_blueprint: {
      do: [
        axes.oralness >= 55 ? "使用口语推进词，把每段限制为一个推进动作。" : "保持清晰直接，不强行堆叠口语连接词。",
        structure.numbered_method_signal ? "先交代框架，再用编号推进方法或判断维度。" : "按样本中的自然段落节奏推进，不强行套编号。",
        structure.evidence_signal ? "让截图、数据、清单或页面承担具体证明职责。" : "只有真实素材能证明时才加入证据位。",
        structure.interaction_signal ? "保留互动和 CTA 的形态，但使用新稿自己的渠道、关键词和交付物。" : "CTA 以用户自己的目标为准，不从样本补造。",
      ],
      do_not: [
        "不复制来源样本的具体产品、收益、案例、资源清单、账号名、关键词或平台操作。",
        "不把 Style DNA 分数当成事实真实性、合规性或商业效果证明。",
      ],
    },
  };
};

const scoreStyleMatch = (candidateText, targetDna) => {
  const target = normalizeStyleDna(targetDna);
  if (!target) return { available: false, message: "所选风格卡还没有保存 Style DNA，先从参考样本提取并保存。" };
  const candidate = extractStyleDna(candidateText, { sample_count: 1, content_type: "待评估改写稿" }).dna;
  const dimensions = Object.entries(styleAxisLabels).map(([key, label]) => {
    const gap = Math.abs(Number(target.axes[key] || 0) - Number(candidate.axes[key] || 0));
    const score = clampScore(100 - gap * 1.35);
    const targetValue = target.axes[key];
    const candidateValue = candidate.axes[key];
    const direction = candidateValue < targetValue ? "提高" : candidateValue > targetValue ? "收敛" : "保持";
    return {
      key,
      label,
      target: targetValue,
      actual: candidateValue,
      score,
      advice: gap <= 10 ? `${label}接近目标。` : `${direction}${label}，再贴近目标信号。`,
    };
  });
  const weights = { oralness: 1.2, energy: 1.1, directness: 1.1, evidence_density: 1.35, conversion_intensity: 1.05 };
  const totalWeight = dimensions.reduce((sum, item) => sum + weights[item.key], 0);
  const overall = Math.round(dimensions.reduce((sum, item) => sum + item.score * weights[item.key], 0) / totalWeight);
  return {
    available: true,
    overall,
    verdict: overall >= 82 ? "风格信号接近目标，可继续做事实与风险审查。" : overall >= 65 ? "基本接近，但仍有可修正的风格漂移。" : "风格漂移明显，建议按各轴提示调整后再写。",
    dimensions,
    candidate_dna: summarizeStyleDna(candidate),
    limitations: "分数只衡量本地可解释风格信号，不能证明事实正确、平台合规、商业效果或作者身份相同。",
  };
};

const uniquePush = (list, value, limit = 12) => {
  const text = cleanLine(value);
  if (!text || list.includes(text) || list.length >= limit) return;
  list.push(text);
};

const extractSourceBrief = (sourceText, assetContext = {}) => {
  const lines = splitText(sourceText);
  const brief = {
    topic: stripMarkdownHeading(lines.find((line) => line.length >= 4) || "").slice(0, 90),
    market_signals: [],
    product_or_offer: [],
    target_people: [],
    demand_reasons: [],
    operation_steps: [],
    resource_assets: [],
    monetization_points: [],
    compliance_risks: [],
    cta: [],
    imported_assets: (assetContext.assets || []).slice(0, 12).map((asset) => ({
      asset_id: asset.asset_id,
      caption: asset.alt || "",
      context_before: asset.context_before || "",
      context_after: asset.context_after || "",
    })),
  };

  for (const line of lines) {
    if (hasAny(line, [/\d+(\.\d+)?\s*(万|千|百|元|块|单|人|%)/, /浏览|想要|成交|订单|销量|成本|利润|价格|售价|标价|后台|截图/])) {
      uniquePush(brief.market_signals, line, 16);
    }
    if (hasAny(line, [/卖|产品|服务|资料|课程|教程|工具|模板|表格|清单|软件|资源包|交付|领取|项目|闲鱼|电商/])) {
      uniquePush(brief.product_or_offer, line, 14);
    }
    if (hasAny(line, [/新手|小白|学生|宝妈|上班族|副业|普通人|客户|用户|人群|适合/])) {
      uniquePush(brief.target_people, line, 10);
    }
    if (hasAny(line, [/为什么|需求|痛点|刚需|不会|不知道|担心|麻烦|省时间|信息差|找不到|不会做/])) {
      uniquePush(brief.demand_reasons, line, 12);
    }
    if (hasAny(line, [/第一|第二|第三|第四|步骤|流程|先|再|然后|最后|搜索|上架|发布|注册|开通|整理|包装|设置|发货|成交|引流/])) {
      uniquePush(brief.operation_steps, line, 18);
    }
    if (hasAny(line, [/截图|图片|素材|表格|清单|模板|资料包|网盘|链接|话术|SOP|sop|案例|证据|文件|文档/])) {
      uniquePush(brief.resource_assets, line, 18);
    }
    if (hasAny(line, [/收益|赚钱|利润|分成|佣金|拉新|复购|成本|卖出|一单|变现|副业/])) {
      uniquePush(brief.monetization_points, line, 12);
    }
    if (hasAny(line, [/违规|风险|侵权|版权|隐私|承诺|保证|必|禁售|敏感|售后|医疗|金融|法律|资质|自动化|多账号/])) {
      uniquePush(brief.compliance_risks, line, 12);
    }
    if (hasAny(line, [/评论|回复|私信|领取|关注|点赞|收藏|截图保存|下期|公众号|关键词|资料/])) {
      uniquePush(brief.cta, line, 12);
    }
  }

  return brief;
};

const persistSourceBriefPreview = async (importId, sourceText) => {
  const assetContext = await loadImportAssetContext(importId);
  const sourceBrief = extractSourceBrief(sourceText, assetContext);
  const importRoot = resolve(importsRoot, importId);
  await writeFile(resolve(importRoot, "source_brief_preview.json"), JSON.stringify(sourceBrief, null, 2), "utf8");
  return sourceBrief;
};

const formatBriefList = (items) =>
  items?.length ? items.map((item) => `- ${item}`).join("\n") : "- 未提取到，改写时不要自行编造";

const sourceBriefPrompt = (brief) => `从飞书原稿提取出的关键信息，改写时必须优先使用这些信息：

主题：
- ${brief.topic || "未提取到明确主题，按原稿整体判断"}

市场数据/证据：
${formatBriefList(brief.market_signals)}

卖什么/交付什么：
${formatBriefList(brief.product_or_offer)}

目标人群：
${formatBriefList(brief.target_people)}

需求为什么存在：
${formatBriefList(brief.demand_reasons)}

实操流程/动作：
${formatBriefList(brief.operation_steps)}

资源清单/素材证据：
${formatBriefList(brief.resource_assets)}

收益/成本/变现相关：
${formatBriefList(brief.monetization_points)}

风险边界：
${formatBriefList(brief.compliance_risks)}

CTA/结尾：
${formatBriefList(brief.cta)}

已导入图片上下文：
${brief.imported_assets?.length
    ? brief.imported_assets
        .map((asset) =>
          `- ${asset.asset_id}: ${[asset.caption, asset.context_before, asset.context_after]
            .filter(Boolean)
            .join(" / ")
            .slice(0, 180)}`,
        )
        .join("\n")
    : "- 没有可用图片上下文"}`;

const modelConfig = async () => ({
  apiKey: process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "",
  baseUrl: (process.env.OPENAI_BASE_URL || process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, ""),
  model: process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-4.1",
  maxTokens: Number(process.env.WORKBENCH_AI_MAX_TOKENS || process.env.OPENAI_MAX_TOKENS || 3500),
  temperature: Number(process.env.WORKBENCH_AI_TEMPERATURE || 0.45),
  serviceTier: process.env.WORKBENCH_AI_SERVICE_TIER || "",
  reasoningEffort: process.env.WORKBENCH_AI_REASONING_EFFORT || "",
});

const fetchChatCompletion = async (cfg, body, timeoutMs = 120000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};

const ttsConfig = async () => ({
  apiKey: process.env.TTS_API_KEY || process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "",
  baseUrl: (process.env.TTS_BASE_URL || process.env.OPENAI_BASE_URL || process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(
    /\/+$/,
    "",
  ),
  model: process.env.TTS_MODEL || "gpt-4o-mini-tts",
  voice: process.env.TTS_VOICE || "alloy",
  format: String(process.env.TTS_FORMAT || "mp3").replace(/^\./, "").toLowerCase(),
});

const publicTtsConfig = async () => {
  const cfg = await ttsConfig();
  return {
    ok: true,
    configured: Boolean(cfg.apiKey),
    base_url: cfg.baseUrl,
    model: cfg.model,
    voice: cfg.voice,
    format: cfg.format,
    audio_root: audioRoot,
  };
};

const publicAudioId = (value) => {
  const audioId = String(value || "").trim();
  return /^audio_\d{14}$/.test(audioId) ? audioId : "";
};

const audioFormatExtension = (format) => {
  const normalized = String(format || "mp3").replace(/^\./, "").toLowerCase();
  if (["mp3", "wav", "aac", "m4a", "opus", "flac"].includes(normalized)) return normalized;
  return "mp3";
};

const fetchTtsSpeech = async (cfg, body, timeoutMs = 120000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${cfg.baseUrl}/audio/speech`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};

const stripHtmlForError = (value) =>
  String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 360);

const readableUpstreamError = (rawText, fallback) => {
  const raw = String(rawText || "").trim();
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return stripHtmlForError(parsed?.error?.message || parsed?.message || raw);
  } catch {
    return stripHtmlForError(raw);
  }
};

const synthesizeVoice = async (payload = {}) => {
  const input = splitText(payload.text || payload.input || "").join("\n\n");
  if (!input) {
    return { ok: false, code: "EMPTY_VOICE_TEXT", message: "语音合成文本为空，请先生成或粘贴文案。" };
  }
  if (input.length > 12000) {
    return { ok: false, code: "VOICE_TEXT_TOO_LONG", message: "单次语音合成文本超过 12000 字，请先分段。" };
  }

  const cfg = await ttsConfig();
  if (!cfg.apiKey) {
    return {
      ok: false,
      code: "TTS_NOT_CONFIGURED",
      message: "语音合成未配置 API Key。可在 .env.local 配置 TTS_API_KEY，或复用 OPENAI_API_KEY。",
      model: cfg.model,
      base_url: cfg.baseUrl,
    };
  }

  const format = audioFormatExtension(payload.format || cfg.format);
  const voice = String(payload.voice || cfg.voice || "alloy").trim();
  const model = String(payload.model || cfg.model || "gpt-4o-mini-tts").trim();
  const requestBody = {
    model,
    voice,
    input,
    response_format: format,
  };
  const speed = Number(payload.speed);
  if (Number.isFinite(speed) && speed > 0) requestBody.speed = speed;

  let ttsResponse;
  try {
    ttsResponse = await fetchTtsSpeech(cfg, requestBody);
  } catch (error) {
    return {
      ok: false,
      code: error?.name === "AbortError" ? "TTS_TIMEOUT" : "TTS_REQUEST_EXCEPTION",
      message: error instanceof Error ? error.message : "语音合成接口请求异常。",
      model,
      base_url: cfg.baseUrl,
    };
  }

  if (!ttsResponse.ok) {
    const errorText = await ttsResponse.text().catch(() => "");
    return {
      ok: false,
      code: "TTS_REQUEST_FAILED",
      message: readableUpstreamError(errorText, `语音合成接口请求失败：HTTP ${ttsResponse.status}`),
      model,
      base_url: cfg.baseUrl,
    };
  }

  const bytes = Buffer.from(await ttsResponse.arrayBuffer());
  if (!bytes.length) {
    return { ok: false, code: "TTS_EMPTY_AUDIO", message: "语音接口返回了空音频。", model, base_url: cfg.baseUrl };
  }

  const audioId = `audio_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
  const audioDir = resolve(audioRoot, audioId);
  await mkdir(audioDir, { recursive: true });
  const fileName = `voice.${format}`;
  const audioFile = resolve(audioDir, fileName);
  const scriptFile = resolve(audioDir, "voice_script.txt");
  const manifestFile = resolve(audioDir, "voice_manifest.json");
  const manifest = {
    audio_id: audioId,
    model,
    voice,
    format,
    character_count: input.replace(/\s/g, "").length,
    byte_length: bytes.length,
    source: "openai-compatible-audio-speech",
    base_url: cfg.baseUrl,
    created_at: new Date().toISOString(),
  };
  await writeFile(audioFile, bytes);
  await writeFile(scriptFile, input, "utf8");
  await writeFile(manifestFile, JSON.stringify(manifest, null, 2), "utf8");

  return {
    ok: true,
    audio_id: audioId,
    audio_url: `/audio/${audioId}/${fileName}`,
    model,
    voice,
    format,
    paths: {
      audio_root: audioDir,
      audio_file: audioFile,
      voice_script: scriptFile,
      voice_manifest: manifestFile,
    },
    manifest,
  };
};

const extractJsonObject = (text) => {
  const raw = String(text || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
      try {
        return JSON.parse(fenced[1].trim());
      } catch {
        // continue to bracket extraction
      }
    }
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
};

const cleanupRewriteScript = (value) =>
  String(value || "")
    .replace(/```(?:json|markdown|md)?/gi, "")
    .replace(/```/g, "")
    .replace(/^下面是.*?[:：]\s*/i, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const metaReferenceRules = [
  { label: "原稿/原文/原文案", pattern: /原[稿文](里|中|里面|当中|提到|写着|写了|有一句|说到|说的是)?|原文案/g },
  { label: "文案内部引用", pattern: /这[篇段条]?文案(里|中|里面|提到|写着|有一句)?|上面这段文案/g },
  { label: "飞书/资料内部引用", pattern: /飞书(文档)?(里|中|里面|提到|写着)?|资料(里|中|里面|提到|写着|有一句)/g },
  { label: "改写过程暴露", pattern: /根据(你|用户)?(提供|给出)的|从.*?可以看出|我会把|我来帮你|下面这版|以下是/g },
];

const metaReferenceIssues = (script) => {
  const text = String(script || "");
  const issues = [];
  for (const rule of metaReferenceRules) {
    const matches = [...text.matchAll(rule.pattern)].map((match) => match[0]).filter(Boolean);
    if (!matches.length) continue;
    issues.push({
      label: rule.label,
      examples: [...new Set(matches)].slice(0, 4),
    });
  }
  return issues;
};

const forbiddenMetaReferencePrompt = `成稿必须像作者直接对观众口播，不能暴露“这是从原稿改写来的”。

严禁在 script 和 voice_text 里出现这些表达或近义表达：
- 原稿里、原文里、原文案里、这篇文案里
- 飞书里、飞书文档里、资料里、上面提到
- 根据你提供的、从原文可以看出、我来帮你改、下面这版

正确做法：
- 把来源事实直接变成口播句子。
- 可以说“这里有个关键点”“新手一定要先看懂这件事”。
- 不可以说“原稿里有一句话很关键”。`;

const normalizeStringArray = (values) => {
  if (!Array.isArray(values)) return [];
  return values.map((item) => cleanLine(typeof item === "string" ? item : JSON.stringify(item))).filter(Boolean);
};

const normalizeMaterialSlots = (values) => {
  if (!Array.isArray(values)) return [];
  return values
    .map((item) => {
      if (typeof item === "string") return { purpose: cleanLine(item), evidence_goal: "", asset_id: "" };
      return {
        purpose: cleanLine(item?.purpose || item?.role || item?.description || ""),
        evidence_goal: cleanLine(item?.evidence_goal || item?.claim_text || item?.proof || ""),
        asset_id: cleanLine(item?.asset_id || ""),
      };
    })
    .filter((item) => item.purpose || item.evidence_goal || item.asset_id);
};

const normalizeRewriteSegments = (script, structured) => {
  const input = Array.isArray(structured?.segments) ? structured.segments : [];
  if (input.length) {
    return input.map((item, index) => ({
      segment_id: cleanLine(item.segment_id || `seg_${String(index + 1).padStart(3, "0")}`),
      order: index + 1,
      section_role: cleanLine(item.section_role || item.role || item.title || ""),
      voice_text: cleanLine(item.voice_text || item.text || item.copy || ""),
      screen_text: cleanLine(item.screen_text || item.big_text || ""),
      highlight_text: cleanLine(item.highlight_text || item.highlight || ""),
      material_slots: normalizeMaterialSlots(item.material_slots || item.materials || []),
    }));
  }

  return splitText(script).map((text, index) => ({
    segment_id: `seg_${String(index + 1).padStart(3, "0")}`,
    order: index + 1,
    section_role: index === 0 ? "开头钩子" : "",
    voice_text: text,
    screen_text: "",
    highlight_text: "",
    material_slots: [],
  }));
};

const buildMaterialRequirements = (segments, structured) => {
  const fromSlots = [];
  for (const segment of segments) {
    for (const slot of segment.material_slots || []) {
      fromSlots.push({
        requirement_id: `mat_${String(fromSlots.length + 1).padStart(3, "0")}`,
        segment_id: segment.segment_id,
        purpose: slot.purpose || "证明本段口播里的关键信息",
        evidence_goal: slot.evidence_goal || "",
        preferred_asset_id: slot.asset_id || "",
      });
    }
  }

  const notes = Array.isArray(structured?.material_notes) ? structured.material_notes : [];
  for (const note of notes) {
    const text = typeof note === "string" ? note : note?.purpose || note?.description || JSON.stringify(note);
    const clean = cleanLine(text);
    if (!clean) continue;
    fromSlots.push({
      requirement_id: `mat_${String(fromSlots.length + 1).padStart(3, "0")}`,
      segment_id: "",
      purpose: clean,
      evidence_goal: "",
      preferred_asset_id: "",
    });
  }

  return fromSlots;
};

const extractRiskNotes = (script, structured) => {
  const notes = normalizeStringArray(structured?.risk_notes);
  const checks = [
    [/月入|日入|稳定赚|躺赚|保赚|必赚|当天出单|翻倍/, "收入或结果承诺需要用户证据支撑。"],
    [/违规|禁售|引流|多账号|自动发货|好评|账号权重/, "涉及平台规则，发布前需要做闲鱼合规复核。"],
    [/侵权|版权|未授权|品牌|素材包|资料包/, "涉及版权或授权，需确认资料来源。"],
    [/隐私|聊天记录|数据恢复|身份证|手机号/, "涉及隐私或敏感数据，表达要保守。"],
  ];
  for (const [pattern, message] of checks) {
    if (pattern.test(script) && !notes.includes(message)) notes.push(message);
  }
  return notes;
};

const persistRewrite = async ({
  sourceText,
  script,
  segments,
  materialRequirements,
  riskNotes,
  model,
  styleProfile,
  quality,
  assetContext,
  sourceBrief,
}) => {
  const rewriteId = `rewrite_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
  const rewriteRoot = resolve(rewritesRoot, rewriteId);
  await mkdir(rewriteRoot, { recursive: true });
  const manifest = {
    rewrite_id: rewriteId,
    model,
    style_id: styleProfile?.id || "",
    style_name: styleProfile?.name || "",
    style_card: styleProfile?.file || styleCardFile,
    import_id: assetContext?.import_id || "",
    feishu_asset_count: assetContext?.assets?.length || 0,
    source_paragraph_count: splitText(sourceText).length,
    paragraph_count: splitText(script).length,
    segment_count: segments.length,
    material_requirement_count: materialRequirements?.length || 0,
    risk_note_count: riskNotes?.length || 0,
    quality: quality || {},
    source_brief_counts: {
      market_signals: sourceBrief.market_signals?.length || 0,
      product_or_offer: sourceBrief.product_or_offer?.length || 0,
      target_people: sourceBrief.target_people?.length || 0,
      operation_steps: sourceBrief.operation_steps?.length || 0,
      resource_assets: sourceBrief.resource_assets?.length || 0,
      monetization_points: sourceBrief.monetization_points?.length || 0,
      compliance_risks: sourceBrief.compliance_risks?.length || 0,
      cta: sourceBrief.cta?.length || 0,
    },
    created_at: new Date().toISOString(),
  };

  await writeFile(resolve(rewriteRoot, "source.txt"), sourceText, "utf8");
  await writeFile(resolve(rewriteRoot, "source_brief.json"), JSON.stringify(sourceBrief, null, 2), "utf8");
  await writeFile(resolve(rewriteRoot, "rewritten_script.txt"), script, "utf8");
  await writeFile(resolve(rewriteRoot, "voice_script.txt"), segments.map((segment) => segment.voice_text).filter(Boolean).join("\n\n"), "utf8");
  await writeFile(resolve(rewriteRoot, "rewrite_segments.json"), JSON.stringify(segments, null, 2), "utf8");
  await writeFile(resolve(rewriteRoot, "material_requirements.json"), JSON.stringify(materialRequirements || [], null, 2), "utf8");
  await writeFile(resolve(rewriteRoot, "risk_notes.json"), JSON.stringify(riskNotes || [], null, 2), "utf8");
  await writeFile(resolve(rewriteRoot, "import_asset_context.json"), JSON.stringify(assetContext || { assets: [] }, null, 2), "utf8");
  await writeFile(resolve(rewriteRoot, "rewrite_manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  return { rewriteId, rewriteRoot, manifest };
};

const styleDnaPrompt = (dna) => {
  const normalized = normalizeStyleDna(dna);
  if (!normalized) return "所选风格卡尚无量化 Style DNA；以 Markdown 风格卡为准。";
  return `所选风格的量化 Style DNA（只作为表达约束，不包含也不能补造事实）：
- 口播感 ${normalized.axes.oralness}/100
- 能量 ${normalized.axes.energy}/100
- 直接性 ${normalized.axes.directness}/100
- 证据密度 ${normalized.axes.evidence_density}/100
- 转化力度 ${normalized.axes.conversion_intensity}/100
- 样本置信度 ${normalized.style_metadata?.confidence?.label || "初步"}：${normalized.style_metadata?.confidence?.note || "需要更多样本"}`;
};

const requestModelRewrite = async ({ cfg, sourceText, styleCard, styleDna, sourceBriefText, assetPrompt }) => {
  const systemContent = `你是一个中文短视频口播文案改写助手。
你的任务是学习“风格卡”的结构、节奏、口播语气和 CTA 形态，不复用风格样本里的事实。
硬约束：
1. 只使用用户飞书原稿、关键信息提取结果和导入图片上下文中的事实。
2. 不编造收入、订单、案例、截图、平台规则和资料包内容。
3. 如果原稿证据不足，用保守表达或在 risk_notes 里标注。
4. script 和 voice_text 必须是直接面向观众的成稿，不得出现“原稿里、原文里、这篇文案里、飞书里、资料里、根据你提供的、下面这版”等元叙述。
5. 输出必须是 JSON 对象，不要输出 Markdown。`;

  const userContent = `请把下面飞书原稿改成“所选风格卡”的口播风格。

输出 JSON 格式：
{
  "script": "完整口播正文，使用自然段",
  "segments": [
    {
      "section_role": "开头钩子/排雷/方法/素材证明/CTA 等",
      "voice_text": "本段口播",
      "screen_text": "本段适合上屏的大字",
      "highlight_text": "本段重点词",
      "material_slots": [
        {"purpose": "需要什么素材证明", "evidence_goal": "证明哪句话", "asset_id": "可选，若直接使用飞书图片则填 asset_xxx"}
      ]
    }
  ],
  "material_notes": ["还缺哪些素材或截图"],
  "risk_notes": ["哪些说法需要证据或合规复核"]
}

${forbiddenMetaReferencePrompt}

风格卡：
${styleCard}

${styleDnaPrompt(styleDna)}

关键信息提取结果：
${sourceBriefText}

飞书图片上下文：
${assetPrompt}

完整原稿：
${sourceText}`;

  const requestBody = {
    model: cfg.model,
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: userContent },
    ],
    temperature: Number.isFinite(cfg.temperature) ? cfg.temperature : 0.45,
  };
  if (Number.isFinite(cfg.maxTokens) && cfg.maxTokens > 0) requestBody.max_tokens = Math.floor(cfg.maxTokens);
  if (cfg.serviceTier) requestBody.service_tier = cfg.serviceTier;
  if (cfg.reasoningEffort) requestBody.reasoning_effort = cfg.reasoningEffort;

  let modelResponse;
  let payload;
  try {
    modelResponse = await fetchChatCompletion(cfg, requestBody);
    payload = await modelResponse.json().catch(() => ({}));
  } catch (error) {
    return {
      ok: false,
      code: error?.name === "AbortError" ? "AI_TIMEOUT" : "AI_REQUEST_EXCEPTION",
      message: error instanceof Error ? error.message : "模型接口请求异常。",
    };
  }

  if (!modelResponse.ok) {
    return {
      ok: false,
      code: "AI_REQUEST_FAILED",
      message: payload.error?.message || `模型接口请求失败：HTTP ${modelResponse.status}`,
    };
  }

  const modelText = payload.choices?.[0]?.message?.content?.trim();
  if (!modelText) return { ok: false, code: "AI_EMPTY_RESPONSE", message: "模型没有返回改写文案。" };
  return { ok: true, text: modelText };
};

const requestMetaReferenceRepair = async ({ cfg, script, styleCard, sourceBriefText, assetPrompt, issues }) => {
  const systemContent = `你是中文短视频口播成稿质检和修复助手。
你的任务只做一件事：删除或改写成稿中的元叙述，让它变成作者直接对观众说的话。
不能新增事实，不能改变核心承诺，不能把风险词删成绝对承诺。
输出必须是 JSON 对象，不要输出 Markdown。`;

  const userContent = `下面这份口播稿出现了不该给观众看的元叙述。

已命中的问题：
${issues.map((issue) => `- ${issue.label}: ${issue.examples.join("、")}`).join("\n")}

${forbiddenMetaReferencePrompt}

修复要求：
- 保留原来的事实、顺序和口播风格。
- 把“原稿里/文案里/资料里”这类表达改成自然口播。
- 输出 JSON：{"script":"修复后的完整口播正文","risk_notes":["必要风险标注"],"material_notes":["必要素材说明"]}

风格卡：
${styleCard}

关键信息提取结果：
${sourceBriefText}

飞书图片上下文：
${assetPrompt}

待修复口播稿：
${script}`;

  const requestBody = {
    model: cfg.model,
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: userContent },
    ],
    temperature: 0.25,
  };
  if (Number.isFinite(cfg.maxTokens) && cfg.maxTokens > 0) requestBody.max_tokens = Math.floor(cfg.maxTokens);
  if (cfg.serviceTier) requestBody.service_tier = cfg.serviceTier;
  if (cfg.reasoningEffort) requestBody.reasoning_effort = cfg.reasoningEffort;

  let modelResponse;
  let payload;
  try {
    modelResponse = await fetchChatCompletion(cfg, requestBody);
    payload = await modelResponse.json().catch(() => ({}));
  } catch (error) {
    return {
      ok: false,
      code: error?.name === "AbortError" ? "AI_TIMEOUT" : "AI_REQUEST_EXCEPTION",
      message: error instanceof Error ? error.message : "模型接口请求异常。",
    };
  }

  if (!modelResponse.ok) {
    return {
      ok: false,
      code: "AI_REQUEST_FAILED",
      message: payload.error?.message || `模型接口请求失败：HTTP ${modelResponse.status}`,
    };
  }

  const modelText = payload.choices?.[0]?.message?.content?.trim();
  if (!modelText) return { ok: false, code: "AI_EMPTY_RESPONSE", message: "模型没有返回修复文案。" };
  return { ok: true, text: modelText };
};

const rewriteWithModelOnly = async (text, importId = "", styleId = "") => {
  const sourceText = normalizeDocText(text);
  if (!sourceText) {
    return { ok: false, code: "EMPTY_COPY", message: "原文为空，请先导入飞书正文或粘贴文案。" };
  }

  const cfg = await modelConfig();
  const assetContext = await loadImportAssetContext(importId);
  const sourceBrief = extractSourceBrief(sourceText, assetContext);
  const sourceBriefText = sourceBriefPrompt(sourceBrief);
  if (!cfg.apiKey) {
    return {
      ok: false,
      code: "AI_NOT_CONFIGURED",
      message: "模型改写未配置 API Key。请在 .env.local 配置 OPENAI_API_KEY，也可配置 OPENAI_BASE_URL 和 OPENAI_MODEL。",
      source_brief: sourceBrief,
      model: cfg.model,
    };
  }

  let styleProfile;
  try {
    styleProfile = await loadStyleProfile(styleId);
  } catch (error) {
    return {
      ok: false,
      code: "STYLE_CARD_MISSING",
      message: error instanceof Error ? error.message : `没有读到风格卡：${styleCardFile}`,
      source_brief: sourceBrief,
    };
  }

  const modelResult = await requestModelRewrite({
    cfg,
    sourceText,
    styleCard: styleProfile.content,
    styleDna: styleProfile.style_dna,
    sourceBriefText,
    assetPrompt: assetContextPrompt(assetContext),
  });
  if (!modelResult.ok) {
    return {
      ok: false,
      code: modelResult.code,
      message: modelResult.message,
      source: "model",
      model: cfg.model,
      source_brief: sourceBrief,
    };
  }

  let structured = extractJsonObject(modelResult.text);
  let script = cleanupRewriteScript(structured?.script || modelResult.text);
  let qualityIssues = metaReferenceIssues(script);
  let autoRepaired = false;

  if (qualityIssues.length) {
    const repairResult = await requestMetaReferenceRepair({
      cfg,
      script,
      styleCard: styleProfile.content,
      sourceBriefText,
      assetPrompt: assetContextPrompt(assetContext),
      issues: qualityIssues,
    });
    if (!repairResult.ok) {
      return {
        ok: false,
        code: "META_REFERENCE_REPAIR_FAILED",
        message: `改写稿出现了“原稿/原文/文案里”等元叙述，自动修复失败：${repairResult.message}`,
        source: "model",
        model: cfg.model,
        source_brief: sourceBrief,
        quality_issues: qualityIssues,
      };
    }

    const repairedStructured = extractJsonObject(repairResult.text);
    const repairedScript = cleanupRewriteScript(repairedStructured?.script || repairResult.text);
    const remainingIssues = metaReferenceIssues(repairedScript);
    if (remainingIssues.length) {
      return {
        ok: false,
        code: "META_REFERENCE_BLOCKED",
        message: `改写稿仍包含不该出现的元叙述：${remainingIssues
          .map((issue) => issue.examples.join("、"))
          .join("；")}。请重新生成或调整风格卡。`,
        source: "model",
        model: cfg.model,
        source_brief: sourceBrief,
        quality_issues: remainingIssues,
      };
    }

    structured = repairedStructured || { script: repairedScript };
    script = repairedScript;
    qualityIssues = [];
    autoRepaired = true;
  }

  const segments = normalizeRewriteSegments(script, structured);
  const materialRequirements = buildMaterialRequirements(segments, structured);
  const riskNotes = extractRiskNotes(script, structured);
  const styleMatch = scoreStyleMatch(script, styleProfile.style_dna);
  const persisted = await persistRewrite({
    sourceText,
    script,
    segments,
    materialRequirements,
    riskNotes,
    model: cfg.model,
    styleProfile,
    quality: {
      meta_reference_auto_repaired: autoRepaired,
      style_match: styleMatch,
    },
    assetContext,
    sourceBrief,
  });

  return {
    ok: true,
    source: "model",
    model: cfg.model,
    style: {
      id: styleProfile.id,
      name: styleProfile.name,
      file: styleProfile.file,
    },
    text: script,
    segments,
    source_brief: sourceBrief,
    material_requirements: materialRequirements,
    risk_notes: riskNotes,
    quality: {
      meta_reference_auto_repaired: autoRepaired,
      meta_reference_issues: [],
      style_match: styleMatch,
    },
    import_id: assetContext.import_id,
    rewrite_id: persisted.rewriteId,
    paths: {
      rewrite_root: persisted.rewriteRoot,
      rewritten_script: resolve(persisted.rewriteRoot, "rewritten_script.txt"),
      source_brief: resolve(persisted.rewriteRoot, "source_brief.json"),
      rewrite_segments: resolve(persisted.rewriteRoot, "rewrite_segments.json"),
      material_requirements: resolve(persisted.rewriteRoot, "material_requirements.json"),
      risk_notes: resolve(persisted.rewriteRoot, "risk_notes.json"),
      rewrite_manifest: resolve(persisted.rewriteRoot, "rewrite_manifest.json"),
    },
    manifest: persisted.manifest,
  };
};

const testAiConfig = async () => {
  const cfg = await modelConfig();
  if (!cfg.apiKey) {
    return {
      ok: false,
      code: "AI_NOT_CONFIGURED",
      message: "未配置 OPENAI_API_KEY 或 AI_API_KEY。",
      model: cfg.model,
      base_url: cfg.baseUrl,
    };
  }

  const body = {
    model: cfg.model,
    messages: [
      { role: "system", content: "你只做连通性测试。" },
      { role: "user", content: "返回 JSON：{\"ok\":true,\"sample\":\"ready\"}" },
    ],
    temperature: 0,
    max_tokens: 80,
  };
  const response = await fetchChatCompletion(cfg, body, 30000);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      code: "AI_REQUEST_FAILED",
      message: payload.error?.message || `模型接口请求失败：HTTP ${response.status}`,
      model: cfg.model,
      base_url: cfg.baseUrl,
    };
  }
  return {
    ok: true,
    model: cfg.model,
    base_url: cfg.baseUrl,
    sample: payload.choices?.[0]?.message?.content?.trim() || "",
  };
};

const serveFile = async (response, filePath) => {
  const info = await stat(filePath);
  if (!info.isFile()) {
    sendJson(response, 404, { ok: false, code: "NOT_FOUND", message: "File not found." });
    return;
  }
  response.writeHead(200, {
    "content-type": mime[extname(filePath).toLowerCase()] || "application/octet-stream",
    "content-length": info.size,
  });
  createReadStream(filePath).pipe(response);
};

const staticFileForUrl = (url) => {
  if (url.pathname === "/") return resolve(root, "index.html");
  if (url.pathname.startsWith("/imports/")) {
    const parts = url.pathname.split("/").filter(Boolean);
    const importId = publicImportId(parts[1]);
    const fileName = basename(parts.slice(3).join("/"));
    if (!importId || !fileName) return "";
    const target = resolve(importsRoot, importId, "assets", fileName);
    return isPathInside(target, importsRoot) ? target : "";
  }
  if (url.pathname.startsWith("/audio/")) {
    const parts = url.pathname.split("/").filter(Boolean);
    const audioId = publicAudioId(parts[1]);
    const fileName = basename(parts.slice(2).join("/"));
    if (!audioId || !fileName) return "";
    const target = resolve(audioRoot, audioId, fileName);
    return isPathInside(target, audioRoot) ? target : "";
  }
  const decoded = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  const target = resolve(root, decoded);
  return isPathInside(target, root) ? target : "";
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);

  try {
    if (url.pathname === "/api/status") {
      const cfg = await modelConfig();
      const tts = await publicTtsConfig();
      const styles = await listStyleProfiles();
      sendJson(response, 200, {
        ok: true,
        default_feishu_url: defaultFeishuUrl,
        style_card: styleCardFile,
        styles,
        lark_node_bin: larkNodeBin,
        lark_cli_entry: larkCliEntry,
        ai: {
          configured: Boolean(cfg.apiKey),
          model: cfg.model,
          base_url: cfg.baseUrl,
        },
        tts: {
          configured: tts.configured,
          model: tts.model,
          voice: tts.voice,
          base_url: tts.base_url,
          format: tts.format,
        },
      });
      return;
    }

    if (url.pathname === "/api/styles") {
      if (request.method !== "GET") {
        sendJson(response, 405, { ok: false, code: "METHOD_NOT_ALLOWED", message: "Use GET." });
        return;
      }
      sendJson(response, 200, {
        ok: true,
        styles: await listStyleProfiles(),
      });
      return;
    }

    if (url.pathname === "/api/style-profile") {
      if (request.method === "GET") {
        try {
          sendJson(response, 200, { ok: true, style: await loadStyleProfile(url.searchParams.get("id") || "") });
        } catch (error) {
          sendJson(response, 404, {
            ok: false,
            code: "STYLE_NOT_FOUND",
            message: error instanceof Error ? error.message : "风格卡不存在。",
          });
        }
        return;
      }

      if (request.method === "POST") {
        try {
          sendJson(response, 200, await saveStyleProfile(await readRequestJson(request)));
        } catch (error) {
          sendJson(response, 400, {
            ok: false,
            code: "STYLE_SAVE_FAILED",
            message: error instanceof Error ? error.message : "风格保存失败。",
          });
        }
        return;
      }

      sendJson(response, 405, { ok: false, code: "METHOD_NOT_ALLOWED", message: "Use GET or POST." });
      return;
    }

    if (url.pathname === "/api/style-library") {
      if (request.method === "GET") {
        sendJson(response, 200, await styleLibraryResponse());
        return;
      }
      if (request.method === "POST") {
        try {
          const payload = await readRequestJson(request);
          const style = payload.style || payload;
          const content =
            style.content ||
            style.markdown ||
            [`# ${style.name || style.id || "未命名风格"}`, "", style.copy_prompt || "", "", style.negative_prompt ? `## 负面约束\n\n${style.negative_prompt}` : ""]
              .filter(Boolean)
              .join("\n");
          sendJson(response, 200, await saveStyleProfile({ ...style, content }));
        } catch (error) {
          sendJson(response, 400, {
            ok: false,
            code: "STYLE_SAVE_FAILED",
            message: error instanceof Error ? error.message : "风格保存失败。",
          });
        }
        return;
      }
      sendJson(response, 405, { ok: false, code: "METHOD_NOT_ALLOWED", message: "Use GET or POST." });
      return;
    }

    if (url.pathname === "/api/style-dna-version") {
      if (request.method !== "GET") {
        sendJson(response, 405, { ok: false, code: "METHOD_NOT_ALLOWED", message: "Use GET." });
        return;
      }
      try {
        const style = await loadStyleProfile(url.searchParams.get("style_id") || url.searchParams.get("id") || "");
        const version = await loadStyleDnaVersion(style.file, url.searchParams.get("version"));
        sendJson(response, 200, {
          ok: true,
          style: { id: style.id, name: style.name, file: style.file },
          ...version,
        });
      } catch (error) {
        sendJson(response, 400, {
          ok: false,
          code: "STYLE_DNA_VERSION_NOT_FOUND",
          message: error instanceof Error ? error.message : "DNA 版本读取失败。",
        });
      }
      return;
    }

    if (url.pathname === "/api/style-sample-health") {
      if (request.method !== "POST") {
        sendJson(response, 405, { ok: false, code: "METHOD_NOT_ALLOWED", message: "Use POST." });
        return;
      }
      try {
        const payload = await readRequestJson(request);
        const text = String(payload.text || payload.source_text || payload.sourceText || "");
        if (!text.trim()) throw new Error("样本文本为空。");
        sendJson(response, 200, { ok: true, sample_health: assessStyleSampleHealth(text, payload) });
      } catch (error) {
        sendJson(response, 400, {
          ok: false,
          code: "STYLE_SAMPLE_HEALTH_FAILED",
          message: error instanceof Error ? error.message : "样本健康检查失败。",
        });
      }
      return;
    }

    if (url.pathname === "/api/analyze-style") {
      if (request.method !== "POST") {
        sendJson(response, 405, { ok: false, code: "METHOD_NOT_ALLOWED", message: "Use POST." });
        return;
      }
      try {
        const payload = await readRequestJson(request);
        const text = String(payload.text || payload.source_text || payload.sourceText || "");
        const name = cleanLine(payload.name || payload.style_name || payload.styleName || "未命名风格 DNA");
        const analysis = extractStyleDna(text, payload);
        const dna = analysis.dna;
        sendJson(response, 200, {
          ok: true,
          dna,
          sample_health: analysis.sample_health,
          dna_summary: summarizeStyleDna(dna),
          suggested_markdown: styleDnaMarkdown(name, dna),
          save_hint: "这是未保存的分析草稿。确认 Markdown 后点击“保存到风格库”，才会写入风格卡和 DNA 文件。",
        });
      } catch (error) {
        sendJson(response, 400, {
          ok: false,
          code: "STYLE_ANALYSIS_FAILED",
          message: error instanceof Error ? error.message : "风格提取失败。",
        });
      }
      return;
    }

    if (url.pathname === "/api/style-match") {
      if (request.method !== "POST") {
        sendJson(response, 405, { ok: false, code: "METHOD_NOT_ALLOWED", message: "Use POST." });
        return;
      }
      try {
        const payload = await readRequestJson(request);
        const text = String(payload.text || payload.candidate_text || payload.candidateText || "");
        if (!text.trim()) throw new Error("待评分文案为空。");
        const style = await loadStyleProfile(payload.style_id || payload.styleId || payload.style || "");
        sendJson(response, 200, {
          ok: true,
          style: { id: style.id, name: style.name, file: style.file },
          style_match: scoreStyleMatch(text, style.style_dna),
        });
      } catch (error) {
        sendJson(response, 400, {
          ok: false,
          code: "STYLE_MATCH_FAILED",
          message: error instanceof Error ? error.message : "风格评分失败。",
        });
      }
      return;
    }

    if (url.pathname === "/api/import-feishu") {
      if (request.method !== "GET") {
        sendJson(response, 405, { ok: false, code: "METHOD_NOT_ALLOWED", message: "Use GET." });
        return;
      }
      const target = url.searchParams.get("url") || "";
      if (!target.trim()) {
        sendJson(response, 400, { ok: false, code: "MISSING_URL", message: "缺少飞书链接。" });
        return;
      }
      sendJson(response, 200, await importFeishu(target));
      return;
    }

    if (url.pathname === "/api/rewrite-copy") {
      if (request.method !== "POST") {
        sendJson(response, 405, { ok: false, code: "METHOD_NOT_ALLOWED", message: "Use POST." });
        return;
      }
      const payload = await readRequestJson(request);
      sendJson(
        response,
        200,
        await rewriteWithModelOnly(
          payload.text || "",
          payload.import_id || payload.importId || "",
          payload.style_id || payload.styleId || payload.style || "",
        ),
      );
      return;
    }

    if (url.pathname === "/api/tts-config") {
      if (request.method !== "GET") {
        sendJson(response, 405, { ok: false, code: "METHOD_NOT_ALLOWED", message: "Use GET." });
        return;
      }
      sendJson(response, 200, await publicTtsConfig());
      return;
    }

    if (url.pathname === "/api/synthesize-voice") {
      if (request.method !== "POST") {
        sendJson(response, 405, { ok: false, code: "METHOD_NOT_ALLOWED", message: "Use POST." });
        return;
      }
      sendJson(response, 200, await synthesizeVoice(await readRequestJson(request)));
      return;
    }

    if (url.pathname === "/api/test-ai-config") {
      if (request.method !== "POST") {
        sendJson(response, 405, { ok: false, code: "METHOD_NOT_ALLOWED", message: "Use POST." });
        return;
      }
      sendJson(response, 200, await testAiConfig());
      return;
    }

    const file = staticFileForUrl(url);
    if (!file || !existsSync(file)) {
      sendJson(response, 404, { ok: false, code: "NOT_FOUND", message: "File not found." });
      return;
    }
    await serveFile(response, file);
  } catch (error) {
    sendJson(response, 500, {
      ok: false,
      code: "SERVER_ERROR",
      message: error instanceof Error ? error.message : "Server error.",
    });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`风格仿写工作台：http://127.0.0.1:${port}`);
});
