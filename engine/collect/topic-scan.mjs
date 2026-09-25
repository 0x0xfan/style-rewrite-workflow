#!/usr/bin/env node
// 按选题词查闲鱼数据 + 截图 · 给每日写稿流程用
//
// 用法：
//   node engine/collect/topic-scan.mjs --keyword "<搜索词>" --out "<输出目录>" [--top 3]
//
// 设计：不重写采集逻辑，直接把 engine/collect/goofish-collect.mjs 当子进程调用——
// 登录态检测、验证码硬停、截图落盘、想要数/价格/详情/店铺口径分离，都用那边现成的。
// 本脚本只做三件事：
//   1) 调用采集器，拿到 capture.json + screenshots/manifest.json；
//   2) 逐张截图做"解码 + 尺寸 + 独立算 SHA-256"三项校验，通不过的直接排除、不装作有效；
//   3) 把校验过的数据重新整理成写稿人能直接用的 scan.json / shots/ / 数据摘要.md。
//
// 失败（未登录、验证码、无结果、采集器报错）一律非 0 退出，绝不伪造数据或截图。
//
// 登录态 profile 说明：goofish-collect.mjs 把 .collect-chrome-profile 解析成
// 相对于"子进程 cwd"的路径。在 git worktree 里跑本脚本时，worktree 下通常没有
// 这个 profile（登录态只在主仓库那份，且已 gitignore），所以本脚本会检测 worktree
// 下有没有 .collect-chrome-profile；没有就改把子进程 cwd 设成主仓库根目录
// （用 `git rev-parse --git-common-dir` 定位），复用主仓库已登录的那份 profile。

import { spawnSync, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COLLECT_SCRIPT = path.join(HERE, 'goofish-collect.mjs');
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// ------------------------------- 参数解析 -------------------------------

export function parseArgs(argv) {
  const args = { top: 3 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--keyword') args.keyword = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--top') args.top = parseInt(argv[++i], 10);
  }
  if (!args.keyword) throw new Error('缺少 --keyword "<搜索词>"');
  if (!args.out) throw new Error('缺少 --out "<输出目录>"');
  if (!Number.isFinite(args.top) || args.top < 1) args.top = 3;
  return args;
}

function fail(msg) {
  console.error(`[topic-scan][错误] ${msg}`);
  process.exit(1);
}

function log(msg) {
  console.log(`[topic-scan] ${msg}`);
}

// ------------------------------- 定位主仓库（登录态 profile 所在处） -------------------------------

// worktree 里跑本脚本时，.collect-chrome-profile 通常只在主仓库根目录（已登录、gitignored）。
// 用 git 自己的元数据定位主仓库，不猜测固定路径。定位不到就返回 null，上层原样用当前 cwd。
export function findMainRepoRoot(fromDir) {
  try {
    const out = execFileSync('git', ['rev-parse', '--git-common-dir'], {
      cwd: fromDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!out) return null;
    const commonDir = path.isAbsolute(out) ? out : path.resolve(fromDir, out);
    return path.dirname(commonDir); // .../.git 的父目录
  } catch {
    return null;
  }
}

// 决定采集子进程该用哪个 cwd，才能让它相对路径 .collect-chrome-profile 落到"已登录"的那份。
export function resolveCollectCwd(currentCwd, findRootFn = findMainRepoRoot) {
  const localProfile = path.join(currentCwd, '.collect-chrome-profile');
  if (existsSync(localProfile)) return { cwd: currentCwd, note: null };
  const mainRoot = findRootFn(currentCwd);
  if (mainRoot && existsSync(path.join(mainRoot, '.collect-chrome-profile'))) {
    return { cwd: mainRoot, note: `当前目录没有已登录的 .collect-chrome-profile，改用主仓库：${mainRoot}` };
  }
  return { cwd: currentCwd, note: '[警告] 未找到已登录的 .collect-chrome-profile（当前目录和主仓库都没有），采集器会新建 profile，需要重新扫码登录。' };
}

// ------------------------------- PNG 校验（纯函数：解码 magic + IHDR 尺寸 + 独立算 SHA-256） -------------------------------

export function verifyPng(buf) {
  if (!buf || buf.length === 0) return { ok: false, reason: '文件大小为 0' };
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_MAGIC)) {
    return { ok: false, reason: '不是合法 PNG（magic number 不匹配）' };
  }
  const ihdrType = buf.subarray(12, 16).toString('ascii');
  if (ihdrType !== 'IHDR') return { ok: false, reason: 'IHDR 块缺失，PNG 结构异常' };
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  if (width <= 0 || height <= 0) return { ok: false, reason: `解码尺寸异常（${width}x${height}）` };
  const sha256 = createHash('sha256').update(buf).digest('hex');
  return { ok: true, width, height, bytes: buf.length, sha256 };
}

