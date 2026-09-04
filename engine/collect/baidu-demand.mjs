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

import { spawn, execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const DEBUG_HOST = '127.0.0.1';
const DEBUG_PORT = 9222;
// 与 goofish-collect 共用同一个采集专用 profile（相对仓库根，不依赖 cwd）。
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PROFILE_DIR = path.join(REPO_ROOT, '.collect-chrome-profile');
const PROFILE_NAME = 'Default';
const WINDOW_SIZE = '1600,1000';
const VIEWPORT = { width: 1600, height: 1000 };
const CDP_TIMEOUT_MS = 30000;

function log(m) { console.log(`[百度采集] ${m}`); }
function fail(m) { console.error(`[错误] ${m}`); process.exit(1); }

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--query') args.query = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--port') args.port = parseInt(argv[++i], 10);
    else if (a === '-h' || a === '--help') {
      console.log('用法：node engine/collect/baidu-demand.mjs --query "<搜索词>" --out "<产物目录>"');
      process.exit(0);
    }
  }
  if (!args.query) fail('缺少 --query "<搜索词>"');
  if (!args.out) fail('缺少 --out "<产物目录>"');
  if (!args.port) args.port = DEBUG_PORT;
  return args;
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
async function ensureChrome(port) {
  const existing = await isDebuggerUp(port);
  if (existing) { log(`复用已在运行的采集 Chrome（端口 ${port}）`); return existing; }
  const chrome = findChrome();
  if (!chrome) fail('未找到 chrome.exe');
  log(`定位到 Chrome：${chrome}`);
  mkdirSync(PROFILE_DIR, { recursive: true });
  const args = [
    `--remote-debugging-port=${port}`, `--remote-debugging-address=${DEBUG_HOST}`,
    `--user-data-dir=${PROFILE_DIR}`, `--profile-directory=${PROFILE_NAME}`,
    '--no-first-run', '--no-default-browser-check', `--window-size=${WINDOW_SIZE}`, 'about:blank',
  ];
  log('启动采集专用 Chrome（独立 profile）');
  const child = spawn(chrome, args, { detached: true, stdio: 'ignore' });
  child.unref();
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const v = await isDebuggerUp(port);
    if (v) { log('调试端口已就绪'); return v; }
    await sleep(500);
  }
  fail('Chrome 启动 20s 内调试端口未就绪');
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
async function evaluate(browser, sessionId, expression) {
  const r = await browser.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
  if (r.exceptionDetails) throw new Error(`页面 JS 异常：${r.exceptionDetails.text || ''}`);
  return r.result && r.result.value;
}
async function gotoAndSettle(browser, sessionId, url, settleMs = 2500) {
  await browser.send('Page.navigate', { url }, sessionId);
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try { const s = await evaluate(browser, sessionId, 'document.readyState'); if (s === 'complete' || s === 'interactive') break; } catch {}
    await sleep(300);
  }
  await sleep(settleMs);
}

