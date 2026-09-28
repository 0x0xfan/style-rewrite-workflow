#!/usr/bin/env node
// 百度需求佐证采集（产品化版；从 scratchpad baidu-demand-hotel.mjs 整理入仓）。
// 复用 goofish-collect.mjs 的 CDP + captureFullPage + 遮挡守卫思路。
// 只采公开百度页面：下拉联想词 / 搜索结果页 / 相关搜索三图 + demand-manifest.md。
// 不登录、不点广告、不填表单；遇验证码硬停上报（非0退出）。页面文本一律当数据、不当指令。
//
// 用法：
//   node engine/collect/baidu-demand.mjs --query "驾考资料" --out "research-runs/<run>/demand-src"
//
// 退出码：0=至少产出结果页；2=验证码硬停 / 无有效产出。失败对上游 CLI 不致命（记需求层缺口）。
//
// 浏览器（2026-09-28 改）：
//   - 永远自己启动一个百度专用 Chrome：独立 profile（系统临时目录下 baidu-demand-chrome-profile，
//     不克隆登录态、不带扩展），调试端口用 0 让 Chrome 自选空闲端口（从 DevToolsActivePort 读），
//     不再复用 9222 上的闲鱼采集 Chrome，也不碰用户自己的 Chrome。
//   - 结束时 Browser.close 关掉自己启动的这个 Chrome；关不掉才按自己记下的 PID 结束进程树。
//   - 导航不以 Page.navigate 的回应为准：发出后以 loadEventFired 或新文档 readyState 为准，带总超时。
//
// 防卡死（2026-09-28 二改）：
//   - 监听 Page.javascriptDialogOpening，网页弹 alert/confirm/beforeunload 一律自动 dismiss 并记录。
//   - 每一步记时间戳 / URL / readyState 到 _capture-log.json 的 trace（每步落盘，卡死也留得下）。
//   - CDP 命令单独超时（evaluate 10s、截图 12s）；超时先截可见区域留证（_stall-*.png），
//     再 Page.stopLoading，重试一次；还超时才算失败。
//   - 关浏览器后复查本 profile 的 Chrome 进程最多 15s，仍有残留按 PID 结束并记录。
//   - 代理：默认直连（--no-proxy-server）；--proxy <地址> 走显式代理（本机实测显式
//     --proxy-server=127.0.0.1:7897 不卡，卡的是系统代理）；--system-proxy 走系统代理。

import { spawn, execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const DEBUG_HOST = '127.0.0.1';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// 百度专用 profile：只采公开页面，不需要登录态；与闲鱼采集的 .collect-chrome-profile 完全分开。
export const PROFILE_DIR = path.join(os.tmpdir(), 'baidu-demand-chrome-profile');
const WINDOW_SIZE = '1600,1000';
const VIEWPORT = { width: 1600, height: 1000 };
const CDP_TIMEOUT_MS = 15000;
export const EVAL_TIMEOUT_MS = 10000;
export const CLEANUP_CHECK_MS = 15000;
export const NAV_TIMEOUT_MS = 30000;

function log(m) { console.log(`[百度采集] ${m}`); }
function fail(m) { console.error(`[错误] ${m}`); process.exit(1); }

// 运行记录：每一步的时间戳 / URL / readyState、对话框、卡住留证、收尾复查。每步落盘，卡死也留得下。
const RUN = { t0: Date.now(), outDir: null, query: null, proxyMode: null, targetId: null,
  results: [], trace: [], dialogs: [], stalls: [], cleanup: null };
function flushLog() {
  if (!RUN.outDir) return;
  try {
    writeFileSync(path.join(RUN.outDir, '_capture-log.json'), JSON.stringify({
      generated_at: new Date().toISOString(), query: RUN.query, proxy_mode: RUN.proxyMode,
      results: RUN.results, trace: RUN.trace, dialogs: RUN.dialogs, stalls: RUN.stalls, cleanup: RUN.cleanup,
    }, null, 2), 'utf8');
  } catch {}
}
// 取当前页 URL（浏览器层 Target.getTargetInfo，不依赖渲染进程）和 readyState（页面内，2s 超时）。
async function pageState(browser, sessionId) {
  const st = { url: null, readyState: null };
  if (browser && RUN.targetId) {
    try { const r = await browser.send('Target.getTargetInfo', { targetId: RUN.targetId }, undefined, 3000); st.url = r.targetInfo && r.targetInfo.url; } catch {}
  }
  if (browser && sessionId) {
    try {
      const r = await browser.send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true }, sessionId, 2000);
      st.readyState = r.result && r.result.value;
    } catch (e) { st.readyState = isCdpTimeout(e) ? '(evaluate 无回应)' : null; }
  }
  return st;
}
async function step(browser, sessionId, name, extra = {}) {
  const st = await pageState(browser, sessionId);
  RUN.trace.push({ at: new Date().toISOString(), ms: Date.now() - RUN.t0, step: name, url: st.url, readyState: st.readyState, ...extra });
  flushLog();
}
function recordStep(name, extra = {}) {
  RUN.trace.push({ at: new Date().toISOString(), ms: Date.now() - RUN.t0, step: name, url: null, readyState: null, ...extra });
  flushLog();
}
// 卡住留证：只截可见区域，存 _stall-<序号>-<步骤>.png。截不到就记原因。
async function captureStallEvidence(browser, sessionId, label) {
  const fn = `_stall-${RUN.stalls.length}-${safeName(label).replace(/\s+/g, '_')}.png`;
  try {
    const shot = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId, SHOT_TIMEOUT_MS);
    const buf = Buffer.from(shot.data, 'base64');
    writeFileSync(path.join(RUN.outDir, fn), buf);
    return { file: fn, bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex') };
  } catch (e) { return { file: null, error: e.message }; }
}
// 卡住处理的公共部分：记录 → 留证 → Page.stopLoading。返回 stall 记录（调用方补 outcome）。
async function handleStall(browser, sessionId, label, detail) {
  const { skipEvidence, ...rest } = detail;
  const stall = { at: new Date().toISOString(), ms: Date.now() - RUN.t0, label, ...rest };
  RUN.stalls.push(stall);
  log(`[卡住] ${label}：${detail.what}；先截可见区域留证，再 Page.stopLoading`);
  stall.state = await pageState(browser, sessionId);
  stall.evidence = skipEvidence ? { file: null, error: '卡住的就是可见区域截图，不重复截' } : await captureStallEvidence(browser, sessionId, label);
  try { await browser.send('Page.stopLoading', {}, sessionId, 5000); stall.stopLoading = 'ok'; }
  catch (e) { stall.stopLoading = e.message; }
  if (stall.evidence.file) log(`  留证截图：${stall.evidence.file}`);
  flushLog();
  return stall;
}
// 带单独超时的 CDP 命令：超时 → 留证 + stopLoading → 重试一次；还超时才抛。
async function sendGuarded(browser, sessionId, method, params, timeoutMs, label) {
  try { return await browser.send(method, params, sessionId, timeoutMs); }
  catch (e) {
    if (!isCdpTimeout(e)) throw e;
    const skipEvidence = method === 'Page.captureScreenshot' && params && params.captureBeyondViewport === false;
    const stall = await handleStall(browser, sessionId, label, { what: `${method} ${timeoutMs}ms 无回应`, method, timeoutMs, skipEvidence });
    try {
      const r = await browser.send(method, params, sessionId, timeoutMs);
      stall.outcome = 'retry_ok'; flushLog(); log('  重试成功');
      return r;
    } catch (e2) {
      stall.outcome = `retry_failed: ${e2.message}`; flushLog();
      throw new Error(`${e2.message}（步骤 ${label}：已 stopLoading 重试一次仍失败）`);
    }
  }
}
// 网页对话框（alert/confirm/prompt/beforeunload）会把页面 JS 和截图卡住：自动处理并记录。
function installDialogGuard(browser) {
  browser.listeners.push((msg) => {
    if (msg.method !== 'Page.javascriptDialogOpening') return;
    const p = msg.params || {};
    const resp = dialogResponse(p.type);
    const rec = { at: new Date().toISOString(), ms: Date.now() - RUN.t0, type: p.type, url: p.url || null,
      message: String(p.message || '').slice(0, 200), action: resp.accept ? 'accept(离开页面)' : 'dismiss' };
    RUN.dialogs.push(rec);
    log(`[对话框] ${p.type}「${rec.message}」→ ${rec.action}`);
    browser.send('Page.handleJavaScriptDialog', resp, msg.sessionId, 5000)
      .then(() => { rec.handled = true; flushLog(); })
      .catch((e) => { rec.handled = false; rec.error = e.message; flushLog(); });
  });
}