export function verifyPngFile(filePath) {
  if (!existsSync(filePath)) return { ok: false, reason: '文件不存在' };
  return verifyPng(readFileSync(filePath));
}

// ------------------------------- 数据整理（纯函数，供测试不联网跑） -------------------------------

// 搜索页 Top N：按想要数降序，与采集器给正式详情页用的口径一致；全无想要数则按原序取前 N。
export function pickTopProducts(products, top) {
  const list = Array.isArray(products) ? products : [];
  const ranked = list.filter((c) => c.wants != null).sort((a, b) => (b.wants || 0) - (a.wants || 0));
  const chosen = (ranked.length ? ranked : list).slice(0, top);
  return chosen.map((c) => ({
    item_id: c.item_id,
    url: c.url,
    price: c.price,
    price_source: 'search_page',
    wants: c.wants,
    wants_source: 'search_page',
    region: c.region,
    seller_tag: c.seller_tag,
  }));
}

// 详情页数据：每个数值标来源层级（详情页单品口径 / 详情页店铺栏 / 卖家店铺主页），不合并口径。
export function buildDetailItems(detailEvidence) {
  const list = Array.isArray(detailEvidence) ? detailEvidence : [];
  return list.map((d) => ({
    item_id: d.item_id,
    rank: d.rank,
    title: d.title,
    source_url: d.source_url,
    item_metrics: d.item_metrics ? {
      price: d.item_metrics.price,
      price_range: d.item_metrics.price_range,
      wants: d.item_metrics.wants,
      views: d.item_metrics.views,
      source: 'detail_page',
    } : null,
    shop_metrics: d.shop_metrics ? { ...d.shop_metrics, source: 'detail_page_shop_panel' } : null,
    shop_page: (d.shop_page && d.shop_page.shop_metrics) ? {
      url: d.shop_page.url,
      ...d.shop_page.shop_metrics,
      source: 'shop_homepage',
    } : null,
    error: d.error || null,
  }));
}

// 给写稿人看的大白话摘要：只列证据链完整（有截图、有来源）的数字，不推断、不外推。
export function buildSummaryMarkdown({ keyword, capturedAt, queryNote, topProducts, detailItems, validShots, rejectedShots }) {
  const lines = [];
  lines.push(`# 「${keyword}」闲鱼数据摘要`);
  lines.push('');
  lines.push(`采集时间：${capturedAt}`);
  if (queryNote) lines.push(`> ${queryNote}`);
  lines.push('');
  lines.push('## 能写进稿的数（原样数字，标来源图）');
  const searchShot = validShots.find((s) => s.type === 'search_results');
  topProducts.forEach((p, idx) => {
    const detailShot = validShots.find((s) => s.type === 'product_detail' && s.item_id === p.item_id);
    const d = detailItems.find((x) => x.item_id === p.item_id);
    lines.push('');
    lines.push(`### 第 ${idx + 1} 条`);
    if (p.price != null) lines.push(`- 标价 ¥${p.price}（搜索页，见 ${searchShot ? searchShot.file : '搜索结果页截图'}）`);
    if (p.wants != null) lines.push(`- ${p.wants} 人想要（搜索页，见 ${searchShot ? searchShot.file : '搜索结果页截图'}）`);
    if (d && d.item_metrics) {
      if (d.item_metrics.price != null) {
        const range = d.item_metrics.price_range ? `（区间 ${d.item_metrics.price_range}）` : '';
        lines.push(`- 详情页标价 ¥${d.item_metrics.price}${range}（详情页，见 ${detailShot ? detailShot.file : '详情页截图'}）`);
      }
      if (d.item_metrics.wants != null) lines.push(`- 详情页 ${d.item_metrics.wants} 人想要（详情页，见 ${detailShot ? detailShot.file : '详情页截图'}）`);
      if (d.item_metrics.views != null) lines.push(`- ${d.item_metrics.views} 浏览（详情页，见 ${detailShot ? detailShot.file : '详情页截图'}）`);
    }
    if (d && d.shop_metrics) {
      if (d.shop_metrics.shop_sold_total != null) lines.push(`- 卖家店铺累计卖出 ${d.shop_metrics.shop_sold_total} 件（店铺口径，非本单销量，详情页店铺栏）`);
      if (d.shop_metrics.shop_rating) lines.push(`- 卖家好评率 ${d.shop_metrics.shop_rating}（店铺口径）`);
    }
  });
  lines.push('');
  lines.push('## 截图清单');
  for (const s of validShots) {
    lines.push(`- ${s.file}（${s.width}x${s.height}，${s.bytes} 字节，SHA-256 ${s.sha256.slice(0, 12)}…）— ${s.source_url}`);
  }
  if (rejectedShots.length) {
    lines.push('');
    lines.push('## 未通过校验、已排除的截图');
    for (const r of rejectedShots) lines.push(`- ${r.id}：${r.reason}`);
  }
  lines.push('');
  lines.push('## 口径提醒');
  lines.push('- 「人想要」是单品兴趣信号，不是订单/销量/市场需求，稿里别写成"卖了多少"。');
  lines.push('- 店铺累计卖出、好评率、店龄是店铺口径，不是本单数据，别混着当单品销量说。');
  lines.push('- 稿子只能用上面列出的数字和它标的来源图，不做推断、不外推、不补数。');
  lines.push('- 口播里不带具体月份/时效词（如"九月初"），直接说"你在闲鱼搜"。');
  return lines.join('\n');
}

