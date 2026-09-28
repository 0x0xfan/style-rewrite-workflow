import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseArgs, buildChromeArgs, parseDevToolsActivePort, isNavigationDone, navigateReplyError,
  isCaptchaPage, decideResultWait, planScreenshot, SHOT_TIMEOUT_MS,
  safeName, renderManifest, PROFILE_DIR,
} from '../collect/baidu-demand.mjs';

// 只测纯函数：不启动浏览器、不联网。

test('parseArgs：默认端口 0（让 Chrome 自选），缺参数返回 error 不直接退出', () => {
  assert.deepEqual(parseArgs(['--query', '老照片修复', '--out', 'x']), { port: 0, query: '老照片修复', out: 'x' });
  assert.equal(parseArgs(['--out', 'x']).error, '缺少 --query "<搜索词>"');
  assert.equal(parseArgs(['--query', 'a']).error, '缺少 --out "<产物目录>"');
  assert.equal(parseArgs(['--query', 'a', '--out', 'b', '--port', '9555']).port, 9555);
  assert.equal(parseArgs(['-h']).help, true);
});

test('buildChromeArgs：独立 profile、禁扩展、端口按传入值，不钉 9222', () => {
  const a = buildChromeArgs(0, 'C:/tmp/p');
  assert.ok(a.includes('--remote-debugging-port=0'));
  assert.ok(a.includes('--user-data-dir=C:/tmp/p'));
  assert.ok(a.includes('--disable-extensions'));
  assert.ok(!a.some((x) => x.includes('9222')));
  assert.equal(a[a.length - 1], 'about:blank');
});

test('buildChromeArgs：默认直连（--no-proxy-server），--system-proxy 时不加', () => {
  assert.ok(buildChromeArgs(0, 'p').includes('--no-proxy-server'));
  assert.ok(!buildChromeArgs(0, 'p', { systemProxy: true }).includes('--no-proxy-server'));
  assert.equal(parseArgs(['--query', 'a', '--out', 'b', '--system-proxy']).systemProxy, true);
});

test('PROFILE_DIR：不与闲鱼采集的 .collect-chrome-profile 共用', () => {
  assert.ok(!PROFILE_DIR.includes('.collect-chrome-profile'));
  assert.ok(PROFILE_DIR.endsWith('baidu-demand-chrome-profile'));
});

test('parseDevToolsActivePort：正常 / CRLF / 坏内容', () => {
  assert.deepEqual(parseDevToolsActivePort('53211\n/devtools/browser/abc-123\n'), { port: 53211, wsPath: '/devtools/browser/abc-123' });
  assert.deepEqual(parseDevToolsActivePort('9333\r\n/devtools/browser/x\r\n'), { port: 9333, wsPath: '/devtools/browser/x' });
  assert.deepEqual(parseDevToolsActivePort('9333'), { port: 9333, wsPath: null });
  assert.equal(parseDevToolsActivePort(''), null);
  assert.equal(parseDevToolsActivePort('abc\n'), null);
  assert.equal(parseDevToolsActivePort('70000\n'), null);
  assert.equal(parseDevToolsActivePort(undefined), null);
});

test('isNavigationDone：loadEventFired 直接算完成（navigate 不回应也行）', () => {
  assert.equal(isNavigationDone({ loadEventFired: true }), true);
});

test('isNavigationDone：旧文档（仍有导航前标记）不算完成，哪怕 readyState=complete', () => {
  assert.equal(isNavigationDone({ readyState: 'complete', marker: 'bd_x', href: 'https://www.baidu.com/' }), false);
});

test('isNavigationDone：新文档 interactive/complete 算完成；loading、about:blank、无探测结果不算', () => {
  assert.equal(isNavigationDone({ readyState: 'complete', marker: null, href: 'https://www.baidu.com/' }), true);
  assert.equal(isNavigationDone({ readyState: 'interactive', marker: null, href: 'https://www.baidu.com/s?wd=a' }), true);
  assert.equal(isNavigationDone({ readyState: 'loading', marker: null, href: 'https://www.baidu.com/' }), false);
  assert.equal(isNavigationDone({ readyState: 'complete', marker: null, href: 'about:blank' }), false);
  assert.equal(isNavigationDone({}), false);
  assert.equal(isNavigationDone(null), false);
});