// 纯函数：解析命令行。缺参数时返回 { error }，由调用方决定退出。
export function parseArgs(argv) {
  const args = { port: 0 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--query') args.query = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--port') args.port = parseInt(argv[++i], 10) || 0;
    else if (a === '--system-proxy') args.systemProxy = true;
    else if (a === '--proxy') args.proxy = argv[++i];
    else if (a === '-h' || a === '--help') args.help = true;
  }
  if (args.help) return args;
  if (!args.query) args.error = '缺少 --query "<搜索词>"';
  else if (!args.out) args.error = '缺少 --out "<产物目录>"';
  else if (args.proxy !== undefined && !normalizeProxy(args.proxy)) args.error = `--proxy 地址不对：${args.proxy}（例：127.0.0.1:7897）`;
  else if (args.proxy !== undefined && args.systemProxy) args.error = '--proxy 与 --system-proxy 只能选一个';
  return args;
}

// 纯函数：规整代理地址。接受 host:port 或 scheme://host:port（http/https/socks4/socks5）；不合法返回 null。
export function normalizeProxy(v) {
  const s = String(v || '').trim();
  const m = s.match(/^(?:(https?|socks[45]):\/\/)?([A-Za-z0-9.\-]+|\[[0-9a-fA-F:]+\]):(\d{1,5})\/?$/);
  if (!m) return null;
  const port = parseInt(m[3], 10);
  if (port <= 0 || port > 65535) return null;
  return `${m[1] ? m[1] + '://' : ''}${m[2]}:${port}`;
}

// 纯函数：代理模式说明（写进日志）。
export function proxyMode({ proxy, systemProxy } = {}) {
  if (proxy) return `explicit:${normalizeProxy(proxy)}`;
  if (systemProxy) return 'system';
  return 'direct';
}