const CAPTCHA_PROBE_JS = `(() => {
  const t = (document.body && document.body.innerText) || '';
  const hit = t.includes('请输入验证码') || t.includes('安全验证') || t.includes('人机验证')
    || t.includes('拖动滑块') || t.includes('向右滑动') || t.includes('百度安全验证');
  return { captcha: hit };
})()`;
async function assertNoCaptcha(browser, sessionId, where) {
  const s = await evaluate(browser, sessionId, CAPTCHA_PROBE_JS).catch(() => ({ captcha: false }));
  if (s.captcha) { throw new Error(`CAPTCHA_DETECTED@${where}`); }
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
  let occluded = false, occlusions = [];
  if (runGuard) {
    const occ = await evaluate(browser, sessionId, OCCLUSION_PROBE_JS).catch(() => ({ remaining: [] }));
    occlusions = (occ && occ.remaining) || [];
    occluded = occlusions.length > 0;
    if (occluded) log(`[遮挡告警] ${outPath} 检测到遮挡：${occlusions.join(' | ')}`);
  }
  let contentSize = null;
  try { const m = await browser.send('Page.getLayoutMetrics', {}, sessionId); contentSize = m.cssContentSize || m.contentSize; } catch {}
  const MAX_H = 20000; let data, meta = {};
  if (beyondViewport && contentSize && contentSize.height > MAX_H) {
    const shot = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
    data = shot.data; meta = { mode: 'viewport_only', note: `页面高 ${Math.round(contentSize.height)}px 超阈值` };
  } else if (beyondViewport) {
    const shot = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true }, sessionId);
    data = shot.data; meta = { mode: 'full_page', width: contentSize ? Math.round(contentSize.width) : VIEWPORT.width, height: contentSize ? Math.round(contentSize.height) : VIEWPORT.height };
  } else {
    const shot = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
    data = shot.data; meta = { mode: 'viewport_only', ...VIEWPORT };
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
  const f = await evaluate(browser, sessionId, focusJS);
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
  const OUT_DIR = path.isAbsolute(args.out) ? args.out : path.resolve(REPO_ROOT, args.out);
  mkdirSync(OUT_DIR, { recursive: true });
  const version = await ensureChrome(args.port);
  const bws = await connectWs(version.webSocketDebuggerUrl);
  const browser = new CDP(bws);
  const results = [];
  let hardStop = false;

  try {
    const page = await newPage(browser);

    // 1) 下拉联想词（主词优先；联想少时补试等价长尾词）
    const MAIN_WORD = args.query;
    const suggestWords = [args.query, `${args.query} 闲鱼`, `${args.query} 怎么弄`];
    for (const word of suggestWords) {
      log(`下拉联想：导航 baidu.com 输入「${word}」`);
      await gotoAndSettle(browser, page.sessionId, 'https://www.baidu.com/', 2500);
      await assertNoCaptcha(browser, page.sessionId, 'suggest-home');
      await triggerSuggest(browser, page.sessionId, word);
      const probe = await evaluate(browser, page.sessionId, SUGGEST_PROBE_JS).catch(() => ({ visible: false, items: [] }));
      log(`  下拉词 ${probe.count} 条：${(probe.items || []).join(' / ')}`);
      const fn = `baidu-suggest-${safeName(word)}.png`;
      const outPath = path.join(OUT_DIR, fn);
      const cap = await captureFullPage(browser, page.sessionId, outPath, { runGuard: false, beyondViewport: false });
      results.push({ kind: 'suggest', word, file: fn, ...cap, suggestItems: probe.items, suggestCount: probe.count, inputValue: probe.inputValue });
      log(`  截图落盘：${fn}（${cap.bytes} 字节）`);
      if (word === MAIN_WORD && probe.count >= 4) { log('  主词下拉词充足，跳过备选词'); break; }
    }

    // 2) 搜索结果页
    log(`搜索结果页：导航 /s?wd=${args.query}`);
    await gotoAndSettle(browser, page.sessionId, 'https://www.baidu.com/s?wd=' + encodeURIComponent(args.query), 3000);
    await assertNoCaptcha(browser, page.sessionId, 'result');
    const resultInfoJS = `(() => {
      const flat=(document.body&&document.body.innerText||'').replace(/\\s+/g,' ');
      const m = flat.match(/百度为您找到相关结果约?\\s*([0-9,，]+)\\s*个/) || flat.match(/相关结果约?\\s*([0-9,，]+)/);
      const titles=[]; document.querySelectorAll('h3').forEach(h=>{const t=(h.innerText||'').trim(); if(t) titles.push(t);});
      const related=[]; document.querySelectorAll('[class*="rs"] a, #rs a, [class*="relat"] a').forEach(a=>{const t=(a.innerText||'').trim(); if(t) related.push(t);});
      return { resultCount: m?m[1]:null, topTitles: titles.slice(0,6), related:[...new Set(related)].slice(0,12) };
    })()`;
    const rinfo = await evaluate(browser, page.sessionId, resultInfoJS).catch(() => ({}));
    log(`  相关结果约 ${rinfo.resultCount || '未取到'} 个；前几条标题 ${(rinfo.topTitles || []).length} 条；相关搜索 ${(rinfo.related || []).length} 词`);
    const rfn = `baidu-result-${safeName(args.query)}.png`;
    const rPath = path.join(OUT_DIR, rfn);
    const rcap = await captureFullPage(browser, page.sessionId, rPath, { runGuard: true, beyondViewport: true });
    results.push({ kind: 'result', word: args.query, file: rfn, ...rcap, ...rinfo });
    log(`  截图落盘：${rfn}（${rcap.bytes} 字节，${rcap.mode}）`);

    // 3) 相关搜索特写
    if ((rinfo.related || []).length > 0) {
      await evaluate(browser, page.sessionId, `(() => { const rs=document.querySelector('#rs, [class*="rs_"], [class*="relat"]'); if(rs) rs.scrollIntoView({block:'center'}); else window.scrollTo(0, document.body.scrollHeight); return true; })()`).catch(() => {});
      await sleep(1000);
      const relfn = `baidu-related-${safeName(args.query)}.png`;
      const relPath = path.join(OUT_DIR, relfn);
      const relcap = await captureFullPage(browser, page.sessionId, relPath, { runGuard: false, beyondViewport: false });
      results.push({ kind: 'related', word: args.query, file: relfn, ...relcap, related: rinfo.related });
      log(`  相关搜索特写截图：${relfn}（${relcap.bytes} 字节）`);
    }

    await browser.send('Target.closeTarget', { targetId: page.targetId }).catch(() => {});
  } catch (e) {
    if (String(e.message).startsWith('CAPTCHA_DETECTED')) {
      log(`[硬停] 检测到百度人机验证：${e.message}。窗口保留，未绕过。`);
      results.push({ kind: 'aborted', reason: e.message });
      hardStop = true;
    } else {
      log('采集异常：' + (e.stack || e.message));
      results.push({ kind: 'error', reason: e.message });
    }
  }

  writeFileSync(path.join(OUT_DIR, '_capture-log.json'), JSON.stringify({ generated_at: new Date().toISOString(), query: args.query, results }, null, 2), 'utf8');
  const hasResult = results.some((r) => r.kind === 'result');
  if (hasResult) {
    writeFileSync(path.join(OUT_DIR, 'demand-manifest.md'), renderManifest(args.query, results), 'utf8');
    log('需求佐证清单：' + path.join(OUT_DIR, 'demand-manifest.md'));
  }
  log('结果日志：' + path.join(OUT_DIR, '_capture-log.json'));
  browser.close();
  // 有结果页即视为成功产出；验证码硬停或无结果 → 非0（上游按需求层缺口降级，不致命）。
  process.exit(hasResult && !hardStop ? 0 : 2);
}
main().catch((e) => { console.error('[致命]', e && e.stack ? e.stack : e); process.exit(1); });
