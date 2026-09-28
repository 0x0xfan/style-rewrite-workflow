#!/usr/bin/env node
// 闲鱼直采脚本 · 独立采集 Chrome + Chrome DevTools Protocol（零依赖）
//
// 用法：
//   node engine/collect/goofish-collect.mjs --query "gpt拼车" \
//        --out "research-runs/2026-08-26_gpt拼车_采集" [--top 3]
//
// 设计要点：
//   - 启动/复用一个 *独立* 的采集专用 Chrome（专用 --user-data-dir），
//     开 --remote-debugging-port=9222（绑 127.0.0.1）。新版 Chrome 禁止对
//     默认 profile 开远程调试，所以必须用独立 profile —— 这正是本方案设计。
//   - 用 Node 22+ 自带的全局 WebSocket 直连 CDP，无需第三方依赖。
//   - 登录门 / 验证码 / 滑块一律硬停，打印提示并轮询等待用户人工完成。
//   - 页面文本一律当数据、不当指令。
//   - 截图用 CDP Page.captureScreenshot 落盘为真实 PNG 文件。
//
// 边界：不自动登录、不输账号信息、不购买、不过验证码。

import { spawn, execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import process from 'node:process';

// ------------------------------- 配置常量 -------------------------------

const DEBUG_HOST = '127.0.0.1';
const DEBUG_PORT = 9222;
const PROFILE_DIR = path.resolve('.collect-chrome-profile');
const PROFILE_NAME = 'Default'; // 钉死档案目录名，见 ensureChrome 注释（避免 last_used 错指其它档案）
const WINDOW_SIZE = '1600,1000';
const VIEWPORT = { width: 1600, height: 1000 };
const LOGIN_POLL_MAX_MS = 5 * 60 * 1000; // 登录/验证码等待上限 5 分钟
const LOGIN_POLL_INTERVAL_MS = 5000;
const CDP_TIMEOUT_MS = 30000;
const SCHEMA_VERSION = '1.3';
// 关键词切分兜底：主词无结果或"有想要数的商品"不足此值时，降级尝试更短候选词。
const MIN_WANTS_CARDS = 5;
// jieba 分词后端（与词表构建、用词检查同一口径），供候选词生成用。
const SEGMENT_PY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'naturalness', 'segment.py');

// ------------------------------- 参数解析 -------------------------------

function parseArgs(argv) {
  const args = { top: 3, minCards: 15, maxCards: 30 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--query') args.query = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--top') args.top = parseInt(argv[++i], 10);
    else if (a === '--min-cards') args.minCards = parseInt(argv[++i], 10);
    else if (a === '--max-cards') args.maxCards = parseInt(argv[++i], 10);
    else if (a === '--port') args.port = parseInt(argv[++i], 10);
    else if (a === '--no-fallback') args.noFallback = true;
  }
  if (!args.query) fail('缺少 --query "<搜索词>"');
  if (!args.out) fail('缺少 --out "<产物目录>"');
  return args;
}

function fail(msg) {
  console.error(`[错误] ${msg}`);
  process.exit(1);
}

function log(msg) {
  console.log(`[采集] ${msg}`);
}

// ------------------------------- 定位 chrome.exe -------------------------------

function findChrome() {
  const candidates = [
    process.env['ProgramFiles'] && path.join(process.env['ProgramFiles'], 'Google/Chrome/Application/chrome.exe'),
    process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Google/Chrome/Application/chrome.exe'),
    process.env['LOCALAPPDATA'] && path.join(process.env['LOCALAPPDATA'], 'Google/Chrome/Application/chrome.exe'),
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ].filter(Boolean);
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  // 注册表兜底
  try {
    const out = execSync(
      'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe" /ve',
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    const m = out.match(/REG_SZ\s+(.+chrome\.exe)/i);
    if (m && existsSync(m[1].trim())) return m[1].trim();
  } catch { /* ignore */ }
  try {
    const out = execSync(
      'reg query "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe" /ve',
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    const m = out.match(/REG_SZ\s+(.+chrome\.exe)/i);
    if (m && existsSync(m[1].trim())) return m[1].trim();
  } catch { /* ignore */ }
  return null;
}

// ------------------------------- 启动/复用 Chrome -------------------------------

async function fetchJson(url, timeoutMs = 2000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ac.signal });
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function isDebuggerUp(port) {
  try {
    const v = await fetchJson(`http://${DEBUG_HOST}:${port}/json/version`);
    return v && v.webSocketDebuggerUrl ? v : null;
  } catch {
    return null;
  }
}

async function ensureChrome(port) {
  const existing = await isDebuggerUp(port);
  if (existing) {
    log(`复用已在运行的采集 Chrome（端口 ${port}）：${existing.Browser || ''}`);
    return existing;
  }
  const chrome = findChrome();
  if (!chrome) fail('未找到 chrome.exe（已查常见路径与注册表）。请确认已安装 Google Chrome。');
  log(`定位到 Chrome：${chrome}`);
  mkdirSync(PROFILE_DIR, { recursive: true });
  const args = [
    `--remote-debugging-port=${port}`,
    `--remote-debugging-address=${DEBUG_HOST}`,
    `--user-data-dir=${PROFILE_DIR}`,
    // 固定档案：克隆的登录态在 Default 里，而 Local State 的 last_used 曾错指 Profile 3，
    // 只给 --user-data-dir 时 Chrome 会打开错误档案 → 每次都像未登录、反复要求扫码。
    // 显式钉死 Default，让"启动/扫码/采集"永远用同一个已登录档案。
    `--profile-directory=${PROFILE_NAME}`,
    '--no-first-run',
    '--no-default-browser-check',
    `--window-size=${WINDOW_SIZE}`,
    'about:blank',
  ];
  log(`启动采集专用 Chrome（独立 profile：${PROFILE_DIR}，档案：${PROFILE_NAME}）`);
  const child = spawn(chrome, args, { detached: true, stdio: 'ignore' });
  child.unref();

  // 轮询等待调试端口就绪
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const v = await isDebuggerUp(port);
    if (v) {
      log('采集 Chrome 调试端口已就绪');
      return v;
    }
    await sleep(500);
  }
  fail('采集 Chrome 启动后 20s 内调试端口未就绪');
}