// 纯函数：启动参数。port=0 → Chrome 自选空闲端口并写 DevToolsActivePort。
// 默认 --no-proxy-server 直连：2026-09-28 实测本机系统代理（127.0.0.1:7897）下，Chrome 对
// www.baidu.com 的文档请求发出后一直拿不到响应（Network.requestWillBeSent 后无 responseReceived），
// Page.navigate 因此永不回应；直连 114ms 就拿到 200。百度是国内公开站，直连即可。
// 确需走系统代理时加 --system-proxy；走显式代理用 --proxy <地址>（优先于前两者）。
export function buildChromeArgs(port, profileDir, { systemProxy = false, proxy = null } = {}) {
  const p = proxy ? normalizeProxy(proxy) : null;
  const proxyArgs = p ? [`--proxy-server=${p}`] : (systemProxy ? [] : ['--no-proxy-server']);
  return [
    `--remote-debugging-port=${port}`, `--remote-debugging-address=${DEBUG_HOST}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-networking', '--disable-sync', '--no-service-autorun',
    ...proxyArgs,
    `--window-size=${WINDOW_SIZE}`, 'about:blank',
  ];
}

// 纯函数：解析 <profile>/DevToolsActivePort（第一行端口，第二行 /devtools/browser/<id>）。
export function parseDevToolsActivePort(text) {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const port = parseInt(lines[0], 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) return null;
  const wsPath = lines[1] && lines[1].startsWith('/devtools/browser/') ? lines[1] : null;
  return { port, wsPath };
}

// 纯函数：导航是否已完成。
// s = { loadEventFired, readyState, marker, href }；marker 是导航前写进旧文档的标记，
// 新文档里一定没有它——用来防止把旧页面的 readyState=complete 误判成新页面加载完。
// requireComplete=true（结果页用）：只认 load 事件或 readyState=complete，interactive 不够。
export function isNavigationDone(s, { requireComplete = false } = {}) {
  if (!s) return false;
  if (s.loadEventFired) return true;
  if (s.marker) return false;
  if (!s.href || s.href === 'about:blank') return false;
  if (requireComplete) return s.readyState === 'complete';
  return s.readyState === 'complete' || s.readyState === 'interactive';
}

// 纯函数：是不是百度人机验证页。p = { href, title, text }。
const CAPTCHA_HOST_RE = /\/\/wappass\.baidu\.com|\/static\/captcha\//i;
const CAPTCHA_WORDS = ['请输入验证码', '安全验证', '人机验证', '拖动滑块', '向右滑动', '百度安全验证', '旋转图片', '点击完成验证'];
export function isCaptchaPage(p) {
  if (!p) return false;
  if (p.href && CAPTCHA_HOST_RE.test(p.href)) return true;
  if (p.title && /安全验证|验证码/.test(p.title)) return true;
  const t = p.text || '';
  return CAPTCHA_WORDS.some((w) => t.includes(w));
}

// 纯函数：结果页等待决策。s = { captcha, h3Count, readyState }；返回 'captcha' | 'ready' | 'wait' | 'timeout'。
export function decideResultWait(s, elapsedMs, timeoutMs) {
  if (s && s.captcha) return 'captcha';
  if (s && s.readyState === 'complete' && s.h3Count > 0) return 'ready';
  return elapsedMs >= timeoutMs ? 'timeout' : 'wait';
}

// 纯函数：截图方式。整页太高或本来就只要可见区域 → viewport；否则先整页、超时再退回 viewport。
export function planScreenshot({ beyondViewport, contentHeight, maxHeight = 20000 }) {
  if (!beyondViewport) return { first: 'viewport', note: null };
  if (contentHeight && contentHeight > maxHeight) return { first: 'viewport', note: `页面高 ${Math.round(contentHeight)}px 超阈值` };
  return { first: 'full_page', note: null };
}
export const SHOT_TIMEOUT_MS = 12000;
export const RESULT_WAIT_MS = 20000;

// 纯函数：Page.navigate 的回应（若有）里是否带致命错误。ERR_ABORTED 常见于被后续导航替换，不算失败。
export function navigateReplyError(reply) {
  if (!reply || !reply.errorText) return null;
  if (/ERR_ABORTED/i.test(reply.errorText)) return null;
  return reply.errorText;
}

// 纯函数：是不是 CDP 命令超时（本脚本 CDP.send 抛的"CDP 超时：xxx"）。
export function isCdpTimeout(err) {
  return /^CDP 超时/.test(String((err && err.message) || err || ''));
}

// 纯函数：网页对话框怎么处理。alert/confirm/prompt 一律 dismiss（accept=false）；
// beforeunload 若 dismiss 等于"留在本页"，导航会被卡住，所以放行离开（accept=true）。
export function dialogResponse(type) {
  return { accept: type === 'beforeunload' };
}

// 纯函数：卡住后 Page.stopLoading 再看一眼页面，决定怎么走。p = 探测结果（可为 null）。
// needResults=true（结果页）：有结果标题才放行；否则只要是新文档（不是 about:blank、没有旧标记）就放行。
export function decideAfterStop(p, { needResults = false } = {}) {
  if (!p) return 'fail';
  if (isCaptchaPage(p)) return 'captcha';
  if (!p.href || p.href === 'about:blank' || p.marker) return 'fail';
  if (needResults) return p.h3Count > 0 ? 'ready' : 'fail';
  return 'ready';
}

// 纯函数：解析"本 profile 的 Chrome 进程 PID"列表（每行一个数字，其他行忽略，去重）。
export function parseProfilePids(text) {
  const out = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const t = line.trim();
    if (!/^\d+$/.test(t)) continue;
    const n = parseInt(t, 10);
    if (n > 0 && !out.includes(n)) out.push(n);
  }
  return out;
}

function findChrome() {
  const candidates = [
    process.env['ProgramFiles'] && path.join(process.env['ProgramFiles'], 'Google/Chrome/Application/chrome.exe'),
    process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Google/Chrome/Application/chrome.exe'),
    process.env['LOCALAPPDATA'] && path.join(process.env['LOCALAPPDATA'], 'Google/Chrome/Application/chrome.exe'),
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ].filter(Boolean);
  for (const c of candidates) if (existsSync(c)) return c;
  try {
    const out = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe" /ve',
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const m = out.match(/REG_SZ\s+(.+chrome\.exe)/i);
    if (m && existsSync(m[1].trim())) return m[1].trim();
  } catch {}
  return null;
}

async function fetchJson(url, timeoutMs = 2000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try { const res = await fetch(url, { signal: ac.signal }); return await res.json(); }
  finally { clearTimeout(t); }
}
async function isDebuggerUp(port) {
  try { const v = await fetchJson(`http://${DEBUG_HOST}:${port}/json/version`); return v && v.webSocketDebuggerUrl ? v : null; }
  catch { return null; }
}
function readActivePort() {
  try { return parseDevToolsActivePort(readFileSync(path.join(PROFILE_DIR, 'DevToolsActivePort'), 'utf8')); }
  catch { return null; }
}
// 上次异常退出留下的"本 profile 的" Chrome：用 CDP 让它自己关掉（只动本 profile，不动别的 Chrome）。
async function closeLeftoverOwnChrome() {
  const ap = readActivePort();
  if (!ap) return;
  const v = await isDebuggerUp(ap.port);
  if (!v) return;
  log(`发现上次残留的百度专用 Chrome（端口 ${ap.port}），先关掉`);
  try {
    const ws = await connectWs(v.webSocketDebuggerUrl);
    const b = new CDP(ws);
    b.send('Browser.close', {}, undefined, 5000).catch(() => {});
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline && await isDebuggerUp(ap.port)) await sleep(300);
    b.close();
  } catch {}
}
// 启动自己的 Chrome，返回 { version, child, port }。
async function launchOwnChrome(requestedPort, { systemProxy = false, proxy = null } = {}) {
  const chrome = findChrome();
  if (!chrome) fail('未找到 chrome.exe');
  log(`定位到 Chrome：${chrome}`);
  mkdirSync(PROFILE_DIR, { recursive: true });
  await closeLeftoverOwnChrome();
  if (requestedPort && await isDebuggerUp(requestedPort)) {
    fail(`端口 ${requestedPort} 已被别的 Chrome 占用；本脚本只用自己启动的 Chrome，请换端口或不传 --port`);
  }
  try { rmSync(path.join(PROFILE_DIR, 'DevToolsActivePort'), { force: true }); } catch {}
  log(`启动百度专用 Chrome（独立 profile：${PROFILE_DIR}）`);
  const child = spawn(chrome, buildChromeArgs(requestedPort || 0, PROFILE_DIR, { systemProxy, proxy }), { detached: false, stdio: 'ignore' });
  let exited = false;
  child.on('exit', () => { exited = true; });
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const port = requestedPort || (readActivePort() || {}).port;
    if (port) {
      const v = await isDebuggerUp(port);
      if (v) { log(`调试端口已就绪（${port}）`); return { version: v, child, port }; }
    }
    if (exited && !requestedPort && !readActivePort()) {
      // chrome.exe 立即退出 = 本 profile 被另一个进程占着（把启动请求转交给了它）。
      fail('Chrome 启动后立即退出：百度专用 profile 可能被其他进程占用');
    }
    await sleep(400);
  }
  try { child.kill(); } catch {}
  fail('Chrome 启动 20s 内调试端口未就绪');
}
// 关闭自己启动的 Chrome：先 Browser.close（正常退出），等进程结束；不行再按自己的 PID 结束进程树。
async function closeOwnChrome(browser, chromeInfo) {
  if (!chromeInfo) return;
  const { child, port } = chromeInfo;
  const cleanup = { pid: child.pid, closedBy: null, recheck: [], killed: [], leftover: [] };
  RUN.cleanup = cleanup;
  const exitedP = new Promise((r) => { if (child.exitCode !== null) r(true); else child.once('exit', () => r(true)); });
  if (browser) browser.send('Browser.close', {}, undefined, 5000).catch(() => {});
  const ok = await Promise.race([exitedP, sleep(8000).then(() => false)]);
  if (ok && !(await isDebuggerUp(port))) { log('已关闭本次启动的 Chrome'); cleanup.closedBy = 'Browser.close'; }
  else {
    log('Browser.close 未在 8s 内生效，按本次启动的 PID 结束进程树');
    cleanup.closedBy = 'taskkill';
    killPidTree(child.pid);
  }
  // 复查：本 profile 的 Chrome 进程（含子进程）最多等 15s 全部退出；还在就按 PID 结束并记录。
  const t0 = Date.now();
  let pids = listProfileChromePids();
  while (pids.length && Date.now() - t0 < CLEANUP_CHECK_MS) {
    cleanup.recheck.push({ ms: Date.now() - t0, pids });
    await sleep(1000);
    pids = listProfileChromePids();
  }
  cleanup.recheckMs = Date.now() - t0;
  if (pids.length) {
    log(`[残留] 本 profile 的 Chrome 进程 15s 后仍在：${pids.join(', ')}，按 PID 结束`);
    for (const pid of pids) { killPidTree(pid); cleanup.killed.push(pid); }
    await sleep(1000);
    cleanup.leftover = listProfileChromePids();
    if (cleanup.leftover.length) log(`[残留] 结束后仍有：${cleanup.leftover.join(', ')}`);
  } else log(`  复查：本 profile 的 Chrome 进程已全部退出（${cleanup.recheckMs}ms）`);
  flushLog();
}
function killPidTree(pid) {
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
  else { try { process.kill(pid, 'SIGKILL'); } catch {} }
}
// 列出命令行里带本 profile 目录名的 Chrome 进程（只认本脚本的 profile，不碰别的 Chrome）。
function listProfileChromePids() {
  const tag = path.basename(PROFILE_DIR);
  try {
    if (process.platform === 'win32') {
      const ps = `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${tag}*' } | ForEach-Object { $_.ProcessId }`;
      const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8', timeout: 10000 });
      return parseProfilePids(r.stdout);
    }
    const r = spawnSync('pgrep', ['-f', tag], { encoding: 'utf8', timeout: 5000 });
    return parseProfilePids(r.stdout).filter((p) => p !== process.pid);
  } catch { return []; }
}

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.listeners = [];
    ws.addEventListener('message', (ev) => {
      let msg; try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.id !== undefined && this.pending.has(msg.id)) {
        const { resolve, reject, timer } = this.pending.get(msg.id);
        clearTimeout(timer); this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.message || 'CDP error'}`)); else resolve(msg.result);
      } else if (msg.method) { for (const l of this.listeners) l(msg); }
    });
    ws.addEventListener('close', () => {
      for (const { reject, timer } of this.pending.values()) { clearTimeout(timer); reject(new Error('CDP 连接已关闭')); }
      this.pending.clear();
    });
  }
  send(method, params = {}, sessionId, timeoutMs = CDP_TIMEOUT_MS) {
    const id = ++this.id; const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP 超时：${method}`)); }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify(payload));
    });
  }
  close() { try { this.ws.close(); } catch {} }
}
function connectWs(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { maxPayload: 512 * 1024 * 1024 });
    ws.addEventListener('open', () => resolve(ws), { once: true });
    ws.addEventListener('error', (e) => reject(new Error(`WS 连接失败：${e.message || url}`)), { once: true });
  });
}
async function newPage(browser) {
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
  await browser.send('Page.enable', {}, sessionId);
  await browser.send('Runtime.enable', {}, sessionId);
  await browser.send('DOM.enable', {}, sessionId);
  await browser.send('Input.enable', {}, sessionId).catch(() => {});
  await browser.send('Emulation.setDeviceMetricsOverride',
    { width: VIEWPORT.width, height: VIEWPORT.height, deviceScaleFactor: 1, mobile: false }, sessionId).catch(() => {});
  return { targetId, sessionId };
}
async function evaluate(browser, sessionId, expression, label = 'evaluate') {
  const r = await sendGuarded(browser, sessionId, 'Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, EVAL_TIMEOUT_MS, label);
  if (r.exceptionDetails) throw new Error(`页面 JS 异常：${r.exceptionDetails.text || ''}`);
  return r.result && r.result.value;
}
// 稳健导航：发 Page.navigate 但不等它回应；以 loadEventFired 或"新文档" readyState 为准。
// navigate 的回应只用来记诊断、以及它带回的非 ABORTED 错误（如断网）才算失败。
async function gotoAndSettle(browser, sessionId, url, settleMs = 2500, timeoutMs = NAV_TIMEOUT_MS, { requireComplete = false } = {}) {
  const marker = 'bd_' + randomBytes(6).toString('hex');
  await evaluate(browser, sessionId, `(window.__bdNavMarker = ${JSON.stringify(marker)}, true)`, 'nav-marker').catch(() => {});
  await step(browser, sessionId, 'navigate:start', { target: url });
  const st = { navigated: false, loadEventFired: false, reply: null, replyMs: null };
  const t0 = Date.now();
  // 只认本次导航主框架提交之后的 loadEventFired，避免上一页迟到的 load 事件被误算。
  const onEvt = (msg) => {
    if (msg.sessionId !== sessionId) return;
    if (msg.method === 'Page.frameNavigated' && msg.params && msg.params.frame && !msg.params.frame.parentId) st.navigated = true;
    else if (msg.method === 'Page.loadEventFired' && st.navigated) st.loadEventFired = true;
  };
  browser.listeners.push(onEvt);
  browser.send('Page.navigate', { url }, sessionId, timeoutMs)
    .then((r) => { st.reply = r || {}; st.replyMs = Date.now() - t0; })
    .catch((e) => { st.reply = { sendError: e.message }; });
  try {
    const deadline = t0 + timeoutMs;
    while (Date.now() < deadline) {
      const replyErr = navigateReplyError(st.reply);
      if (replyErr) throw new Error(`导航失败：${replyErr}（${url}）`);
      let probe = null;
      if (!st.loadEventFired) {
        probe = await evaluateWithTimeout(browser, sessionId,
          `({ readyState: document.readyState, marker: window.__bdNavMarker || null, href: location.href })`, 3000).catch(() => null);
      }
      if (isNavigationDone({ loadEventFired: st.loadEventFired, ...(probe || {}) }, { requireComplete })) {
        log(`  导航完成 ${Date.now() - t0}ms（loadEventFired=${st.loadEventFired}，navigate 回应=${st.replyMs === null ? '未回应' : st.replyMs + 'ms'}）`);
        await step(browser, sessionId, 'navigate:done', { target: url, navMs: Date.now() - t0, loadEventFired: st.loadEventFired });
        await sleep(settleMs);
        return;
      }
      await sleep(300);
    }
    // 卡住：留证 → stopLoading → 再看一眼；新文档已在就放行，否则失败。
    const what = `导航 ${timeoutMs}ms 未完成（navigate 回应=${st.replyMs === null ? '未回应' : st.replyMs + 'ms'}）`;
    const stall = await handleStall(browser, sessionId, 'navigate', { what, target: url });
    const p = await evaluateWithTimeout(browser, sessionId,
      `({ readyState: document.readyState, marker: window.__bdNavMarker || null, href: location.href, title: document.title || '', text: ((document.body && document.body.innerText) || '').slice(0, 3000), h3Count: document.querySelectorAll('h3').length })`, 5000).catch(() => null);
    const d = decideAfterStop(p);
    stall.outcome = d === 'ready' ? 'stopLoading 后放行' : d; flushLog();
    if (d === 'captcha') throw new Error(`CAPTCHA_DETECTED@navigate（${p.href}）`);
    if (d === 'ready') { log('  stopLoading 后新页面已在，放行'); await step(browser, sessionId, 'navigate:done-after-stop', { target: url }); return; }
    throw new Error(`导航超时 ${timeoutMs}ms：${url}（navigate 回应=${st.replyMs === null ? '未回应' : st.replyMs + 'ms'}；已留证并 stopLoading）`);
  } finally {
    const i = browser.listeners.indexOf(onEvt);
    if (i >= 0) browser.listeners.splice(i, 1);
  }
}
async function evaluateWithTimeout(browser, sessionId, expression, timeoutMs) {
  const r = await browser.send('Runtime.evaluate', { expression, returnByValue: true }, sessionId, timeoutMs);
  if (r.exceptionDetails) throw new Error('页面 JS 异常');
  return r.result && r.result.value;
}

const PAGE_PROBE_JS = `(() => ({
  href: location.href, title: document.title || '', readyState: document.readyState,
  text: ((document.body && document.body.innerText) || '').slice(0, 3000),
  h3Count: document.querySelectorAll('h3').length,
}))()`;
async function probePage(browser, sessionId) {
  return evaluateWithTimeout(browser, sessionId, PAGE_PROBE_JS, 5000).catch(() => null);
}
async function assertNoCaptcha(browser, sessionId, where) {
  const p = await probePage(browser, sessionId);
  if (isCaptchaPage(p)) { throw new Error(`CAPTCHA_DETECTED@${where}（${p.href}）`); }
}
// 结果页：等 complete 且出现结果标题（h3）；途中发现人机验证就硬停。
async function waitForResults(browser, sessionId) {
  const t0 = Date.now();
  for (;;) {
    const p = await probePage(browser, sessionId);
    const d = decideResultWait({ captcha: isCaptchaPage(p), h3Count: p ? p.h3Count : 0, readyState: p && p.readyState }, Date.now() - t0, RESULT_WAIT_MS);
    if (d === 'captcha') throw new Error(`CAPTCHA_DETECTED@result（${p.href}）`);
    if (d === 'ready') {
      log(`  结果标题已出现（h3 ${p.h3Count} 个，${Date.now() - t0}ms）`);
      await step(browser, sessionId, 'results:ready', { h3Count: p.h3Count });
      return;
    }
    if (d === 'timeout') {
      const stall = await handleStall(browser, sessionId, 'results-wait',
        { what: `结果页 ${RESULT_WAIT_MS}ms 内未就绪（readyState=${p && p.readyState}，h3=${p ? p.h3Count : '?'}）` });
      const p2 = await probePage(browser, sessionId);
      const d2 = decideAfterStop(p2 && { ...p2, marker: null }, { needResults: true });
      stall.outcome = d2 === 'ready' ? 'stopLoading 后放行' : d2; flushLog();
      if (d2 === 'captcha') throw new Error(`CAPTCHA_DETECTED@result（${p2.href}）`);
      if (d2 === 'ready') { log(`  stopLoading 后结果标题已在（h3 ${p2.h3Count} 个），放行`); await step(browser, sessionId, 'results:ready-after-stop', { h3Count: p2.h3Count }); return; }
      throw new Error(`结果页 ${RESULT_WAIT_MS}ms 内未出现结果标题（readyState=${p && p.readyState}，${p && p.href}；已留证并 stopLoading）`);
    }
    await sleep(500);
  }
}

const OCCLUSION_PROBE_JS = `(() => {
  const COVER_RATIO = 0.25, CENTER_RATIO = 0.06, Z_TOP = 100;
  const vw = window.innerWidth, vh = window.innerHeight;
  const viewportArea = Math.max(1, vw * vh); const cx = vw/2, cy = vh/2;
  const isVisible = (el) => { if (!el) return false; const cs = getComputedStyle(el);
    if (cs.display==='none'||cs.visibility==='hidden'||cs.visibility==='collapse') return false;
    if (parseFloat(cs.opacity||'1')<=0.1) return false;
    if (el.offsetParent===null && cs.position!=='fixed') return false; return true; };
  const topZ = (el) => { let n=el,hops=0; while(n&&hops<6){ const cs=getComputedStyle(n);
    const z=parseInt(cs.zIndex,10); if(!Number.isNaN(z)&&z>=Z_TOP&&cs.position!=='static') return z; n=n.parentElement; hops++; } return null; };
  const occ = (el) => { if(!isVisible(el)) return null; const r=el.getBoundingClientRect();
    if(r.width<2||r.height<2) return null;
    const ix=Math.max(0,Math.min(r.right,vw)-Math.max(r.left,0)), iy=Math.max(0,Math.min(r.bottom,vh)-Math.max(r.top,0));
    const inter=ix*iy; if(inter<=0) return null; const ratio=inter/viewportArea;
    const coversCenter=r.left<=cx&&r.right>=cx&&r.top<=cy&&r.bottom>=cy;
    if(!(ratio>=COVER_RATIO||(coversCenter&&ratio>=CENTER_RATIO))) return null;
    const z=topZ(el); if(z===null) return null; return { ratio:+ratio.toFixed(3), coversCenter, z }; };
  const remaining=[];
  const sel='[class*="login" i],[id*="login" i],[class*="mask" i],[class*="overlay" i],[class*="modal" i],[class*="dialog" i]';
  for(const el of document.querySelectorAll(sel)){ const o=occ(el); if(o){ const tag=String(el.className||el.id||el.tagName||'').slice(0,50);
    remaining.push(tag+' (占视口'+Math.round(o.ratio*100)+'%'+(o.coversCenter?',居中':'')+',z='+o.z+')'); if(remaining.length>=3) break; } }
  return { remaining:[...new Set(remaining)] };
})()`;

async function captureFullPage(browser, sessionId, outPath, { runGuard = true, beyondViewport = true } = {}) {
  // 截图前先确认没被跳到人机验证页；是就硬停，不截、不绕。
  await assertNoCaptcha(browser, sessionId, path.basename(outPath));
  let occluded = false, occlusions = [];
  if (runGuard) {
    const occ = await evaluate(browser, sessionId, OCCLUSION_PROBE_JS, 'occlusion-probe').catch(() => ({ remaining: [] }));
    occlusions = (occ && occ.remaining) || [];
    occluded = occlusions.length > 0;
    if (occluded) log(`[遮挡告警] ${outPath} 检测到遮挡：${occlusions.join(' | ')}`);
  }
  let contentSize = null;
  try { const m = await browser.send('Page.getLayoutMetrics', {}, sessionId, 5000); contentSize = m.cssContentSize || m.contentSize; } catch {}
  const plan = planScreenshot({ beyondViewport, contentHeight: contentSize && contentSize.height });
  const label = `shot:${path.basename(outPath)}`;
  await step(browser, sessionId, `${label}:start`, { plan: plan.first });
  // 可见区域截图：单独 12s 超时，超时 stopLoading 后重试一次（sendGuarded）。
  const viewportShot = () => sendGuarded(browser, sessionId, 'Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, SHOT_TIMEOUT_MS, label);
  let data, meta = {};
  if (plan.first === 'full_page') {
    try {
      // 整页只试一次：它的"重试"就是退回可见区域截图。
      const shot = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true }, sessionId, SHOT_TIMEOUT_MS);
      data = shot.data; meta = { mode: 'full_page', width: contentSize ? Math.round(contentSize.width) : VIEWPORT.width, height: contentSize ? Math.round(contentSize.height) : VIEWPORT.height };
    } catch (e) {
      if (isCdpTimeout(e)) {
        const stall = await handleStall(browser, sessionId, label, { what: `整页截图 ${SHOT_TIMEOUT_MS}ms 无回应`, method: 'Page.captureScreenshot(full)', timeoutMs: SHOT_TIMEOUT_MS });
        stall.outcome = '退回可见区域截图'; flushLog();
      }
      log(`  整页截图失败（${e.message}），退回只截可见区域`);
      const shot = await viewportShot();
      data = shot.data; meta = { mode: 'viewport_only', ...VIEWPORT, note: `整页截图失败退回：${e.message}` };
    }
  } else {
    const shot = await viewportShot();
    data = shot.data; meta = { mode: 'viewport_only', ...VIEWPORT, ...(plan.note ? { note: plan.note } : {}) };
  }
  const buf = Buffer.from(data, 'base64');
  writeFileSync(outPath, buf);
  const sha256 = createHash('sha256').update(buf).digest('hex');
  return { bytes: buf.length, sha256, ...meta, occluded, occlusions };
}

