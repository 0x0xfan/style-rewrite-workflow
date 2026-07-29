const $ = (selector) => document.querySelector(selector);

const state = {
  importId: "",
  importPaths: null,
  rewritePaths: null,
  voicePaths: null,
  styles: [],
  activeStyleId: "",
  pendingStyleDna: null,
  pendingSampleHealth: null,
};

const els = {
  systemStatus: $("#systemStatus"),
  feishuUrl: $("#feishuUrl"),
  importFeishu: $("#importFeishu"),
  feishuStatus: $("#feishuStatus"),
  importMetrics: $("#importMetrics"),
  assetStrip: $("#assetStrip"),
  sourceCopy: $("#sourceCopy"),
  sourceEditor: $("#sourceEditor"),
  sourceCount: $("#sourceCount"),
  styleSelect: $("#styleSelect"),
  rewriteCopy: $("#rewriteCopy"),
  clearRewrite: $("#clearRewrite"),
  rewriteStatus: $("#rewriteStatus"),
  revisedCopy: $("#revisedCopy"),
  rewriteCount: $("#rewriteCount"),
  sourceBrief: $("#sourceBrief"),
  materialList: $("#materialList"),
  riskList: $("#riskList"),
  pathList: $("#pathList"),
  testAi: $("#testAi"),
  styleLibraryList: $("#styleLibraryList"),
  styleName: $("#styleName"),
  styleContent: $("#styleContent"),
  refreshStyleLibrary: $("#refreshStyleLibrary"),
  inspectStyleSamples: $("#inspectStyleSamples"),
  analyzeCurrentStyle: $("#analyzeCurrentStyle"),
  checkStyleMatch: $("#checkStyleMatch"),
  saveStyleProfile: $("#saveStyleProfile"),
  styleLibraryStatus: $("#styleLibraryStatus"),
  styleDnaSummary: $("#styleDnaSummary"),
  dnaVersionHistory: $("#dnaVersionHistory"),
  sampleHealthReview: $("#sampleHealthReview"),
  approveStyleDna: $("#approveStyleDna"),
  styleChangeReason: $("#styleChangeReason"),
  voiceSource: $("#voiceSource"),
  voiceFormat: $("#voiceFormat"),
  voiceModel: $("#voiceModel"),
  voiceName: $("#voiceName"),
  synthesizeVoice: $("#synthesizeVoice"),
  voiceStatus: $("#voiceStatus"),
  voicePlayer: $("#voicePlayer"),
  voicePathList: $("#voicePathList"),
};

const setStatus = (element, message, type = "idle") => {
  element.textContent = message;
  element.dataset.type = type;
};

const countText = (value) => `${String(value || "").replace(/\s/g, "").length} 字`;

const apiJson = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  return await response.json();
};

const renderMetrics = (result) => {
  if (!result?.ok) {
    els.importMetrics.innerHTML = "";
    return;
  }
  const stats = result.stats || {};
  const items = [
    ["读取方式", result.source || "-"],
    ["段落", result.paragraphCount ?? stats.paragraph_count ?? "-"],
    ["图片", stats.image_count ?? result.assets?.length ?? 0],
    ["已下载", stats.downloaded_count ?? 0],
    ["失败", stats.failed_count ?? 0],
  ];
  els.importMetrics.innerHTML = items
    .map(([label, value]) => `<span><strong>${value}</strong>${label}</span>`)
    .join("");
};

const renderAssets = (assets = []) => {
  if (!assets.length) {
    els.assetStrip.innerHTML = "<div class=\"empty-state\">没有读取到内联图片。</div>";
    return;
  }
  els.assetStrip.innerHTML = assets
    .map((asset) => {
      const ok = asset.download_status === "downloaded" && asset.local_url;
      const preview = ok
        ? `<img src="${asset.local_url}" alt="${asset.alt || asset.asset_id}" />`
        : `<div class="asset-missing">${asset.error || "下载失败"}</div>`;
      return `<article class="asset-card">
        ${preview}
        <div>
          <strong>${asset.asset_id}</strong>
          <span>${asset.download_status || "-"}</span>
        </div>
      </article>`;
    })
    .join("");
};