// ------------------------------- CDP 客户端（零依赖 WebSocket） -------------------------------

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = [];
    ws.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.id !== undefined && this.pending.has(msg.id)) {
        const { resolve, reject, timer } = this.pending.get(msg.id);
        clearTimeout(timer);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.message || 'CDP error'} (${JSON.stringify(msg.error)})`));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const l of this.listeners) l(msg);
      }
    });
    ws.addEventListener('close', () => {
      for (const { reject, timer } of this.pending.values()) {
        clearTimeout(timer);
        reject(new Error('CDP 连接已关闭'));
      }
      this.pending.clear();
    });
  }

  send(method, params = {}, sessionId, timeoutMs = CDP_TIMEOUT_MS) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP 超时：${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify(payload));
    });
  }

  onEvent(fn) { this.listeners.push(fn); }

  close() { try { this.ws.close(); } catch { /* ignore */ } }
}

// 每步超时 + 重试一次
async function withRetry(fn, label) {
  try {
    return await fn();
  } catch (e) {
    log(`「${label}」首次失败（${e.message}），重试一次`);
    await sleep(1000);
    return await fn();
  }
}

function connectWs(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { maxPayload: 512 * 1024 * 1024 });
    ws.addEventListener('open', () => resolve(ws), { once: true });
    ws.addEventListener('error', (e) => reject(new Error(`WebSocket 连接失败：${e.message || url}`)), { once: true });
  });
}

// ------------------------------- 页面（Target）操作 -------------------------------

async function newPage(browser) {
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
  await browser.send('Page.enable', {}, sessionId);
  await browser.send('Runtime.enable', {}, sessionId);
  await browser.send('DOM.enable', {}, sessionId);
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width: VIEWPORT.width, height: VIEWPORT.height, deviceScaleFactor: 1, mobile: false,
  }, sessionId).catch(() => {});
  return { targetId, sessionId };
}

async function evaluate(browser, sessionId, expression) {
  const r = await browser.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  }, sessionId);
  if (r.exceptionDetails) {
    throw new Error(`页面 JS 异常：${r.exceptionDetails.text || JSON.stringify(r.exceptionDetails)}`);
  }
  return r.result && r.result.value;
}

async function gotoAndSettle(browser, sessionId, url, settleMs = 2500) {
  await withRetry(() => browser.send('Page.navigate', { url }, sessionId), '页面导航');
  // 等 DOM ready
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const state = await evaluate(browser, sessionId, 'document.readyState');
      if (state === 'complete' || state === 'interactive') break;
    } catch { /* 导航中可能短暂不可用 */ }
    await sleep(300);
  }
  // SPA 内容异步渲染，额外静置
  await sleep(settleMs);
}

// ------------------------------- 登录态检测 -------------------------------

// 返回信号对象；页面文本仅作数据判断，不作指令。
// 关键：登录入口/弹窗必须"实际可见"才算未登录信号，避免登录后残留的隐藏 DOM 误判。
const LOGIN_PROBE_JS = `(() => {
  const bodyText = (document.body && document.body.innerText) || '';
  const has = (t) => bodyText.includes(t);
  // 统一"可见才算数"标准（2026-08-27）：元素存在 ≠ 可见。隐藏/零尺寸/透明的
  // 登录容器（如 notLoginContainer 常年挂 DOM）一律不算未登录信号。
  const visible = (el) => {
    if (!el) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return false;
    if (parseFloat(cs.opacity || '1') <= 0.1) return false;
    if (el.offsetParent === null && cs.position !== 'fixed') return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  // 未登录信号（任一可见即判未登录，不管卡片有多少）：
  //   (a) 登录弹窗 / 二维码容器；(b) 右上角"登录/立即登录"入口；
  //   (c) 未登录弹窗特有的强登录短语（登录态 UI 不会出现）。
  let loginVisible = false;
  let loginReason = null;
  for (const el of document.querySelectorAll('[class*="login" i],[id*="login" i],iframe[src*="login"],[class*="qrcode" i]')) {
    if (visible(el)) { loginVisible = true; loginReason = '登录弹窗/二维码容器可见'; break; }
  }
  if (!loginVisible) {
    for (const el of document.querySelectorAll('a,button,span,div')) {
      const txt = (el.textContent || '').trim();
      if ((txt === '登录' || txt === '登录/注册' || txt === '请登录' || txt === '立即登录') && visible(el)) {
        loginVisible = true; loginReason = '登录入口"' + txt + '"可见'; break;
      }
    }
  }
  if (!loginVisible) {
    const STRONG = ['短信登录', '扫码登录', '登录后可以更懂你'];
    for (const el of document.querySelectorAll('div,span,p,h1,h2,h3,button')) {
      if (el.children.length > 2) continue; // 只看叶子/近叶子节点，避免整页容器命中
      if (!visible(el)) continue;
      const txt = el.innerText || ''; // innerText 只含可见文本，隐藏子树文案不计
      const hit = STRONG.find((k) => txt.includes(k));
      if (hit) { loginVisible = true; loginReason = '登录弹窗文案"' + hit + '"可见'; break; }
    }
  }
  // 已登录唯一证据：右上角可见的昵称/头像节点（offsetParent 可见性校验）。
  let userVisible = false;
  for (const el of document.querySelectorAll('[class*="nick" i],[class*="avatar" i]')) {
    if (visible(el)) { userVisible = true; break; }
  }
  // 结果卡片数量（item?id 链接去重）
  const ids = new Set();
  for (const a of document.querySelectorAll('a[href*="item?id="], a[href*="item.htm?id="]')) {
    const m = (a.getAttribute('href') || '').match(/id=(\\d+)/);
    if (m) ids.add(m[1]);
  }
  // 无结果页（此时页面卡片全是"猜你喜欢"推荐填充，不可当搜索结果）
  const noResults = has('没有找到你想要的宝贝') || has('没有找到相关');
  return {
    cardCount: ids.size,
    loginVisible, loginReason, userVisible, noResults,
    guessYouLike: has('猜你喜欢'),
    title: document.title || '',
    url: location.href,
  };
})()`;

function isLoggedIn(sig) {
  // 正向证据制（2026-08-27 事故修复）：
  //   闲鱼未登录态现在也返回真实搜索结果（30 张真实卡片、想要数正常），
  //   所以"卡片数"不再是登录证据 —— 卡片有多少都不算数。
  //   唯一的"已登录"证据 = 右上角可见的用户昵称/头像节点。
  //   登录弹窗可见 / 右上角"登录"入口可见 / 登录弹窗文案可见，任一者 = 未登录。
  if (sig.loginVisible) return false;   // 任一未登录信号可见 → 未登录（无视卡片数）
  return sig.userVisible;               // 已登录唯一证据：昵称/头像可见
}

// 登录弹窗"先观察再下结论"（2026-09-28 修复）：
//   闲鱼网页打开时会先弹登录框；登录缓存没失效的话，约 3 秒后自动用旧账号登录、
//   弹框消失、卡片加载出来。所以页面刚加载时看到弹框不能立刻判"需要人工登录"，
//   要原地每 LOGIN_SETTLE_POLL_MS 复查一次（不刷新、不重开页面），最多等
//   LOGIN_SETTLE_MAX_MS；等满仍未登录才判需要人工。
export const LOGIN_SETTLE_MAX_MS = 12000;
export const LOGIN_SETTLE_POLL_MS = 1000;

// 纯函数：输入原地复查得到的快照序列（按时间先后，每项形如
//   { elapsedMs, loginVisible, userVisible, cardCount, noResults }），
// 输出 'continue'（已登录且有卡片/明确无结果，或等满后已登录）/
//      'wait'（还没到等待上限，继续原地复查）/
//      'manual'（等满仍未登录，需要人工登录）。
// 只看最新一次快照 + 已用时长；不读时钟、不碰页面。
export function decideLoginState(samples, settleMaxMs = LOGIN_SETTLE_MAX_MS) {
  const list = Array.isArray(samples) ? samples.filter(Boolean) : [];
  if (!list.length) return 'wait';
  const last = list[list.length - 1];
  const loggedIn = isLoggedIn(last);
  const ready = loggedIn && ((last.cardCount || 0) > 0 || !!last.noResults);
  if (ready) return 'continue';
  const elapsed = Number(last.elapsedMs) || 0;
  if (elapsed < settleMaxMs) return 'wait';
  // 等满：已登录（只是卡片还没出来）按原逻辑继续，交给后续采集；未登录才要人工。
  return loggedIn ? 'continue' : 'manual';
}

// 原地复查登录态直到 decideLoginState 给出结论；期间绝不导航/刷新。
async function settleLoginState(browser, sessionId, settleMaxMs = LOGIN_SETTLE_MAX_MS) {
  const t0 = Date.now();
  const samples = [];
  let sig = null;
  for (;;) {
    try {
      sig = await evaluate(browser, sessionId, LOGIN_PROBE_JS);
      samples.push({ ...sig, elapsedMs: Date.now() - t0 });
    } catch {
      samples.push({ loginVisible: true, userVisible: false, cardCount: 0, noResults: false, elapsedMs: Date.now() - t0 });
    }
    const verdict = decideLoginState(samples, settleMaxMs);
    if (verdict !== 'wait') return { verdict, sig: sig || samples[samples.length - 1] };
    if (samples.length === 1 && sig && sig.loginVisible) {
      log(`看到登录弹窗，先原地观察（每 ${LOGIN_SETTLE_POLL_MS / 1000}s 复查一次，最多 ${settleMaxMs / 1000}s；登录缓存有效时弹框会自动消失）…`);
    }
    await sleep(LOGIN_SETTLE_POLL_MS);
  }
}

async function waitForLogin(browser, sessionId) {
  const settled = await settleLoginState(browser, sessionId);
  let sig = settled.sig;
  if (settled.verdict === 'continue') {
    log(`登录态正常（可见用户昵称/头像=${sig.userVisible}，卡片 ${sig.cardCount}，无结果页=${sig.noResults}）`);
    return sig;
  }
  console.log('');
  console.log('==================== 需要人工登录 ====================');
  console.log('采集专用 Chrome 窗口已打开在闲鱼页面，但检测到 *未登录* 状态。');
  console.log(`未登录判据：${sig.loginReason || '未见用户昵称/头像节点'}。`);
  console.log('检测信号：', JSON.stringify({
    未登录判据: sig.loginReason, 可见用户昵称头像: sig.userVisible,
    结果卡片数: sig.cardCount, 无结果页: sig.noResults, 猜你喜欢填充: sig.guessYouLike,
  }));
  // 硬停理由（事故修复 2026-08-27）：即使页面已返回真实结果也不采。
  console.log('>>> 硬停原因：闲鱼未登录态也会返回真实卡片，但此时 (1) 页面必带登录弹窗，');
  console.log('>>>          截图会被弹窗污染、无法当视频素材；(2) 未登录数据可能与登录态存在口径差。');
  console.log('>>> 请在采集专用 Chrome 窗口扫码登录闲鱼（本脚本不会自动登录、不输账号信息）。');
  console.log(`>>> 登录成功后脚本会自动继续（最长等待 ${LOGIN_POLL_MAX_MS / 60000} 分钟）。`);
  console.log('>>> 等待期间脚本不会刷新或重开页面，只在原地复查，不会打断你扫码。');
  console.log('======================================================');
  console.log('');

  const deadline = Date.now() + LOGIN_POLL_MAX_MS;
  while (Date.now() < deadline) {
    await sleep(LOGIN_POLL_INTERVAL_MS);
    // 只原地复查，不导航/不刷新（2026-09-28 修复：原来每轮 gotoAndSettle 重开搜索页，
    // 会把用户正在扫的二维码刷掉，导致根本没法人工登录）。
    try {
      sig = await evaluate(browser, sessionId, LOGIN_PROBE_JS);
    } catch { continue; }
    if (isLoggedIn(sig)) {
      log(`检测到登录成功（可见用户昵称/头像=${sig.userVisible}，卡片 ${sig.cardCount}），原地等结果卡片加载…`);
      // 登录后页面自己会刷新出结果；仍只原地复查，等卡片/无结果标志出现（最多 LOGIN_SETTLE_MAX_MS）。
      const after = await settleLoginState(browser, sessionId);
      if (after.verdict === 'continue') return after.sig;
      sig = after.sig;
      continue;
    }
    const left = Math.round((deadline - Date.now()) / 1000);
    log(`仍未登录（${sig.loginReason || '未见用户昵称/头像'}，卡片 ${sig.cardCount}，剩余 ${left}s）…`);
  }
  throw new Error('LOGIN_TIMEOUT');
}

// ------------------------------- 滑块/验证码硬停 -------------------------------

const CAPTCHA_PROBE_JS = `(() => {
  const t = (document.body && document.body.innerText) || '';
  const hit = t.includes('滑动验证') || t.includes('拖动滑块') || t.includes('向右滑动')
    || t.includes('请完成安全验证') || t.includes('人机验证');
  const el = !!document.querySelector('[class*="captcha" i], [class*="nc_scale" i], [id*="nocaptcha" i], [class*="slider" i][class*="verify" i]');
  return { captcha: hit || el };
})()`;

async function waitIfCaptcha(browser, sessionId) {
  let s = await evaluate(browser, sessionId, CAPTCHA_PROBE_JS).catch(() => ({ captcha: false }));
  if (!s.captcha) return;
  console.log('');
  console.log('==================== 检测到人机验证 ====================');
  console.log('>>> 请在采集专用 Chrome 窗口人工完成滑块/验证码（本脚本不会代过验证）。');
  console.log(`>>> 完成后脚本自动继续（最长等待 ${LOGIN_POLL_MAX_MS / 60000} 分钟）。`);
  console.log('=======================================================');
  const deadline = Date.now() + LOGIN_POLL_MAX_MS;
  while (Date.now() < deadline) {
    await sleep(LOGIN_POLL_INTERVAL_MS);
    s = await evaluate(browser, sessionId, CAPTCHA_PROBE_JS).catch(() => ({ captcha: false }));
    if (!s.captcha) { log('验证已完成，继续采集'); return; }
    log('仍在验证页，等待人工完成…');
  }
  throw new Error('CAPTCHA_TIMEOUT');
}

// ------------------------------- 搜索结果采集 -------------------------------

// 在页面内抽取卡片。走 item?id 链接容器，取文本用正则解析。
const COLLECT_CARDS_JS = `(() => {
  const seen = new Map();
  const anchors = document.querySelectorAll('a[href*="item?id="], a[href*="item.htm?id="]');
  for (const a of anchors) {
    const href = a.getAttribute('href') || '';
    const m = href.match(/id=(\\d+)/);
    if (!m) continue;
    const id = m[1];
    // 关键：goofish 搜索卡片就是这个 <a class="feeds-item-wrap..."> 本身，
    // 用它自己的 innerText（每卡独立）。切勿向上取父节点——父节点是整个结果网格，
    // 会让所有卡片抄到同一段文本。
    const text = (a.innerText || '').replace(/\\s+/g, ' ').trim();
    const prev = seen.get(id);
    if (!prev || text.length > prev.raw_text.length) {
      const url = href.startsWith('http') ? href : ('https://www.goofish.com/' + href.replace(/^\\//, ''));
      seen.set(id, { item_id: id, url, raw_text: text });
    }
  }
  const out = [];
  for (const [id, card] of seen) {
    const t = card.raw_text;
    const priceM = t.match(/[¥￥]\\s*([0-9]+(?:\\.[0-9]+)?)/) || t.match(/([0-9]+(?:\\.[0-9]+)?)\\s*元/);
    const wantsM = t.match(/([0-9]+)\\s*人想要/) || t.match(/([0-9]+)\\s*人付款/);
    const regionM = t.match(/(北京|上海|广东|广州|深圳|江苏|浙江|山东|河北|河南|四川|福建|湖北|湖南|陕西|江西|安徽|辽宁|吉林|黑龙江|山西|云南|贵州|广西|甘肃|天津|重庆|内蒙古|新疆|宁夏|青海|海南|西藏|香港|澳门|台湾)/);
    const tagM = t.match(/(卖家信用[极优]?好|卖家信用优秀|百分百好评|发货极快|回复超快|秒发货|包邮)/);
    out.push({
      item_id: id,
      url: card.url,
      price: priceM ? parseFloat(priceM[1]) : null,
      wants: wantsM ? parseInt(wantsM[1], 10) : null,
      region: regionM ? regionM[1] : null,
      seller_tag: tagM ? tagM[1] : null,
      raw_text: t.slice(0, 400),
    });
  }
  return out;
})()`;

async function scrollAndCollect(browser, sessionId, minCards, maxCards) {
  let cards = [];
  let stagnant = 0;
  for (let i = 0; i < 14; i++) {
    await evaluate(browser, sessionId, 'window.scrollBy(0, Math.round(window.innerHeight*0.9)); true').catch(() => {});
    await sleep(1200);
    await waitIfCaptcha(browser, sessionId);
    const found = await evaluate(browser, sessionId, COLLECT_CARDS_JS).catch(() => []);
    if (Array.isArray(found)) {
      if (found.length <= cards.length) stagnant++;
      else stagnant = 0;
      cards = found;
    }
    if (cards.length >= maxCards) break;
    if (stagnant >= 3 && cards.length >= minCards) break;
    if (stagnant >= 5) break;
  }
  // 加序号
  cards = cards.slice(0, maxCards).map((c, idx) => ({ rank: idx + 1, ...c }));
  return cards;
}

// ------------------------------- 详情页采集 -------------------------------

const DETAIL_JS = `(() => {
  const flat = ((document.body && document.body.innerText) || '').replace(/\\s+/g, ' ');
  const PROV = ['北京','上海','广东','广州','深圳','江苏','浙江','山东','河北','河南','四川','福建','湖北','湖南','陕西','江西','安徽','辽宁','吉林','黑龙江','山西','云南','贵州','广西','甘肃','天津','重庆','内蒙古','新疆','宁夏','青海','海南','西藏','香港','澳门','台湾'];
  // 单品口径：以"举报"为锚，取其后一小段为本商品指标区，避开"看了又看/推荐位"里其它商品数字。
  // 形态："举报 ¥ 100 [- 1000] [包邮] [17人想要] 197浏览"（价格可为区间，包邮/想要均可缺）
  const rep = flat.indexOf('举报');
  const seg = rep >= 0 ? flat.slice(rep, rep + 130) : flat.slice(0, 220);
  const priceM = seg.match(/[¥￥]\\s*([0-9]+(?:\\.[0-9]+)?)(?:\\s*-\\s*([0-9]+(?:\\.[0-9]+)?))?/);
  const wantsM = seg.match(/([0-9,]+)\\s*人想要/);
  const viewsM = seg.match(/([0-9,]+)\\s*浏览/);
  const price = priceM ? parseFloat(priceM[1]) : null;
  const price_range = (priceM && priceM[2]) ? (priceM[1] + '-' + priceM[2]) : null;
  // 店铺口径（与单品口径严格分开）
  const soldM = flat.match(/卖出\\s*([0-9,]+)\\s*件宝贝/) || flat.match(/(?:累计出售|已售出?)\\s*([0-9,]+)/);
  const ratingM = flat.match(/好评率\\s*([0-9]{1,3})%/) || flat.match(/([0-9]{1,3})%\\s*好评/);
  const ageM = flat.match(/来闲鱼\\s*([0-9]+\\s*(?:年|个月|月|天))/);
  const activeM = flat.match(/(刚刚来过|刚刚擦亮|[0-9]+\\s*(?:分钟|小时|天|个月)前来过)/);
  // 卖家名/地区（尽力而为，非口径红线字段）：头部形如"…升级啦！ <卖家名> <地区> …"
  const head = flat.slice(0, 140);
  let sellerRegion = null, regionIdx = -1;
  for (const p of PROV) { const i = head.indexOf(p); if (i >= 0 && (regionIdx < 0 || i < regionIdx)) { regionIdx = i; sellerRegion = p; } }
  let sellerName = null;
  const nameAnchor = head.indexOf('升级啦！');
  if (nameAnchor >= 0 && regionIdx > nameAnchor) sellerName = head.slice(nameAnchor + 4, regionIdx).trim().slice(0, 30) || null;
  const title = (document.title || '').replace(/[_｜|].*$/, '').trim() ||
    (document.querySelector('h1,[class*="title" i]')?.innerText || '').trim();
  // 卖家店铺主页入口：详情页上卖家昵称/头像/"闲鱼号"均超链到
  //   https://www.goofish.com/personal?userId=<数字>。取第一条 personal?userId 链接。
  //   （实地取证 2026-08-27：item?id 详情页 DOM 里稳定存在该锚点）
  let shopUrl = null, shopUserId = null;
  for (const a of document.querySelectorAll('a[href*="personal?userId="]')) {
    const h = a.getAttribute('href') || '';
    const m = h.match(/personal\\?userId=(\\d+)/);
    if (m) { shopUserId = m[1]; shopUrl = 'https://www.goofish.com/personal?userId=' + m[1]; break; }
  }
  return {
    title: title.slice(0, 120),
    shop_url: shopUrl,
    shop_user_id: shopUserId,
    item_metrics: {          // 单品口径
      price, price_range,
      wants: wantsM ? parseInt(wantsM[1].replace(/,/g, ''), 10) : null,
      views: viewsM ? parseInt(viewsM[1].replace(/,/g, ''), 10) : null,
    },
    shop_metrics: {          // 店铺口径
      seller_name: sellerName,
      seller_region: sellerRegion,
      shop_sold_total: soldM ? parseInt(soldM[1].replace(/,/g, ''), 10) : null,
      shop_rating: ratingM ? (ratingM[1] + '%') : null,
      shop_age: ageM ? ('来闲鱼' + ageM[1].replace(/\\s/g, '')) : null,
      last_active: activeM ? activeM[1] : null,
    },
    raw_text: flat.slice(0, 600),
    url: location.href,
  };
})()`;

async function collectDetail(browser, sessionId, item, rank) {
  const url = `https://www.goofish.com/item?id=${item.item_id}`;
  await gotoAndSettle(browser, sessionId, url, 2500);
  await waitIfCaptcha(browser, sessionId);
  const d = await evaluate(browser, sessionId, DETAIL_JS).catch(() => null);
  if (!d) return { item_id: item.item_id, rank, source_url: url, error: '详情页解析失败' };
  return {
    item_id: item.item_id,
    rank,
    title: d.title || item.raw_text?.slice(0, 40),
    item_metrics: d.item_metrics,   // 单品口径：price / wants / views
    shop_metrics: d.shop_metrics,   // 店铺口径（详情页店铺栏）：已售 / 好评率 / 店龄（严格分开）
    shop_url: d.shop_url || null,   // 卖家店铺主页入口（personal?userId=…），可能为 null
    shop_user_id: d.shop_user_id || null,
    raw_text: d.raw_text,
    source_url: url,
    observed_at: new Date().toISOString(),
  };
}

// ------------------------------- 店铺主页采集 -------------------------------

// 店铺主页（personal?userId=…）口径：与单品口径严格分开。
// 实地取证（2026-08-27）该页稳定展示："在售N / 已售出 / 信用及评价 <分> /
// N粉丝 N关注 / 卖家昵称 / 地区 / 个性签名"。在售数以页内 item?id 链接去重计数兜底。
const SHOP_JS = `(() => {
  const flat = ((document.body && document.body.innerText) || '').replace(/\\s+/g, ' ');
  const grab1 = (re) => { const m = flat.match(re); return m ? m[1] : null; };
  const num = (s) => (s == null ? null : parseInt(String(s).replace(/,/g, ''), 10));
  // 在售数：优先文案"在售N"，否则用页内 item?id 链接去重计数兜底
  const onSaleIds = new Set();
  for (const a of document.querySelectorAll('a[href*="item?id="], a[href*="item.htm?id="]')) {
    const m = (a.getAttribute('href') || '').match(/id=(\\d+)/);
    if (m) onSaleIds.add(m[1]);
  }
  const onSaleText = num(grab1(/在售\\s*([0-9,]+)/));
  const soldTotal = num(grab1(/已售出\\s*([0-9,]+)/));           // 默认视图可能不带数字→null
  const creditScore = num(grab1(/信用及评价\\s*([0-9,]+)/));
  const followers = num(grab1(/([0-9,]+)\\s*粉丝/));
  const following = num(grab1(/([0-9,]+)\\s*关注/));
  const PROV = ['北京','上海','广东','广州','深圳','江苏','浙江','山东','河北','河南','四川','福建','湖北','湖南','陕西','江西','安徽','辽宁','吉林','黑龙江','山西','云南','贵州','贵州省','广西','甘肃','天津','重庆','内蒙古','新疆','宁夏','青海','海南','西藏','香港','澳门','台湾'];
  let region = null; const head = flat.slice(0, 160);
  for (const p of PROV) { if (head.includes(p)) { region = p; break; } }
  const sellerName = (document.title || '').replace(/[_｜|].*$/, '').trim().slice(0, 40) || null;
  return {
    on_sale_count: onSaleText != null ? onSaleText : (onSaleIds.size || null),
    on_sale_count_source: onSaleText != null ? '页面文案「在售N」' : '页内item链接去重计数',
    sold_total: soldTotal,           // 店铺累计已售出（默认视图常不带数字，记 null，不臆造）
    credit_review_score: creditScore, // 信用及评价综合分/条数
    followers, following,
    seller_name: sellerName,
    seller_region: region,
    raw_text: flat.slice(0, 500),
    url: location.href,
  };
})()`;

async function collectShop(browser, sessionId, shopUrl, rank) {
  if (!shopUrl) {
    return { skipped: true, reason: '详情页未取到店铺主页入口（personal?userId 链接缺失）' };
  }
  try {
    await gotoAndSettle(browser, sessionId, shopUrl, 2800);
    await waitIfCaptcha(browser, sessionId);
    const s = await evaluate(browser, sessionId, SHOP_JS).catch(() => null);
    return {
      url: shopUrl,
      shop_metrics: s ? {
        on_sale_count: s.on_sale_count,
        on_sale_count_source: s.on_sale_count_source,
        sold_total: s.sold_total,
        credit_review_score: s.credit_review_score,
        followers: s.followers,
        following: s.following,
        seller_name: s.seller_name,
        seller_region: s.seller_region,
      } : null,
      raw_text: s ? s.raw_text : null,
      observed_at: new Date().toISOString(),
    };
  } catch (e) {
    return { url: shopUrl, error: `店铺主页采集失败：${e.message}` };
  }
}

// ------------------------------- 截图前图片懒加载等待 -------------------------------

// 商品缩略图/详情图走懒加载：只静置固定毫秒数截图会截到"数字/标题都在、图区空白"。
// 这里逐屏滚到底触发懒加载请求，再滚回顶部，轮询等待页面内 <img> 全部
// complete && naturalWidth>0；设超时上限，超时也照常截图，但如实记录未加载张数，
// 绝不假装全部加载成功。
const IMAGE_STATUS_JS = `(() => {
  const imgs = Array.from(document.images || []);
  let loaded = 0;
  for (const img of imgs) {
    if (img.complete && img.naturalWidth > 0) loaded++;
  }
  return { total: imgs.length, loaded };
})()`;

const IMAGE_WAIT_MAX_MS = 15000;
const IMAGE_WAIT_POLL_MS = 500;

// 纯函数部分（供测试覆盖）：把「页内 img 总数/已加载数 + 耗时」整理成落盘字段。
// 与 CDP/DOM 无关，不读时钟以外的任何外部状态。
export function computeImageWaitResult(status, elapsedMs) {
  const total = (status && status.total) || 0;
  const loaded = (status && status.loaded) || 0;
  const unloaded = Math.max(0, total - loaded);
  return {
    images_total: total,
    images_loaded: loaded,
    images_unloaded: unloaded,
    images_wait_ms: elapsedMs,
  };
}

async function waitForImagesToLoad(browser, sessionId, maxMs = IMAGE_WAIT_MAX_MS) {
  const t0 = Date.now();
  // 逐屏滚到底触发懒加载（滚到底部不再前进即停，上限 20 屏）
  let lastY = -1;
  for (let i = 0; i < 20; i++) {
    const y = await evaluate(
      browser, sessionId,
      'window.scrollBy(0, Math.round(window.innerHeight*0.9)); Math.round(window.scrollY)'
    ).catch(() => null);
    if (y === null || y === lastY) break;
    lastY = y;
    await sleep(250);
  }
  // 滚回顶部：截图要从页面顶部开始
  await evaluate(browser, sessionId, 'window.scrollTo(0,0); true').catch(() => {});
  await sleep(300);

  // 轮询等待图片加载完成，直到全部加载或超时
  let status = { total: 0, loaded: 0 };
  while (Date.now() - t0 < maxMs) {
    status = await evaluate(browser, sessionId, IMAGE_STATUS_JS).catch(() => status);
    if (status.total === 0 || status.loaded >= status.total) break;
    await sleep(IMAGE_WAIT_POLL_MS);
  }
  return computeImageWaitResult(status, Date.now() - t0);
}

// ------------------------------- 截图前遮挡守卫 -------------------------------

// 第一步：尝试关闭"可关闭"的浮层（登录引导横幅、广告/引导浮层等）。
// 只点小尺寸的关闭按钮，避免误伤正文里的大块可点区域。
const CLOSE_OVERLAYS_JS = `(() => {
  const vis = (el) => {
    if (!el) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
    if (el.offsetParent === null && cs.position !== 'fixed') return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const closed = [];
  const sel = '[class*="close" i],[id*="close" i],[aria-label*="关闭"],[aria-label*="close" i],[class*="dismiss" i]';
  for (const btn of document.querySelectorAll(sel)) {
    if (!vis(btn)) continue;
    const r = btn.getBoundingClientRect();
    if (r.width > 80 || r.height > 80) continue; // 关闭按钮通常很小
    try {
      btn.click();
      closed.push(String(btn.className || btn.getAttribute('aria-label') || 'close').slice(0, 40));
    } catch {}
  }
  return { closed };
})()`;

// 第二步：检测仍然存在的"不可关闭"遮挡。判废标准 = 元素"真实可见 且 实际遮挡"，
// 而非"DOM 里存在该类名"。修复 2026-08-27 假阳性：登录容器（notLoginContainer 等）
// 常年挂在 DOM 里但隐藏/零尺寸/在视口外/被折叠，绝不能因类名存在就判废干净素材。
// 每个候选遮挡元素必须同时满足：
//   (a) 真实可见：offsetParent!==null（或 fixed）、display!==none、visibility 非 hidden/collapse、opacity>0.1；
//   (b) 实际遮挡：与视口有实质交叠，且交叠面积占视口 ≥ COVER_RATIO，或位于视口中央核心区（覆盖视口中心且 ≥ CENTER_RATIO）；
//   (c) 置顶层：自身或近祖先具有明确高 z-index（≥ Z_TOP 且非 static 定位）。
// 登录弹窗类同样走这套判定，不再因类名存在就判废。
const OCCLUSION_PROBE_JS = `(() => {
  const COVER_RATIO = 0.25;   // 占视口面积阈值
  const CENTER_RATIO = 0.06;  // 居中弹窗的较低面积阈值（覆盖视口中心时启用）
  const Z_TOP = 100;          // 置顶层 z-index 阈值
  const vw = window.innerWidth, vh = window.innerHeight;
  const viewportArea = Math.max(1, vw * vh);
  const cx = vw / 2, cy = vh / 2;
  // (a) 真实可见
  const isVisible = (el) => {
    if (!el) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return false;
    if (parseFloat(cs.opacity || '1') <= 0.1) return false;
    if (el.offsetParent === null && cs.position !== 'fixed') return false;
    return true;
  };
  // (c) 置顶层：自身或近祖先（≤6 跳）具明确高 z-index 且非 static
  const topZ = (el) => {
    let n = el, hops = 0;
    while (n && hops < 6) {
      const cs = getComputedStyle(n);
      const z = parseInt(cs.zIndex, 10);
      if (!Number.isNaN(z) && z >= Z_TOP && cs.position !== 'static') return z;
      n = n.parentElement; hops++;
    }
    return null;
  };
  // 综合判定：返回命中描述或 null
  const occ = (el) => {
    if (!isVisible(el)) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    // (b) 与视口实质交叠面积
    const ix = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
    const iy = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    const inter = ix * iy;
    if (inter <= 0) return null;               // 完全在视口外
    const ratio = inter / viewportArea;
    const coversCenter = r.left <= cx && r.right >= cx && r.top <= cy && r.bottom >= cy;
    if (!(ratio >= COVER_RATIO || (coversCenter && ratio >= CENTER_RATIO))) return null;
    const z = topZ(el);                        // (c) 必须在置顶层
    if (z === null) return null;
    return { ratio: +ratio.toFixed(3), coversCenter, z };
  };
  const remaining = [];
  const sel = '[class*="login" i],[id*="login" i],iframe[src*="login"],[class*="qrcode" i],'
    + '[class*="mask" i],[class*="overlay" i],[class*="modal" i],[class*="dialog" i]';
  for (const el of document.querySelectorAll(sel)) {
    const o = occ(el);
    if (o) {
      const tag = String(el.className || el.id || el.tagName || '').slice(0, 50);
      remaining.push(tag + ' (占视口' + Math.round(o.ratio * 100) + '%' + (o.coversCenter ? ',居中' : '') + ',z=' + o.z + ')');
      if (remaining.length >= 3) break;
    }
  }
  return { remaining: [...new Set(remaining)] };
})()`;

// 返回 { clean, remaining[], closed[] }。clean=false 表示存在不可关闭遮挡，图应判废。
async function screenshotGuard(browser, sessionId) {
  const closedRes = await evaluate(browser, sessionId, CLOSE_OVERLAYS_JS).catch(() => ({ closed: [] }));
  const closed = (closedRes && closedRes.closed) || [];
  if (closed.length) {
    log(`截图前已关闭可关闭浮层：${closed.join(', ')}`);
    await sleep(500); // 等关闭动画/DOM 更新
  }
  const occ = await evaluate(browser, sessionId, OCCLUSION_PROBE_JS).catch(() => ({ remaining: [] }));
  const remaining = (occ && occ.remaining) || [];
  return { clean: remaining.length === 0, remaining, closed };
}

// 详情页专用：定位"为你推荐"区块顶部的绝对 Y（getBoundingClientRect().top + scrollY）。
// 用于把详情页截图裁到商品信息区末尾之前，去掉下方一长条无关的"为你推荐"商品。
// 取"最靠上"的一处"为你推荐"锚点顶部为界；定位不到返回 null（上层回退整页）。
const FIND_RECOMMEND_TOP_JS = `(() => {
  const KEY = '为你推荐';
  let best = null;
  // 只看近叶子节点（自身文本≈锚点文案），避免命中包裹整段的大容器把界线抬到很高。
  for (const el of document.querySelectorAll('div,span,p,h1,h2,h3,h4,h5,section,header,strong,b')) {
    if (el.children.length > 3) continue;
    const txt = (el.textContent || '').trim();
    if (txt === KEY || (txt.length <= 10 && txt.includes(KEY))) {
      const r = el.getBoundingClientRect();
      const top = Math.round(r.top + window.scrollY);
      if (top > 0 && (best === null || top < best)) best = top;
    }
  }
  return { recommendTop: best };
})()`;

// ------------------------------- 截图落盘 -------------------------------

// opts.cropRecommend=true（仅详情页用）：把整页截图裁到"为你推荐"区块之前，
// 只保留商品信息区；定位不到"为你推荐"时回退整页，绝不报错。
async function captureFullPage(browser, sessionId, outPath, opts = {}) {
  // 截图前先等图片懒加载：逐屏滚到底触发请求、滚回顶部、轮询等 <img> 加载完成（有超时上限）。
  const imgStatus = await waitForImagesToLoad(browser, sessionId).catch(() => ({
    images_total: 0, images_loaded: 0, images_unloaded: 0, images_wait_ms: 0,
  }));
  if (imgStatus.images_unloaded > 0) {
    log(`[图片未加载] 等待 ${imgStatus.images_wait_ms}ms 后仍有 ${imgStatus.images_unloaded}/${imgStatus.images_total} 张图未加载完成，按超时上限继续截图`);
  }
  // 截图前遮挡守卫：先关可关闭浮层，再检不可关闭遮挡（登录弹窗/横幅/模态遮罩）。
  const guard = await screenshotGuard(browser, sessionId);
  if (!guard.clean) {
    log(`[遮挡告警] 检测到不可关闭遮挡，该图判废：${guard.remaining.join(' | ')}`);
  }
  // 取页面内容尺寸
  let contentSize = null;
  try {
    const metrics = await browser.send('Page.getLayoutMetrics', {}, sessionId);
    contentSize = (metrics.cssContentSize || metrics.contentSize);
  } catch { /* ignore */ }

  const MAX_H = 20000; // 过长页面保护阈值
  let data, meta = {};
  const pageW = contentSize ? Math.round(contentSize.width) : VIEWPORT.width;
  const pageH = contentSize ? Math.round(contentSize.height) : VIEWPORT.height;

  // 详情页裁剪：定位"为你推荐"顶部 Y，用 clip 只截其上方的商品信息区（比截全页再裁更省）。
  let recommendTop = null;
  if (opts.cropRecommend) {
    try {
      const probe = await evaluate(browser, sessionId, FIND_RECOMMEND_TOP_JS);
      recommendTop = probe && probe.recommendTop;
    } catch { recommendTop = null; }
  }

  if (opts.cropRecommend && recommendTop && recommendTop > 200 && recommendTop < pageH) {
    // 裁到"为你推荐"之前。captureBeyondViewport 让 clip 可越过视口高度取到完整商品信息区。
    const shot = await browser.send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true, fromSurface: true,
      clip: { x: 0, y: 0, width: pageW, height: recommendTop, scale: 1 },
    }, sessionId);
    data = shot.data;
    meta = {
      mode: 'detail_cropped', width: pageW, height: recommendTop,
      full_height: pageH, recommend_top: recommendTop,
      note: `已裁到"为你推荐"之前（整页高 ${pageH}px → 商品信息区 ${recommendTop}px）`,
    };
  } else if (contentSize && contentSize.height > MAX_H) {
    // 过长：截可视区（整页会超出编码上限），记录说明
    const shot = await browser.send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: false,
    }, sessionId);
    data = shot.data;
    meta = { mode: 'viewport_only', note: `页面高 ${Math.round(contentSize.height)}px 超阈值，仅截可视区`, ...VIEWPORT };
    if (opts.cropRecommend) meta.note += '（未定位到"为你推荐"，回退）';
  } else {
    const shot = await browser.send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true, fromSurface: true,
    }, sessionId);
    data = shot.data;
    meta = {
      mode: opts.cropRecommend ? 'full_page_fallback' : 'full_page',
      width: pageW, height: pageH,
    };
    if (opts.cropRecommend) meta.note = '未定位到"为你推荐"，回退整页';
  }
  const buf = Buffer.from(data, 'base64');
  writeFileSync(outPath, buf);
  const sha256 = createHash('sha256').update(buf).digest('hex');
  // 遮挡结果并入 meta：不可关闭遮挡则 occluded=true（该图判废，绝不静默当合格图交付）。
  return {
    bytes: buf.length, sha256, ...meta,
    occluded: !guard.clean,
    occlusions: guard.remaining,
    closed_overlays: guard.closed,
    ...imgStatus,
  };
}