// ------------------------------- 主流程 -------------------------------

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    fail(e.message);
    return;
  }

  const outDir = path.resolve(args.out);
  const rawDir = path.join(outDir, '_raw');
  const shotsDir = path.join(outDir, 'shots');
  mkdirSync(outDir, { recursive: true });
  mkdirSync(shotsDir, { recursive: true });

  log(`选题词：「${args.keyword}」，Top${args.top}`);
  log(`调用采集器：${COLLECT_SCRIPT}`);

  if (!existsSync(COLLECT_SCRIPT)) {
    fail(`找不到采集器 ${COLLECT_SCRIPT}`);
    return;
  }

  const { cwd: collectCwd, note: cwdNote } = resolveCollectCwd(process.cwd());
  if (cwdNote) log(cwdNote);

  // 1) 复用 goofish-collect.mjs 做真正的浏览器采集（登录态检测、验证码硬停、截图落盘都在那边）
  //    --out 用绝对路径，不受 collectCwd 影响。
  const res = spawnSync(
    process.execPath,
    [COLLECT_SCRIPT, '--query', args.keyword, '--out', rawDir, '--top', String(args.top)],
    { stdio: 'inherit', cwd: collectCwd }
  );
  if (res.error) {
    fail(`采集子进程启动失败：${res.error.message}`);
    return;
  }
  const collectExit = res.status;

  const captureJsonPath = path.join(rawDir, 'capture.json');
  const manifestPath = path.join(rawDir, 'screenshots', 'manifest.json');
  if (!existsSync(captureJsonPath)) {
    fail(`采集器未产出 capture.json（退出码 ${collectExit}），判定采集失败，不伪造任何产物。`);
    return;
  }
  const capture = JSON.parse(readFileSync(captureJsonPath, 'utf8'));

  // 2) 登录门 / 验证码 / 无结果 / 其它错误：一律明确报错退出，绝不伪造
  if (capture.status === 'blocked_login') {
    fail(`未登录：${capture.status_note || '闲鱼登录态未通过，请在采集 Chrome 窗口扫码后重跑'}`);
    return;
  }
  if (capture.status === 'blocked_captcha') {
    fail(`遇到人机验证：${capture.status_note || '请人工完成滑块/验证码后重跑，脚本不会代过验证'}`);
    return;
  }
  if (capture.status === 'no_results') {
    fail(`「${args.keyword}」在闲鱼无搜索结果：${capture.status_note || ''}`);
    return;
  }
  if (capture.status === 'error') {
    fail(`采集器报错：${capture.status_note || '未知错误'}`);
    return;
  }
  if (capture.status !== 'ok' || collectExit !== 0) {
    fail(`采集未成功（status=${capture.status}，退出码=${collectExit}），不产出数据。`);
    return;
  }

  // 3) 逐张校验截图：解码 PNG + 尺寸 + 独立算 SHA-256；manifest 里标 scrapped（遮挡判废）的直接排除
  let manifest = { screenshots: [] };
  if (existsSync(manifestPath)) {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  }
  const manifestById = new Map((manifest.screenshots || []).map((s) => [s.id, s]));

  // capture.json 里的 screenshots 只有 id/file/source_url（type、item_id 只在 manifest.json 里），
  // 这里把两边按 id 合并，取 manifest 的 type/item_id 做筛选依据。
  const mergedShots = (capture.screenshots || []).map((s) => {
    const m = manifestById.get(s.id);
    return { ...s, type: m ? m.type : undefined, item_id: (m && m.item_id) || s.item_id };
  });

  // 只要接口承诺的两类：搜索结果页 1 张 + 详情页 Top N 各 1 张（店铺主页截图是采集器的额外产物，不进 shots/）
  const relevantShots = mergedShots.filter((s) => s.type === 'search_results' || s.type === 'product_detail');

  const validShots = [];
  const rejectedShots = [];
  for (const s of relevantShots) {
    const m = manifestById.get(s.id);
    if (m && m.status === 'scrapped') {
      rejectedShots.push({ id: s.id, reason: `截图被判废（遮挡）：${(m.occlusions || []).join(' | ') || '未知遮挡'}` });
      continue;
    }
    const srcPath = path.join(rawDir, s.file);
    const v = verifyPngFile(srcPath);
    if (!v.ok) {
      rejectedShots.push({ id: s.id, reason: `PNG 校验失败：${v.reason}` });
      continue;
    }
    if (m && m.sha256 && m.sha256 !== v.sha256) {
      rejectedShots.push({ id: s.id, reason: 'SHA-256 与采集器 manifest 不一致，判废' });
      continue;
    }
    const destName = path.basename(s.file);
    copyFileSync(srcPath, path.join(shotsDir, destName));
    validShots.push({
      id: s.id,
      type: s.type,
      file: `shots/${destName}`,
      source_url: s.source_url,
      item_id: s.item_id || null,
      width: v.width,
      height: v.height,
      bytes: v.bytes,
      sha256: v.sha256,
      captured_at: (m && m.captured_at) || capture.captured_at,
      // 采集器截图前会等商品图懒加载完成（有超时上限）；如实带出未加载张数，
      // 不因为 PNG 校验通过就假装图片区域都渲染出来了。
      images_total: (m && m.images_total) ?? null,
      images_unloaded: (m && m.images_unloaded) ?? null,
    });
    if (m && m.images_unloaded > 0) {
      log(`[告警] ${s.id} 截图仍有 ${m.images_unloaded}/${m.images_total} 张图未加载完成`);
    }
  }

  if (rejectedShots.length) {
    log(`[告警] ${rejectedShots.length} 张截图未通过校验，已排除：${rejectedShots.map((r) => r.id).join('、')}`);
  }
  // 搜索结果页是硬性必需项：没有它就没有"前两句提闲鱼+数据"的图证，直接判失败
  const hasSearchShot = validShots.some((s) => s.type === 'search_results');
  if (!hasSearchShot) {
    fail('搜索结果页截图校验未通过或缺失，判定本次采集失败，不产出数据。');
    return;
  }

  // 4) 整理数据（纯函数部分，供测试覆盖）
  const topProducts = pickTopProducts(capture.products, args.top);
  const detailItems = buildDetailItems(capture.detail_evidence);
  const queryNote = capture.query_used !== args.keyword
    ? `原词结果不足，实际采集用词为「${capture.query_used}」（采集器自动切词兜底）`
    : null;

  const scan = {
    schema_version: '1.0',
    keyword: args.keyword,
    query_used: capture.query_used,
    query_note: queryNote,
    captured_at: capture.captured_at,
    top_n: args.top,
    search_results_top: topProducts,
    detail: detailItems,
    screenshots: validShots,
    rejected_screenshots: rejectedShots,
    source: 'goofish-collect.mjs（CDP 直采已登录闲鱼页面）',
  };
  writeFileSync(path.join(outDir, 'scan.json'), JSON.stringify(scan, null, 2), 'utf8');

  const summaryMd = buildSummaryMarkdown({
    keyword: args.keyword,
    capturedAt: capture.captured_at,
    queryNote,
    topProducts,
    detailItems,
    validShots,
    rejectedShots,
  });
  writeFileSync(path.join(outDir, '数据摘要.md'), summaryMd, 'utf8');

  log(`产物写出：${path.join(outDir, 'scan.json')}`);
  log(`产物写出：${path.join(outDir, '数据摘要.md')}`);
  log(`截图目录：${shotsDir}（${validShots.length} 张有效 PNG，${rejectedShots.length} 张排除）`);
  log('完成。');
  process.exit(0);
}

// 只在直接运行时执行主流程；被 import 用于测试时不跑
const isMain = (() => {
  try {
    return path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || '');
  } catch {
    return false;
  }
})();
if (isMain) {
  main().catch((e) => {
    console.error('[topic-scan][致命]', e && e.stack ? e.stack : e);
    process.exit(1);
  });
}