async function triggerSuggest(browser, sessionId, word) {
  const focusJS = `(() => {
    const inp = document.querySelector('#kw') || document.querySelector('input[name="wd"]') || document.querySelector('input[type="text"]');
    if (!inp) return { ok:false };
    inp.focus(); inp.value=''; inp.dispatchEvent(new Event('input',{bubbles:true}));
    const r = inp.getBoundingClientRect();
    return { ok:true, x: Math.round(r.left+r.width/2), y: Math.round(r.top+r.height/2) };
  })()`;
  const f = await evaluate(browser, sessionId, focusJS, 'suggest-focus');
  if (!f || !f.ok) throw new Error('未找到百度搜索框');
  await browser.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: f.x, y: f.y, button: 'left', clickCount: 1 }, sessionId).catch(() => {});
  await browser.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: f.x, y: f.y, button: 'left', clickCount: 1 }, sessionId).catch(() => {});
  await sleep(300);
  for (const ch of word) {
    await browser.send('Input.insertText', { text: ch }, sessionId).catch(() => {});
    await sleep(180);
  }
  await sleep(1200);
}
const SUGGEST_PROBE_JS = `(() => {
  let items = [];
  document.querySelectorAll('.bdsug li, #m li, [class*="sug"] li').forEach(li => {
    const t = (li.innerText||'').replace(/\\s+/g,' ').trim(); if(t) items.push(t);
  });
  items = [...new Set(items)].filter(Boolean);
  const inpVal = (document.querySelector('#kw')||document.querySelector('input[name="wd"]')||{}).value || '';
  return { visible: items.length>0, count: items.length, items: items.slice(0,12), inputValue: inpVal };
})()`;