// ------------------------------- 优雅关闭采集 Chrome -------------------------------

// 根因2 修复：Chrome 仅在"正常退出"时把 cookie 落盘；硬杀会丢掉刚扫码的登录，
// 导致下次又要重扫。采集结束通过 CDP Browser.close 让 Chrome flush 后自行退出，
// 只有优雅关闭失败时才回退到进程 kill。
async function gracefulCloseChrome(browser, port) {
  try {
    // 发 Browser.close：Chrome flush 落盘后自行退出（这会顺带断开本 ws）。
    browser.send('Browser.close', {}).catch(() => {});
  } catch { /* ignore */ }
  // 轮询等待调试端口消失，最长 ~6s
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    await sleep(400);
    const up = await isDebuggerUp(port);
    if (!up) {
      log('采集 Chrome 已优雅退出（cookie 已落盘）');
      return true;
    }
  }
  // 回退：仅杀"本采集 profile"的 chrome 进程，绝不碰用户其它 Chrome
  log('[告警] 优雅关闭超时，回退到定向 kill（仅限采集 profile 进程）');
  try {
    const psScript =
      "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | " +
      "Where-Object { $_.CommandLine -like '*collect-chrome-profile*' } | " +
      "ForEach-Object { Stop-Process -Id $_.ProcessId -Force }";
    execSync(`powershell.exe -NoProfile -Command "${psScript.replace(/"/g, '\\"')}"`,
      { stdio: 'ignore' });
  } catch { /* ignore */ }
  return false;
}