const formatList = (items = []) => {
  if (!items.length) return "暂无";
  return items.map((item) => `<div class="list-item">${escapeHtml(item)}</div>`).join("");
};

const renderBrief = (brief) => {
  if (!brief) {
    els.sourceBrief.textContent = "暂无";
    return;
  }
  els.sourceBrief.textContent = JSON.stringify(brief, null, 2);
};

const renderMaterials = (items = []) => {
  if (!items.length) {
    els.materialList.textContent = "暂无";
    return;
  }
  els.materialList.innerHTML = items
    .map(
      (item) => `<div class="list-item">
        <strong>${escapeHtml(item.requirement_id || item.segment_id || "素材")}</strong>
        <span>${escapeHtml(item.purpose || "")}</span>
        ${item.evidence_goal ? `<em>${escapeHtml(item.evidence_goal)}</em>` : ""}
      </div>`,
    )
    .join("");
};

const renderPathEntries = (element, paths = {}) => {
  const entries = Object.entries(paths).filter(([, value]) => value);
  if (!entries.length) {
    element.textContent = "暂无";
    return;
  }
  element.innerHTML = entries
    .map(([label, value]) => `<div><strong>${escapeHtml(label)}</strong><code>${escapeHtml(value)}</code></div>`)
    .join("");
};

const renderPaths = (paths = {}) => renderPathEntries(els.pathList, paths);

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const stripEditorText = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