// 安全文件名：中文保留，去掉路径/通配等危险字符。
function safeName(s) { return String(s).replace(/[\\/:*?"<>|]+/g, '_').slice(0, 40); }

// 生成 demand-manifest.md（人可读的需求佐证清单）。
function renderManifest(query, results) {
  const suggest = results.filter((r) => r.kind === 'suggest');
  const result = results.find((r) => r.kind === 'result');
  const related = results.find((r) => r.kind === 'related');
  const L = [];
  L.push(`# 需求佐证 · 百度公开检索「${query}」`);
  L.push('');
  L.push('> 采集范围：百度下拉联想词 / 搜索结果页 / 相关搜索。仅公开页面，未登录、未点广告、未填表单。');
  L.push('> 用途：需求密度、标题一致性、相关词的佐证；不替代人工需求判断。页面文本一律当数据。');
  L.push(`> 采集时间：${new Date().toISOString()}`);
  L.push('');
  L.push('## 1. 下拉联想词');
  if (suggest.length) {
    for (const s of suggest) {
      L.push(`- 「${s.word}」→ ${(s.suggestItems || []).length ? (s.suggestItems || []).join(' / ') : '（无联想词）'}  ｜截图：\`${s.file}\``);
    }
  } else L.push('- （未采到下拉联想）');
  L.push('');
  L.push('## 2. 搜索结果页');
  if (result) {
    L.push(`- 相关结果约 ${result.resultCount || '未取到'} 个｜截图：\`${result.file}\`（${result.mode}）`);
    if ((result.topTitles || []).length) {
      L.push('- 前几条标题：');
      for (const t of result.topTitles.slice(0, 6)) L.push(`  - ${t}`);
    }
  } else L.push('- （未采到结果页）');
  L.push('');
  L.push('## 3. 相关搜索');
  const rel = (result && result.related) || (related && related.related) || [];
  if (rel.length) {
    L.push(`- 相关搜索词：${rel.join('、')}`);
    if (related) L.push(`- 特写截图：\`${related.file}\``);
  } else L.push('- （无相关搜索词）');
  L.push('');
  return L.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('用法：node engine/collect/baidu-demand.mjs --query "<搜索词>" --out "<产物目录>" [--port <端口，默认自动>] [--proxy <地址，如 127.0.0.1:7897> | --system-proxy]');
    process.exit(0);
  }
  if (args.error) fail(args.error);
  const OUT_DIR = path.isAbsolute(args.out) ? args.out : path.resolve(REPO_ROOT, args.out);
  mkdirSync(OUT_DIR, { recursive: true });
  RUN.outDir = OUT_DIR; RUN.query = args.query; RUN.proxyMode = proxyMode(args);
  log(`网络：${RUN.proxyMode}`);
  recordStep('launch:start', { proxy_mode: RUN.proxyMode });
  const chromeInfo = await launchOwnChrome(args.port, { systemProxy: !!args.systemProxy, proxy: args.proxy || null });
  recordStep('launch:ready', { port: chromeInfo.port, pid: chromeInfo.child.pid });
  let browser = null;
  const results = RUN.results;
  let hardStop = false;

  try {
    browser = new CDP(await connectWs(chromeInfo.version.webSocketDebuggerUrl));
    installDialogGuard(browser);
    const page = await newPage(browser);
    RUN.targetId = page.targetId;
    await step(browser, page.sessionId, 'page:ready');

    // 1) 下拉联想词（主词优先；联想少时补试等价长尾词）
    const MAIN_WORD = args.query;
    const suggestWords = [args.query, `${args.query} 闲鱼`, `${args.query} 怎么弄`];
    for (const word of suggestWords) {
      log(`下拉联想：导航 baidu.com 输入「${word}」`);
      await gotoAndSettle(browser, page.sessionId, 'https://www.baidu.com/', 2500);
      await assertNoCaptcha(browser, page.sessionId, 'suggest-home');
      await triggerSuggest(browser, page.sessionId, word);
      await step(browser, page.sessionId, 'suggest:typed', { word });
      const probe = await evaluate(browser, page.sessionId, SUGGEST_PROBE_JS, 'suggest-probe').catch(() => ({ visible: false, items: [] }));
      log(`  下拉词 ${probe.count} 条：${(probe.items || []).join(' / ')}`);
      const fn = `baidu-suggest-${safeName(word)}.png`;
      const outPath = path.join(OUT_DIR, fn);
      const cap = await captureFullPage(browser, page.sessionId, outPath, { runGuard: false, beyondViewport: false });
      results.push({ kind: 'suggest', word, file: fn, ...cap, suggestItems: probe.items, suggestCount: probe.count, inputValue: probe.inputValue });
      await step(browser, page.sessionId, `shot:${fn}:done`, { bytes: cap.bytes, mode: cap.mode });
      log(`  截图落盘：${fn}（${cap.bytes} 字节）`);
      if (word === MAIN_WORD && probe.count >= 4) { log('  主词下拉词充足，跳过备选词'); break; }
    }

    // 2) 搜索结果页
    log(`搜索结果页：导航 /s?wd=${args.query}`);
    await gotoAndSettle(browser, page.sessionId, 'https://www.baidu.com/s?wd=' + encodeURIComponent(args.query), 1500, NAV_TIMEOUT_MS, { requireComplete: true });
    await waitForResults(browser, page.sessionId);
    const resultInfoJS = `(() => {
      const flat=(document.body&&document.body.innerText||'').replace(/\\s+/g,' ');
      const m = flat.match(/百度为您找到相关结果约?\\s*([0-9,，]+)\\s*个/) || flat.match(/相关结果约?\\s*([0-9,，]+)/);
      const titles=[]; document.querySelectorAll('h3').forEach(h=>{const t=(h.innerText||'').trim(); if(t) titles.push(t);});
      const related=[]; document.querySelectorAll('[class*="rs"] a, #rs a, [class*="relat"] a').forEach(a=>{const t=(a.innerText||'').trim(); if(t) related.push(t);});
      return { resultCount: m?m[1]:null, topTitles: titles.slice(0,6), related:[...new Set(related)].slice(0,12) };
    })()`;
    const rinfo = await evaluate(browser, page.sessionId, resultInfoJS, 'result-info').catch(() => ({}));
    log(`  相关结果约 ${rinfo.resultCount || '未取到'} 个；前几条标题 ${(rinfo.topTitles || []).length} 条；相关搜索 ${(rinfo.related || []).length} 词`);
    const rfn = `baidu-result-${safeName(args.query)}.png`;
    const rPath = path.join(OUT_DIR, rfn);
    const rcap = await captureFullPage(browser, page.sessionId, rPath, { runGuard: true, beyondViewport: true });
    results.push({ kind: 'result', word: args.query, file: rfn, ...rcap, ...rinfo });
    await step(browser, page.sessionId, `shot:${rfn}:done`, { bytes: rcap.bytes, mode: rcap.mode });
    log(`  截图落盘：${rfn}（${rcap.bytes} 字节，${rcap.mode}）`);

    // 3) 相关搜索特写
    if ((rinfo.related || []).length > 0) {
      await evaluate(browser, page.sessionId, `(() => { const rs=document.querySelector('#rs, [class*="rs_"], [class*="relat"]'); if(rs) rs.scrollIntoView({block:'center'}); else window.scrollTo(0, document.body.scrollHeight); return true; })()`, 'scroll-related').catch(() => {});
      await sleep(1000);
      const relfn = `baidu-related-${safeName(args.query)}.png`;
      const relPath = path.join(OUT_DIR, relfn);
      const relcap = await captureFullPage(browser, page.sessionId, relPath, { runGuard: false, beyondViewport: false });
      results.push({ kind: 'related', word: args.query, file: relfn, ...relcap, related: rinfo.related });
      await step(browser, page.sessionId, `shot:${relfn}:done`, { bytes: relcap.bytes, mode: relcap.mode });
      log(`  相关搜索特写截图：${relfn}（${relcap.bytes} 字节）`);
    }

    await browser.send('Target.closeTarget', { targetId: page.targetId }, undefined, 5000).catch(() => {});
    recordStep('page:closed');
  } catch (e) {
    if (String(e.message).startsWith('CAPTCHA_DETECTED')) {
      log(`[硬停] 检测到百度人机验证：${e.message}。未绕过，本次停止采集。`);
      results.push({ kind: 'aborted', reason: e.message });
      hardStop = true;
    } else {
      log('采集异常：' + (e.stack || e.message));
      results.push({ kind: 'error', reason: e.message });
    }
    recordStep('aborted', { reason: e.message });
  }

  flushLog();
  const hasResult = results.some((r) => r.kind === 'result');
  if (hasResult) {
    writeFileSync(path.join(OUT_DIR, 'demand-manifest.md'), renderManifest(args.query, results), 'utf8');
    log('需求佐证清单：' + path.join(OUT_DIR, 'demand-manifest.md'));
  }
  log('结果日志：' + path.join(OUT_DIR, '_capture-log.json'));
  await closeOwnChrome(browser, chromeInfo);
  if (browser) browser.close();
  recordStep('exit', { hasResult, hardStop });
  // 有结果页即视为成功产出；验证码硬停或无结果 → 非0（上游按需求层缺口降级，不致命）。
  process.exit(hasResult && !hardStop ? 0 : 2);
}

export { safeName, renderManifest };

// 只有直接运行本脚本才执行 main()；测试 import 纯函数时不启动浏览器。
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  main().catch((e) => { console.error('[致命]', e && e.stack ? e.stack : e); process.exit(1); });
}