// ------------------------------- 关键词自动切分兜底 -------------------------------

// 平台/系统前后缀词（通用，不写死行业）：从查询词剥掉这些边角料得到"核心词"。
const AFFIX_WORDS = [
  'mac', 'macos', 'windows', 'win', 'linux', 'ios', 'android', '安卓', '苹果',
  'pc', '电脑', '台式', '笔记本', '手机', '平板', '官方', '正版', '国行', '全新',
  '二手', '出售', '转让', '低价', '包邮', '代购', '账号', '会员', '版',
];

// 从原词剥掉平台/系统前后缀，得到核心词（如"mac微信多开"→"微信多开"）。
function stripAffix(q) {
  let s = q.trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const a of AFFIX_WORDS) {
      const la = a.toLowerCase();
      if (s.length > a.length && s.toLowerCase().startsWith(la)) { s = s.slice(a.length).trim(); changed = true; }
      if (s.length > a.length && s.toLowerCase().endsWith(la)) { s = s.slice(0, s.length - a.length).trim(); changed = true; }
    }
  }
  return s;
}

// 用 jieba（segment.py，仓库 .venv 已装）对原词分词，取 n/v/a 实词。python/jieba
// 不可用时返回 []（上层只用启发式候选，不报错）。
function jiebaTokens(q) {
  if (!existsSync(SEGMENT_PY)) return [];
  const candidates = [];
  if (process.env.PYTHON) candidates.push(process.env.PYTHON);
  const venvPy = path.resolve('.venv', 'Scripts', 'python.exe');
  if (existsSync(venvPy)) candidates.push(venvPy);
  candidates.push('python', 'py', 'python3');
  for (const bin of candidates) {
    const res = spawnSync(bin, [SEGMENT_PY], { input: Buffer.from(q, 'utf8'), maxBuffer: 8 * 1024 * 1024 });
    if (res.error) continue;
    if (res.status !== 0) return [];
    const out = (res.stdout ? res.stdout.toString('utf8') : '').trim();
    if (!out) return [];
    return out.split('\n').map((line) => {
      const tab = line.indexOf('\t');
      return tab < 0 ? line : line.slice(0, tab);
    }).filter(Boolean);
  }
  return [];
}