const blockFromMarkdownLine = (line) => {
  const heading = String(line || "").match(/^(#{1,6})\s*(.*)$/);
  if (heading) {
    return {
      tag: `h${Math.min(6, heading[1].length)}`,
      text: heading[2] || "",
      prefix: `${heading[1]} `,
    };
  }
  return { tag: "p", text: line || "", prefix: "" };
};

const ensureEditorPlaceholder = () => {
  els.sourceEditor.classList.toggle("is-empty", !els.sourceCopy.value.trim());
};

const renderSourceEditor = (markdown = "") => {
  els.sourceEditor.innerHTML = "";
  const lines = String(markdown || "").split(/\r?\n/);
  if (!lines.some((line) => line.trim())) {
    ensureEditorPlaceholder();
    return;
  }

  for (const line of lines) {
    if (!line.trim()) {
      const spacer = document.createElement("p");
      spacer.className = "blank-line";
      spacer.dataset.mdPrefix = "";
      spacer.innerHTML = "<br>";
      els.sourceEditor.append(spacer);
      continue;
    }
    const block = blockFromMarkdownLine(line);
    const element = document.createElement(block.tag);
    element.dataset.mdPrefix = block.prefix;
    element.textContent = block.text;
    els.sourceEditor.append(element);
  }
  ensureEditorPlaceholder();
};

const sourceEditorToMarkdown = () => {
  if (!els.sourceEditor.children.length) return stripEditorText(els.sourceEditor.textContent);
  const lines = [];
  for (const node of els.sourceEditor.children) {
    const tag = node.tagName?.toLowerCase() || "p";
    const text = stripEditorText(node.textContent);
    if (!text) {
      lines.push("");
      continue;
    }
    const prefix =
      node.dataset.mdPrefix ||
      (/^h[1-6]$/.test(tag) ? `${"#".repeat(Number(tag.slice(1)))} ` : "");
    lines.push(`${prefix}${text}`.trim());
  }
  return lines.join("\n").trim();
};

const setSourceMarkdown = (markdown) => {
  els.sourceCopy.value = markdown || "";
  renderSourceEditor(els.sourceCopy.value);
  syncCounts();
};

const syncCounts = () => {
  els.sourceCount.textContent = countText(els.sourceCopy.value);
  els.rewriteCount.textContent = countText(els.revisedCopy.value);
};

const renderStyles = (styles = []) => {
  state.styles = styles;
  els.styleSelect.innerHTML = "";
  if (!styles.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "没有可用风格";
    els.styleSelect.append(option);
    els.styleSelect.disabled = true;
    return;
  }

  for (const style of styles) {
    const option = document.createElement("option");
    option.value = style.id || "";
    option.textContent = style.name || style.id || "未命名风格";
    if (style.is_default) option.selected = true;
    els.styleSelect.append(option);
  }
  els.styleSelect.disabled = false;
  renderStyleLibrary(styles);
};

const renderStyleLibrary = (styles = []) => {
  if (!els.styleLibraryList) return;
  if (!styles.length) {
    els.styleLibraryList.innerHTML = "<div class=\"empty-state\">没有可用风格卡。</div>";
    return;
  }
  const activeId = state.activeStyleId || els.styleSelect.value || styles[0]?.id || "";
  els.styleLibraryList.innerHTML = styles
    .map(
      (style) => `<button type="button" class="style-library-item${style.id === activeId ? " is-active" : ""}" data-style-id="${escapeHtml(
        style.id || "",
      )}">
        <strong>${escapeHtml(style.name || style.id || "未命名风格")}</strong>
        <span>${escapeHtml(style.id || "")}</span>
      </button>`,
    )
    .join("");
};

const loadStyleProfile = async (styleId = "") => {
  if (!els.styleContent) return;
  setStatus(els.styleLibraryStatus, "正在读取风格卡...", "loading");
  const result = await apiJson(`/api/style-profile?id=${encodeURIComponent(styleId || els.styleSelect.value || "")}`);
  if (!result.ok) throw new Error(result.message || "风格卡读取失败");
  const style = result.style || {};
  state.activeStyleId = style.id || "";
  state.pendingStyleDna = style.style_dna || null;
  state.pendingSampleHealth = style.style_dna?.style_metadata?.sample_health || null;
  els.styleName.value = style.name || "";
  els.styleContent.value = style.content || "";
  els.approveStyleDna.checked = style.style_dna?.style_metadata?.approval?.status === "approved";
  els.styleChangeReason.value = style.style_dna?.style_metadata?.approval?.change_reason || "";
  if (style.id && [...els.styleSelect.options].some((option) => option.value === style.id)) {
    els.styleSelect.value = style.id;
  }
  renderStyleLibrary(state.styles);
  renderSampleHealth(state.pendingSampleHealth);
  renderStyleDna(state.pendingStyleDna);
  renderDnaVersionHistory(style.style_dna_versions, state.activeStyleId);
  setStatus(els.styleLibraryStatus, `已读取：${style.name || style.id || "风格卡"}`, "success");
};

const selectedStyleName = () => {
  const selected = state.styles.find((style) => style.id === els.styleSelect.value);
  return selected?.name || els.styleSelect.selectedOptions?.[0]?.textContent || "所选风格";
};

const selectedTemplateExclusions = () =>
  [...els.sampleHealthReview.querySelectorAll("[data-template-phrase]:checked")]
    .map((input) => input.dataset.templatePhrase || "")
    .filter(Boolean);

const renderSampleHealth = (health) => {
  state.pendingSampleHealth = health || null;
  if (!els.sampleHealthReview) return;
  if (!health) {
    els.sampleHealthReview.dataset.grade = "";
    els.sampleHealthReview.textContent = "尚未检查样本健康度。";
    return;
  }
  const distribution = health.character_distribution || {};
  const gradeLabel = { healthy: "健康", warning: "待复核", serious: "严重风险" }[health.grade] || "未分类";
  const warnings = (health.warnings || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>未发现需要额外处理的样本风险。</li>";
  const templates = (health.template_candidates || [])
    .map(
      (item) => `<label class="template-candidate"><input type="checkbox" data-template-phrase="${escapeHtml(item.phrase || "")}"${(health.excluded_template_phrases || []).includes(item.phrase) ? " checked" : ""} /><span><strong>作为模板剥离</strong> · 覆盖 ${escapeHtml(item.coverage_count ?? 0)}/${escapeHtml(health.unit_count ?? 0)} 个单元<br>${escapeHtml(item.phrase || "")}</span></label>`,
    )
    .join("");
  els.sampleHealthReview.dataset.grade = health.grade || "";
  els.sampleHealthReview.innerHTML = `
    <p><strong>样本健康度：${gradeLabel}</strong> · ${escapeHtml(health.unit_count ?? 0)} 个单元（${escapeHtml(health.unit_strategy || "-")}） · 字数 ${escapeHtml(distribution.min ?? 0)}/${escapeHtml(distribution.median ?? 0)}/${escapeHtml(distribution.max ?? 0)}（最小/中位/最大）</p>
    <p>近重复：${escapeHtml(health.near_duplicate_pair_count ?? 0)} 组；模板候选：${escapeHtml(health.template_candidate_count ?? 0)} 条。${health.template_candidate_count ? "勾选后再次提取，才会从 DNA 统计中降权。" : ""}</p>
    <ul>${warnings}</ul>
    ${templates ? `<div class="template-candidates">${templates}</div>` : ""}
    <p>${escapeHtml(health.limitations || "")}</p>`;
};

const renderStyleDna = (dna, styleMatch = null) => {
  if (!els.styleDnaSummary) return;
  if (!dna?.axes) {
    els.styleDnaSummary.textContent = "未保存 Style DNA。可在左侧粘贴参考样本，点击“提取当前文本 DNA”，确认草稿后保存。";
    return;
  }
  const metadata = dna.style_metadata || {};
  const confidence = metadata.confidence || {};
  const axes = dna.axes || {};
  const health = metadata.sample_health || {};
  const approval = metadata.approval || {};
  const version = metadata.version || {};
  const signals = (dna.signature_signals || []).map((item) => `${item.phrase}×${item.count}`).join("、") || "无稳定高频推进词";
  const lines = [
    `Style DNA：${metadata.content_type || "中文短视频口播"}`,
    `样本：${metadata.sample_unit_count || 1} 个单元 / ${metadata.character_count || 0} 字 / 置信度 ${confidence.label || "初步"}（${confidence.value ?? 0}）`,
    `口播感 ${axes.oralness ?? 0} · 能量 ${axes.energy ?? 0} · 直接性 ${axes.directness ?? 0}`,
    `证据密度 ${axes.evidence_density ?? 0} · 转化力度 ${axes.conversion_intensity ?? 0}`,
    `推进信号：${signals}`,
  ];
  if (health.grade) lines.push(`样本健康：${health.grade} · 近重复 ${health.near_duplicate_pair_count || 0} 组 · 模板候选 ${health.template_candidate_count || 0} 条 · 复核 ${health.review_status || "-"}`);
  if (approval.status || version.version) lines.push(`版本：v${version.version || "未编号"} · 状态 ${approval.status === "approved" ? "已确认" : "草稿"}${approval.change_reason ? ` · ${approval.change_reason}` : ""}`);
  if (styleMatch?.available) {
    lines.push("", `改写匹配：${styleMatch.overall}/100 — ${styleMatch.verdict}`);
    for (const item of styleMatch.dimensions || []) lines.push(`- ${item.label} ${item.actual}/${item.target}，${item.advice}`);
    lines.push(`说明：${styleMatch.limitations || ""}`);
  } else if (styleMatch?.message) {
    lines.push("", styleMatch.message);
  }
  els.styleDnaSummary.textContent = lines.join("\n");
};

const renderDnaVersionHistory = (history, styleId = "") => {
  if (!els.dnaVersionHistory) return;
  const versions = Array.isArray(history?.versions) ? history.versions : [];
  if (!versions.length) {
    els.dnaVersionHistory.textContent = "尚无已保存的 DNA 版本。保存风格卡后会保留可回看的版本快照。";
    return;
  }
  els.dnaVersionHistory.innerHTML = `
    <p><strong>DNA 历史版本</strong> · 当前 v${escapeHtml(history.latest_version || versions[0]?.version || 0)}</p>
    <div class="dna-version-list">${versions
      .map(
        (item) => `<button type="button" class="dna-version-item" data-style-dna-version="${escapeHtml(item.version)}" data-style-id="${escapeHtml(styleId)}">
          <strong>v${escapeHtml(item.version)}</strong> · ${escapeHtml(item.approval_status === "approved" ? "已确认" : "草稿")}
          <span>${escapeHtml(item.sample_health?.grade || "unknown")} · ${escapeHtml(item.change_reason || "无变更说明")}</span>
        </button>`,
      )
      .join("")}</div>
    <p>查看历史版本只读，不会替换当前风格卡或 DNA。</p>`;
};

const loadStatus = async () => {
  try {
    const result = await apiJson("/api/status");
    if (!result.ok) throw new Error(result.message || "status failed");
    if (Array.isArray(result.styles)) renderStyles(result.styles);
    setStatus(
      els.systemStatus,
      result.ai?.configured ? `模型已配置：${result.ai.model}` : `模型未配置：${result.ai?.model || "-"}`,
      result.ai?.configured ? "success" : "warn",
    );
    if (result.tts && els.voiceStatus) {
      setStatus(
        els.voiceStatus,
        result.tts.configured ? `TTS 已配置：${result.tts.model} / ${result.tts.voice}` : `TTS 未单独配置，尝试复用模型账号：${result.tts.model}`,
        result.tts.configured ? "success" : "warn",
      );
    }
  } catch (error) {
    setStatus(els.systemStatus, error.message || "状态读取失败", "error");
  }
};

const loadStyles = async () => {
  try {
    const result = await apiJson("/api/styles");
    if (!result.ok) throw new Error(result.message || "styles failed");
    renderStyles(result.styles || []);
    if ((result.styles || []).length) await loadStyleProfile(state.activeStyleId || result.styles[0].id);
  } catch (error) {
    renderStyles([]);
    setStatus(els.rewriteStatus, error.message || "风格列表读取失败", "error");
    if (els.styleLibraryStatus) setStatus(els.styleLibraryStatus, error.message || "风格列表读取失败", "error");
  }
};

const loadTtsConfig = async () => {
  if (!els.voiceModel) return;
  try {
    const result = await apiJson("/api/tts-config");
    if (!result.ok) throw new Error(result.message || "TTS 配置读取失败");
    els.voiceModel.value = result.model || "gpt-4o-mini-tts";
    els.voiceName.value = result.voice || "alloy";
    els.voiceFormat.value = result.format || "mp3";
    setStatus(
      els.voiceStatus,
      result.configured ? `TTS 已配置：${result.model} / ${result.voice}` : "TTS 未单独配置，将尝试复用模型账号。",
      result.configured ? "success" : "warn",
    );
  } catch (error) {
    setStatus(els.voiceStatus, error.message || "TTS 配置读取失败", "error");
  }
};

const currentVoiceText = () => {
  if (els.voiceSource.value === "source") return els.sourceCopy.value.trim();
  return els.revisedCopy.value.trim();
};

els.sourceEditor.addEventListener("input", () => {
  els.sourceCopy.value = sourceEditorToMarkdown();
  syncCounts();
  ensureEditorPlaceholder();
});
els.revisedCopy.addEventListener("input", syncCounts);

els.styleSelect.addEventListener("change", async () => {
  try {
    await loadStyleProfile(els.styleSelect.value);
  } catch (error) {
    setStatus(els.styleLibraryStatus, error.message || "风格卡读取失败", "error");
  }
});

els.styleLibraryList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-style-id]");
  if (!button) return;
  try {
    await loadStyleProfile(button.dataset.styleId || "");
  } catch (error) {
    setStatus(els.styleLibraryStatus, error.message || "风格卡读取失败", "error");
  }
});