test('isNavigationDone(requireComplete)：结果页 interactive 不算，complete / load 事件才算', () => {
  const o = { requireComplete: true };
  assert.equal(isNavigationDone({ readyState: 'interactive', marker: null, href: 'https://www.baidu.com/s?wd=a' }, o), false);
  assert.equal(isNavigationDone({ readyState: 'complete', marker: null, href: 'https://www.baidu.com/s?wd=a' }, o), true);
  assert.equal(isNavigationDone({ loadEventFired: true }, o), true);
  assert.equal(isNavigationDone({ readyState: 'complete', marker: 'bd_x', href: 'https://www.baidu.com/s?wd=a' }, o), false);
});

test('isCaptchaPage：验证页网址 / 标题 / 文案都能认出；正常结果页不误判', () => {
  assert.equal(isCaptchaPage({ href: 'https://wappass.baidu.com/static/captcha/tuxing.html?ak=x', title: '', text: '' }), true);
  assert.equal(isCaptchaPage({ href: 'https://www.baidu.com/s?wd=a', title: '百度安全验证', text: '' }), true);
  assert.equal(isCaptchaPage({ href: 'https://www.baidu.com/s?wd=a', title: 'a_百度搜索', text: '请拖动滑块完成拼图，拖动滑块' }), true);
  assert.equal(isCaptchaPage({ href: 'https://www.baidu.com/s?wd=%E8%80%81', title: '老照片修复_百度搜索', text: '百度为您找到相关结果约100个' }), false);
  assert.equal(isCaptchaPage(null), false);
});

test('decideResultWait：验证页优先硬停；complete 且有 h3 才 ready；超时报 timeout', () => {
  assert.equal(decideResultWait({ captcha: true, h3Count: 10, readyState: 'complete' }, 0, 20000), 'captcha');
  assert.equal(decideResultWait({ captcha: false, h3Count: 10, readyState: 'complete' }, 100, 20000), 'ready');
  assert.equal(decideResultWait({ captcha: false, h3Count: 0, readyState: 'complete' }, 100, 20000), 'wait');
  assert.equal(decideResultWait({ captcha: false, h3Count: 5, readyState: 'interactive' }, 100, 20000), 'wait');
  assert.equal(decideResultWait({ captcha: false, h3Count: 0, readyState: 'complete' }, 20000, 20000), 'timeout');
  assert.equal(decideResultWait(null, 0, 20000), 'wait');
});

test('planScreenshot：只要可见区域 / 页面超高 → viewport；否则先整页；超时常量小于 CDP 默认 30s', () => {
  assert.deepEqual(planScreenshot({ beyondViewport: false, contentHeight: 3000 }), { first: 'viewport', note: null });
  assert.equal(planScreenshot({ beyondViewport: true, contentHeight: 25000 }).first, 'viewport');
  assert.match(planScreenshot({ beyondViewport: true, contentHeight: 25000 }).note, /超阈值/);
  assert.deepEqual(planScreenshot({ beyondViewport: true, contentHeight: 3000 }), { first: 'full_page', note: null });
  assert.deepEqual(planScreenshot({ beyondViewport: true }), { first: 'full_page', note: null });
  assert.ok(SHOT_TIMEOUT_MS < 30000);
});

test('navigateReplyError：未回应/正常回应/ABORTED 不算失败，其他 errorText 算', () => {
  assert.equal(navigateReplyError(null), null);
  assert.equal(navigateReplyError({ frameId: 'f', loaderId: 'l' }), null);
  assert.equal(navigateReplyError({ errorText: 'net::ERR_ABORTED' }), null);
  assert.equal(navigateReplyError({ errorText: 'net::ERR_NAME_NOT_RESOLVED' }), 'net::ERR_NAME_NOT_RESOLVED');
  assert.equal(navigateReplyError({ sendError: 'CDP 超时：Page.navigate' }), null);
});

test('safeName：去掉路径和通配字符，保留中文，截 40 字', () => {
  assert.equal(safeName('a/b\\c:d*e?"f<g>h|i'), 'a_b_c_d_e_f_g_h_i');
  assert.equal(safeName('老照片修复 闲鱼'), '老照片修复 闲鱼');
  assert.equal(safeName('x'.repeat(50)).length, 40);
});

test('renderManifest：三段齐全', () => {
  const md = renderManifest('老照片修复', [
    { kind: 'suggest', word: '老照片修复', file: 's.png', suggestItems: ['老照片修复app'] },
    { kind: 'result', file: 'r.png', mode: 'full_page', resultCount: '100', topTitles: ['标题1'], related: ['相关1'] },
    { kind: 'related', file: 'rel.png', related: ['相关1'] },
  ]);
  assert.match(md, /「老照片修复」→ 老照片修复app/);
  assert.match(md, /相关结果约 100 个/);
  assert.match(md, /相关搜索词：相关1/);
  assert.match(md, /特写截图：`rel\.png`/);
});