// 生成候选词，按"更短更核心"排序。规则：
//   (a) 剥平台/系统前后缀后的核心；(b) jieba 实词的相邻组合与单词；
//   排序偏向更短。已去重、去掉与原词相同或过短(<2字)者。
function generateFallbackQueries(original) {
  const orig = original.trim();
  const cands = [];
  const push = (w) => {
    const s = (w || '').trim();
    if (s && s !== orig && [...s].length >= 2 && !cands.includes(s)) cands.push(s);
  };
  // (a) 剥前后缀核心
  push(stripAffix(orig));
  // (b) jieba 实词：相邻两词组合 + 单词
  const toks = jiebaTokens(orig);
  for (let i = 0; i + 1 < toks.length; i++) push(toks[i] + toks[i + 1]);
  for (const t of toks) push(t);
  // 剥前后缀后再对核心分词（覆盖"mac微信多开"→"微信多开"→微信/多开）
  const core = stripAffix(orig);
  if (core && core !== orig) {
    const coreToks = jiebaTokens(core);
    for (let i = 0; i + 1 < coreToks.length; i++) push(coreToks[i] + coreToks[i + 1]);
    for (const t of coreToks) push(t);
  }
  // 排序：更短更核心优先（长度升序；等长保持插入序）
  return cands
    .map((w, i) => ({ w, len: [...w].length, i }))
    .sort((a, b) => a.len - b.len || a.i - b.i)
    .map((x) => x.w);
}