els.dnaVersionHistory.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-style-dna-version]");
  if (!button) return;
  try {
    setStatus(els.styleLibraryStatus, "正在读取历史 DNA 版本...", "loading");
    const result = await apiJson(`/api/style-dna-version?style_id=${encodeURIComponent(button.dataset.styleId || state.activeStyleId)}&version=${encodeURIComponent(button.dataset.styleDnaVersion || "")}`);
    if (!result.ok) throw new Error(result.message || "DNA 版本读取失败");
    renderStyleDna(result.dna);
    setStatus(els.styleLibraryStatus, `正在查看 DNA v${result.version?.version || "?"}（只读）`, "success");
  } catch (error) {
    setStatus(els.styleLibraryStatus, error.message || "DNA 版本读取失败", "error");
  }
});

els.refreshStyleLibrary.addEventListener("click", async () => {
  els.refreshStyleLibrary.disabled = true;
  try {
    await loadStyles();
  } finally {
    els.refreshStyleLibrary.disabled = false;
  }
});

els.inspectStyleSamples.addEventListener("click", async () => {
  const text = els.sourceCopy.value.trim();
  if (!text) {
    setStatus(els.styleLibraryStatus, "原文为空。请先在左侧粘贴需要检查的参考样本。", "error");
    return;
  }
  els.inspectStyleSamples.disabled = true;
  setStatus(els.styleLibraryStatus, "正在检查样本量、近重复和模板候选...", "loading");
  try {
    const result = await apiJson("/api/style-sample-health", {
      method: "POST",
      body: JSON.stringify({ text, template_exclusions: selectedTemplateExclusions() }),
    });
    if (!result.ok) {
      setStatus(els.styleLibraryStatus, `${result.code || "ERROR"}：${result.message || "样本检查失败"}`, "error");
      return;
    }
    renderSampleHealth(result.sample_health);
    setStatus(els.styleLibraryStatus, "样本健康报告已生成；如需剥离候选，请勾选后再提取 DNA。", result.sample_health?.grade === "healthy" ? "success" : "warn");
  } catch (error) {
    setStatus(els.styleLibraryStatus, error.message || "样本检查失败", "error");
  } finally {
    els.inspectStyleSamples.disabled = false;
  }
});

els.analyzeCurrentStyle.addEventListener("click", async () => {
  const text = els.sourceCopy.value.trim();
  if (!text) {
    setStatus(els.styleLibraryStatus, "原文为空。请先在左侧粘贴需要提取风格的参考文本。", "error");
    return;
  }
  const name = els.styleName.value.trim() || selectedStyleName() || "未命名风格 DNA";
  els.analyzeCurrentStyle.disabled = true;
  setStatus(els.styleLibraryStatus, "正在提取当前文本的 Style DNA...", "loading");
  try {
    const result = await apiJson("/api/analyze-style", {
      method: "POST",
      body: JSON.stringify({
        text,
        name,
        template_exclusions: selectedTemplateExclusions(),
        health_review_confirmed: els.approveStyleDna.checked,
      }),
    });
    if (!result.ok) {
      setStatus(els.styleLibraryStatus, `${result.code || "ERROR"}：${result.message || "风格提取失败"}`, "error");
      return;
    }
    state.pendingStyleDna = result.dna || null;
    renderSampleHealth(result.sample_health);
    els.styleName.value = name;
    els.styleContent.value = result.suggested_markdown || els.styleContent.value;
    renderStyleDna(state.pendingStyleDna);
    setStatus(els.styleLibraryStatus, result.save_hint || "已生成 Style DNA 草稿，确认后保存。", "success");
  } catch (error) {
    setStatus(els.styleLibraryStatus, error.message || "风格提取失败", "error");
  } finally {
    els.analyzeCurrentStyle.disabled = false;
  }
});