// 用一个查询词跑一次"搜索页 → 判无结果 → 滚动采集卡片"。skipNav=true 复用当前已加载页。
// 返回 { query, searchUrl, noResults, cards, wantsCount }。
async function attemptQuery(browser, sessionId, query, args, skipNav) {
  const searchUrl = `https://www.goofish.com/search?q=${encodeURIComponent(query)}`;
  if (!skipNav) {
    await gotoAndSettle(browser, sessionId, searchUrl, 3000);
    await waitIfCaptcha(browser, sessionId);
  }
  const sig = await evaluate(browser, sessionId, LOGIN_PROBE_JS).catch(() => ({ noResults: false }));
  if (sig && sig.noResults) {
    return { query, searchUrl, noResults: true, cards: [], wantsCount: 0 };
  }
  const cards = await scrollAndCollect(browser, sessionId, args.minCards, args.maxCards);
  const wantsCount = cards.filter((c) => c.wants != null).length;
  return { query, searchUrl, noResults: false, cards, wantsCount };
}

// ------------------------------- 主流程 -------------------------------

async function main() {
  const t0 = Date.now();
  const args = parseArgs(process.argv.slice(2));
  const port = args.port || DEBUG_PORT;
  const outDir = path.resolve(args.out);
  const shotDir = path.join(outDir, 'screenshots');
  mkdirSync(shotDir, { recursive: true });

  const searchUrl = `https://www.goofish.com/search?q=${encodeURIComponent(args.query)}`;
  log(`选题词：「${args.query}」`);
  log(`产物目录：${outDir}`);

  // 1) 启动/复用采集 Chrome
  const version = await ensureChrome(port);

  // 2) 连接 browser 级 WebSocket
  const bws = await connectWs(version.webSocketDebuggerUrl);
  const browser = new CDP(bws);

  const screenshots = [];
  let searchCards = [];
  const details = [];
  let status = 'ok';
  let statusNote = '';
  // 关键词切分兜底的溯源字段
  let queryUsed = args.query;
  const queryOriginal = args.query;
  let queryFallbackTried = [];
  let searchUrlUsed = searchUrl;

  try {
    // 3) 新建受控页面并打开搜索页
    const page = await newPage(browser);
    log('打开搜索结果页…');
    await gotoAndSettle(browser, page.sessionId, searchUrl, 3000);

    // 4) 登录态检测 + 等待
    await waitIfCaptcha(browser, page.sessionId);
    const loginSig = await waitForLogin(browser, page.sessionId);

    // 5) 关键词切分兜底：主词无结果 / 有想要数的商品不足时，降级尝试更短候选词，
    //    用第一个"出结果且想要卡充足(≥MIN_WANTS_CARDS)"的词继续全流程。
    // --no-fallback：小众/精准词强制只用原词（兜底切词对niche词会切到泛词垃圾，宁少而准）。
    const candidateQueries = args.noFallback
      ? [args.query]
      : [args.query, ...generateFallbackQueries(args.query)];
    if (candidateQueries.length > 1) {
      log(`候选词（含原词）：${candidateQueries.map((q) => `「${q}」`).join(' → ')}`);
    }
    const attempts = [];
    for (let ci = 0; ci < candidateQueries.length; ci++) {
      const q = candidateQueries[ci];
      if (ci > 0) log(`原词结果不足，改试候选词「${q}」…`);
      const attempt = await attemptQuery(browser, page.sessionId, q, args, ci === 0);
      attempts.push(attempt);
      const why = attempt.noResults ? '无搜索结果' : `采到 ${attempt.cards.length} 条、其中想要卡 ${attempt.wantsCount} 条`;
      log(`「${q}」：${why}`);
      if (!attempt.noResults && attempt.wantsCount >= MIN_WANTS_CARDS) break; // 命中即止
    }
    // 选词：优先第一个达标词；都不达标时取"想要卡最多、卡片最多"的尽力词；全无结果才判 no_results。
    let chosen = attempts.find((a) => !a.noResults && a.wantsCount >= MIN_WANTS_CARDS) || null;
    if (!chosen) {
      const withCards = attempts.filter((a) => a.cards.length > 0)
        .sort((a, b) => (b.wantsCount - a.wantsCount) || (b.cards.length - a.cards.length));
      if (withCards.length) chosen = withCards[0];
    }
    queryFallbackTried = attempts
      .filter((a) => a !== chosen)
      .map((a) => ({ query: a.query, no_results: a.noResults, cards: a.cards.length, wants_cards: a.wantsCount }));

    if (!chosen) {
      // 原词及所有切分候选词均无搜索结果：绝不把"猜你喜欢"推荐当结果采集
      queryUsed = args.query;
      status = 'no_results';
      const triedTxt = queryFallbackTried.length ? `及 ${queryFallbackTried.length} 个切分候选词（${queryFallbackTried.map((t) => t.query).join('、')}）` : '';
      statusNote = `已登录，但「${args.query}」${triedTxt}在闲鱼均无搜索结果（"没有找到你想要的宝贝"，页面为猜你喜欢推荐填充）。未采集任何商品，仅存原词无结果页截图为证。`;
      log(statusNote);
      // 回到原词无结果页存证
      await gotoAndSettle(browser, page.sessionId, searchUrl, 2000).catch(() => {});
      await evaluate(browser, page.sessionId, 'window.scrollTo(0,0); true').catch(() => {});
      await sleep(600);
      const p = path.join(shotDir, '01-无结果页.png');
      const s = await withRetry(() => captureFullPage(browser, page.sessionId, p), '无结果页截图');
      screenshots.push({
        id: '01-无结果页', type: 'no_results',
        file: 'screenshots/01-无结果页.png', source_url: searchUrl,
        captured_at: new Date().toISOString(), ...s,
      });
      log(`截图已落盘：01-无结果页.png（${s.bytes} 字节）— 存证无结果，未采集商品`);
    } else {
    queryUsed = chosen.query;
    searchUrlUsed = chosen.searchUrl;
    searchCards = chosen.cards;
    if (queryUsed !== args.query) {
      log(`原词「${args.query}」结果不足，改用「${queryUsed}」采集全流程（想要卡 ${chosen.wantsCount} 条）`);
    }
    // 若当前页不是选定词的结果页（尽力词场景），重新导航并刷新卡片，保证截图完整。
    const currentQuery = attempts.length ? attempts[attempts.length - 1].query : args.query;
    if (chosen.query !== currentQuery) {
      await gotoAndSettle(browser, page.sessionId, chosen.searchUrl, 3000);
      await waitIfCaptcha(browser, page.sessionId);
      searchCards = await scrollAndCollect(browser, page.sessionId, args.minCards, args.maxCards);
    }
    log(`搜索页采集到 ${searchCards.length} 条（用词「${queryUsed}」）`);

    // 回到顶部再截搜索结果页
    await evaluate(browser, page.sessionId, 'window.scrollTo(0,0); true').catch(() => {});
    await sleep(800);
    const searchShotPath = path.join(shotDir, '01-搜索结果页.png');
    const s1 = await withRetry(
      () => captureFullPage(browser, page.sessionId, searchShotPath), '搜索页截图'
    );
    screenshots.push({
      id: '01-搜索结果页', type: 'search_results',
      file: 'screenshots/01-搜索结果页.png', source_url: searchUrlUsed,
      captured_at: new Date().toISOString(), ...s1,
    });
    log(`截图已落盘：01-搜索结果页.png（${s1.bytes} 字节，${s1.mode}）`);

    // 6) 只看第一页，按想要数降序取 Top N（不翻页、无硬门槛）
    const ranked = [...searchCards]
      .filter((c) => c.wants != null)
      .sort((a, b) => (b.wants || 0) - (a.wants || 0));
    const topList = (ranked.length ? ranked : searchCards).slice(0, args.top);
    log(`第一页按想要数降序取 Top${topList.length} 进详情`);

    for (let i = 0; i < topList.length; i++) {
      const item = topList[i];
      const rank = i + 1;
      log(`Top${rank} 详情：item=${item.item_id}（想要 ${item.wants ?? '未显示'}）`);
      const d = await withRetry(
        () => collectDetail(browser, page.sessionId, item, rank), `Top${rank} 详情`
      );
      details.push(d);
      const name = `0${rank + 1}-Top${rank}详情.png`;
      const shotPath = path.join(shotDir, name);
      const sN = await withRetry(
        () => captureFullPage(browser, page.sessionId, shotPath, { cropRecommend: true }), `Top${rank} 详情截图`
      );
      screenshots.push({
        id: name.replace('.png', ''), type: 'product_detail',
        file: `screenshots/${name}`, source_url: d.source_url,
        item_id: item.item_id, captured_at: new Date().toISOString(), ...sN,
      });
      log(`截图已落盘：${name}（${sN.bytes} 字节，${sN.mode}）`);

      // 6b) 证据链延伸到卖家店铺主页：进 personal?userId 页 → 整页截图 → 存店铺级数据
      const shop = await withRetry(
        () => collectShop(browser, page.sessionId, d.shop_url, rank), `Top${rank} 店铺主页`
      );
      if (shop && shop.url && !shop.error) {
        const shopName = `0${rank + 4}-Top${rank}店铺.png`; // 编号接在详情之后：05/06/07
        const shopPath = path.join(shotDir, shopName);
        const sS = await withRetry(
          () => captureFullPage(browser, page.sessionId, shopPath), `Top${rank} 店铺截图`
        );
        screenshots.push({
          id: shopName.replace('.png', ''), type: 'shop_page',
          file: `screenshots/${shopName}`, source_url: shop.url,
          item_id: item.item_id, captured_at: new Date().toISOString(), ...sS,
        });
        shop.screenshot = `screenshots/${shopName}`;
        log(`截图已落盘：${shopName}（${sS.bytes} 字节，${sS.mode}）— 卖家店铺主页`);
      } else {
        log(`Top${rank} 店铺主页跳过：${(shop && (shop.reason || shop.error)) || '未知原因'}`);
      }
      // 把店铺主页证据挂到该条详情证据上（口径严格分开：shop_page 内部为店铺口径）
      d.shop_page = shop;
    }
    }

    // 关闭受控页面
    await browser.send('Target.closeTarget', { targetId: page.targetId }).catch(() => {});
  } catch (e) {
    if (e.message === 'LOGIN_TIMEOUT') {
      status = 'blocked_login';
      statusNote = '登录门未通过：5 分钟内未检测到登录成功。采集专用 Chrome 已开在登录页，窗口保留，等用户扫码后重跑。';
    } else if (e.message === 'CAPTCHA_TIMEOUT') {
      status = 'blocked_captcha';
      statusNote = '人机验证未通过：5 分钟内未完成滑块/验证码。窗口保留，等用户人工完成后重跑。';
    } else {
      status = 'error';
      statusNote = e.message;
    }
    log(`采集中止：${statusNote}`);
  }

  // 7) 写 manifest.json
  // 每张截图打状态标记：occluded=true → scrapped（污染判废），否则 ok。
  const labeledShots = screenshots.map((s) => ({
    ...s,
    status: s.occluded ? 'scrapped' : 'ok',
  }));
  const scrappedShots = labeledShots.filter((s) => s.occluded);
  // 只要有一张判废，整体不得声明 verified —— 绝不静默交付污染产物。
  const manifestStatus = screenshots.length
    ? (scrappedShots.length ? 'contaminated' : 'verified')
    : status;
  const manifest = {
    status: manifestStatus,
    query: args.query,
    total_screenshots: labeledShots.length,
    scrapped_count: scrappedShots.length,
    scrapped: scrappedShots.map((s) => ({ id: s.id, file: s.file, occlusions: s.occlusions })),
    screenshots: labeledShots,
    generated_at: new Date().toISOString(),
  };
  writeFileSync(path.join(shotDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  if (scrappedShots.length) {
    log(`[遮挡告警] 共 ${scrappedShots.length} 张截图判废（污染），manifest.status=contaminated`);
  }

  // 8) 写 capture.json（沿用 v1.2 schema）
  const capture = {
    schema_version: SCHEMA_VERSION,
    source: 'collect_chrome_goofish_cdp',
    query: args.query,
    query_original: queryOriginal,          // 用户输入的原始搜索词
    query_used: queryUsed,                    // 实际用于采集全流程的词（可能被切分兜底替换）
    query_fallback_tried: queryFallbackTried, // 被否决的候选词及其结果（原词若被替换也在此）
    source_url: searchUrlUsed,
    captured_at: new Date().toISOString(),
    status,
    status_note: statusNote || undefined,
    capture_scope: `search list page 1 (${searchCards.length} cards) + Top${details.length} detail pages + ${screenshots.filter((s) => s.type === 'shop_page').length} shop homepages`,
    notes_field_semantics: {
      query_used: '实际用于采集的词；若与 query_original 不同，说明原词结果不足被切分兜底替换',
      query_fallback_tried: '尝试过但被否决的候选词（含无结果/想要卡不足的记录）',
      wants: '单品数据：X人想要',
      views: '单品数据：详情页浏览量',
      shop_sold: '店铺数据：店铺累计卖出件数（非本单销量）',
      shop_rating: '店铺数据：好评率',
      shop_age: '店铺数据：来闲鱼时长（店龄）',
      wants_null: '该卡未显示人想要数字，记为 null',
      'shop_page.url': '店铺证据：卖家店铺主页 URL（personal?userId=…）',
      'shop_page.screenshot': '店铺证据：店铺主页整页截图文件名',
      'shop_page.shop_metrics.on_sale_count': '店铺数据：店铺主页在售商品数（店铺口径，非单品）',
      'shop_page.shop_metrics.sold_total': '店铺数据：店铺累计已售出（默认视图常缺→null，不臆造）',
      'shop_page.shop_metrics.credit_review_score': '店铺数据：信用及评价综合分/条数',
      'shop_page.shop_metrics.followers': '店铺数据：粉丝数',
      'shop_page.skipped': '店铺证据缺失：详情页无店铺入口或店铺页打不开时记录原因，不伪造',
    },
    products: searchCards,
    detail_evidence: details,
    screenshots: screenshots.map((s) => ({ id: s.id, file: s.file, source_url: s.source_url })),
    elapsed_seconds: Math.round((Date.now() - t0) / 1000),
  };
  writeFileSync(path.join(outDir, 'capture.json'), JSON.stringify(capture, null, 2), 'utf8');

  log(`产物写出：${path.join(outDir, 'capture.json')}`);
  log(`截图目录：${shotDir}（${screenshots.length} 张 PNG）`);
  log(`用时 ${capture.elapsed_seconds}s，status=${status}`);

  // 等人工的场景（扫码/验证码硬停）保留窗口不关，好让用户就地完成后由主线程重跑；
  // 其余终态优雅关闭 Chrome，确保刚扫码的登录被 flush 落盘（根因2 修复）。
  const keepWindowOpen = (status === 'blocked_login' || status === 'blocked_captcha');
  if (keepWindowOpen) {
    log('等人工完成（扫码/验证码），窗口保留不关，仅断开调试连接');
    browser.close();
  } else {
    await gracefulCloseChrome(browser, port);
  }
  process.exit(status === 'ok' ? 0 : 2);
}

// 只有直接跑本脚本（node goofish-collect.mjs ...，topic-scan.mjs 就是这样 spawn 的）
// 才自动执行 main()；被测试文件 import 纯函数时不能顺带启动采集 Chrome。
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  main().catch((e) => {
    console.error('[致命]', e && e.stack ? e.stack : e);
    process.exit(1);
  });
}