els.checkStyleMatch.addEventListener("click", async () => {
  const text = els.revisedCopy.value.trim();
  if (!text) {
    setStatus(els.styleLibraryStatus, "改写稿为空，先生成或粘贴待检测文案。", "error");
    return;
  }
  els.checkStyleMatch.disabled = true;
  setStatus(els.styleLibraryStatus, "正在检测改写稿与所选 Style DNA 的匹配度...", "loading");
  try {
    const result = await apiJson("/api/style-match", {
      method: "POST",
      body: JSON.stringify({ text, style_id: els.styleSelect.value }),
    });
    if (!result.ok) {
      setStatus(els.styleLibraryStatus, `${result.code || "ERROR"}：${result.message || "风格检测失败"}`, "error");
      return;
    }
    renderStyleDna(state.pendingStyleDna, result.style_match);
    setStatus(els.styleLibraryStatus, result.style_match?.available ? `风格匹配：${result.style_match.overall}/100` : result.style_match?.message || "暂无评分", result.style_match?.available ? "success" : "warn");
  } catch (error) {
    setStatus(els.styleLibraryStatus, error.message || "风格检测失败", "error");
  } finally {
    els.checkStyleMatch.disabled = false;
  }
});

els.saveStyleProfile.addEventListener("click", async () => {
  const name = els.styleName.value.trim();
  const content = els.styleContent.value.trim();
  if (!content) {
    setStatus(els.styleLibraryStatus, "风格内容为空。", "error");
    return;
  }
  els.saveStyleProfile.disabled = true;
  setStatus(els.styleLibraryStatus, "正在保存风格卡...", "loading");
  try {
    const result = await apiJson("/api/style-profile", {
      method: "POST",
      body: JSON.stringify({
        name,
        content,
        style_dna: state.pendingStyleDna,
        style_dna_approval: {
          approved: els.approveStyleDna.checked,
          change_reason: els.styleChangeReason.value.trim(),
        },
      }),
    });
    if (!result.ok) {
      setStatus(els.styleLibraryStatus, `${result.code || "ERROR"}：${result.message || "保存失败"}`, "error");
      return;
    }
    renderStyles(result.styles || []);
    await loadStyleProfile(result.style?.id || "");
    setStatus(els.styleLibraryStatus, `已保存：${result.style?.name || name || "风格卡"}`, "success");
  } catch (error) {
    setStatus(els.styleLibraryStatus, error.message || "保存失败", "error");
  } finally {
    els.saveStyleProfile.disabled = false;
  }
});

els.importFeishu.addEventListener("click", async () => {
  const url = els.feishuUrl.value.trim();
  if (!url) {
    setStatus(els.feishuStatus, "请先粘贴飞书链接。", "error");
    return;
  }
  els.importFeishu.disabled = true;
  setStatus(els.feishuStatus, "正在读取飞书文档和素材...", "loading");
  try {
    const result = await apiJson(`/api/import-feishu?url=${encodeURIComponent(url)}`, { method: "GET" });
    if (!result.ok) {
      renderMetrics(result);
      renderAssets([]);
      setStatus(els.feishuStatus, `${result.code || "ERROR"}：${result.message || "读取失败"}`, "error");
      return;
    }
    state.importId = result.import_id || "";
    state.importPaths = result.paths || null;
    setSourceMarkdown(result.text || "");
    renderMetrics(result);
    renderAssets(result.assets || []);
    renderBrief(result.source_brief);
    renderPaths(result.paths || {});
    setStatus(els.feishuStatus, `已读取：${result.title || "飞书文档"}`, "success");
    setStatus(els.rewriteStatus, "可以开始风格改写", "idle");
  } catch (error) {
    setStatus(els.feishuStatus, error.message || "读取失败", "error");
  } finally {
    els.importFeishu.disabled = false;
  }
});

els.rewriteCopy.addEventListener("click", async () => {
  const text = els.sourceCopy.value.trim();
  if (!text) {
    setStatus(els.rewriteStatus, "原文为空。", "error");
    return;
  }
  els.rewriteCopy.disabled = true;
  els.styleSelect.disabled = true;
  setStatus(els.rewriteStatus, `正在按「${selectedStyleName()}」改写...`, "loading");
  try {
    const result = await apiJson("/api/rewrite-copy", {
      method: "POST",
      body: JSON.stringify({ text, import_id: state.importId, style_id: els.styleSelect.value }),
    });
    renderBrief(result.source_brief);
    if (!result.ok) {
      setStatus(els.rewriteStatus, `${result.code || "ERROR"}：${result.message || "改写失败"}`, "error");
      return;
    }
    els.revisedCopy.value = result.text || "";
    renderMaterials(result.material_requirements || []);
    els.riskList.innerHTML = formatList(result.risk_notes || []);
    state.rewritePaths = result.paths || null;
    renderPaths({ ...(state.importPaths || {}), ...(state.rewritePaths || {}) });
    syncCounts();
    const repairHint = result.quality?.meta_reference_auto_repaired ? "，已清理元叙述" : "";
    const match = result.quality?.style_match || null;
    if (match) renderStyleDna(state.pendingStyleDna, match);
    const matchHint = match?.available ? `，风格匹配 ${match.overall}/100` : "";
    setStatus(els.rewriteStatus, `已生成：${result.rewrite_id}${repairHint}${matchHint}`, "success");
  } catch (error) {
    setStatus(els.rewriteStatus, error.message || "改写失败", "error");
  } finally {
    els.rewriteCopy.disabled = false;
    els.styleSelect.disabled = !state.styles.length;
  }
});

els.clearRewrite.addEventListener("click", () => {
  els.revisedCopy.value = "";
  els.materialList.textContent = "暂无";
  els.riskList.textContent = "暂无";
  syncCounts();
  setStatus(els.rewriteStatus, "已清空结果", "idle");
});

els.synthesizeVoice.addEventListener("click", async () => {
  const text = currentVoiceText();
  if (!text) {
    setStatus(els.voiceStatus, els.voiceSource.value === "rewrite" ? "改写稿为空，先生成文案。" : "原文为空。", "error");
    return;
  }
  els.synthesizeVoice.disabled = true;
  setStatus(els.voiceStatus, "正在调用语音合成...", "loading");
  try {
    const result = await apiJson("/api/synthesize-voice", {
      method: "POST",
      body: JSON.stringify({
        text,
        model: els.voiceModel.value.trim(),
        voice: els.voiceName.value.trim(),
        format: els.voiceFormat.value,
      }),
    });
    if (!result.ok) {
      setStatus(els.voiceStatus, `${result.code || "ERROR"}：${result.message || "语音合成失败"}`, "error");
      return;
    }
    state.voicePaths = result.paths || null;
    els.voicePlayer.src = `${result.audio_url}?t=${Date.now()}`;
    els.voicePlayer.hidden = false;
    renderPathEntries(els.voicePathList, result.paths || {});
    renderPaths({ ...(state.importPaths || {}), ...(state.rewritePaths || {}), ...(state.voicePaths || {}) });
    setStatus(els.voiceStatus, `已生成语音：${result.audio_id}`, "success");
  } catch (error) {
    setStatus(els.voiceStatus, error.message || "语音合成失败", "error");
  } finally {
    els.synthesizeVoice.disabled = false;
  }
});

els.testAi.addEventListener("click", async () => {
  els.testAi.disabled = true;
  setStatus(els.systemStatus, "正在测试模型...", "loading");
  try {
    const result = await apiJson("/api/test-ai-config", { method: "POST", body: "{}" });
    if (!result.ok) {
      setStatus(els.systemStatus, `${result.code || "ERROR"}：${result.message || "模型不可用"}`, "error");
      return;
    }
    setStatus(els.systemStatus, `模型可用：${result.model}`, "success");
  } catch (error) {
    setStatus(els.systemStatus, error.message || "模型测试失败", "error");
  } finally {
    els.testAi.disabled = false;
  }
});

loadStatus();
loadStyles();
loadTtsConfig();
renderSourceEditor("");
syncCounts();
