import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeImageWaitResult, decideLoginState, LOGIN_SETTLE_MAX_MS, LOGIN_SETTLE_POLL_MS,
  parseArgs, chooseQuery, MIN_WANTS_CARDS,
} from '../collect/goofish-collect.mjs';

// 只测纯函数部分：不启动浏览器、不联网、不碰真实闲鱼页面。
// 背景：商品卡片图走懒加载，截图前要等 <img> 全部 complete && naturalWidth>0，
// 有超时上限；这个函数负责把轮询到的 {total, loaded} 状态整理成落盘字段，
// 超时未加载完也要如实记录未加载张数，不能假装全部加载成功。

test('computeImageWaitResult：全部加载完成时 unloaded=0', () => {
  const r = computeImageWaitResult({ total: 8, loaded: 8 }, 1200);
  assert.deepEqual(r, {
    images_total: 8,
    images_loaded: 8,
    images_unloaded: 0,
    images_wait_ms: 1200,
  });
});

test('computeImageWaitResult：超时仍有未加载图片时如实记录数量', () => {
  const r = computeImageWaitResult({ total: 10, loaded: 6 }, 15000);
  assert.equal(r.images_total, 10);
  assert.equal(r.images_loaded, 6);
  assert.equal(r.images_unloaded, 4);
  assert.equal(r.images_wait_ms, 15000);
});

test('computeImageWaitResult：页面没有 img（total=0）不报负数/不报错', () => {
  const r = computeImageWaitResult({ total: 0, loaded: 0 }, 300);
  assert.equal(r.images_total, 0);
  assert.equal(r.images_unloaded, 0);
});

test('computeImageWaitResult：loaded 异常大于 total 时钳制到 0（不给负数）', () => {
  const r = computeImageWaitResult({ total: 5, loaded: 9 }, 500);
  assert.equal(r.images_unloaded, 0);
});

test('computeImageWaitResult：status 缺字段/为 null 时按 0 处理', () => {
  const r = computeImageWaitResult(null, 100);
  assert.deepEqual(r, {
    images_total: 0,
    images_loaded: 0,
    images_unloaded: 0,
    images_wait_ms: 100,
  });
});

// ---------------- 登录弹窗"先观察再下结论"（decideLoginState） ----------------
// 背景：闲鱼网页打开时先弹登录框，登录缓存有效时约 3 秒后自动登录、弹框消失、卡片加载。
// 采集器不能一看到弹框就判"需要人工登录"，要原地每秒复查，最多等 LOGIN_SETTLE_MAX_MS。

const POPUP = { loginVisible: true, userVisible: false, cardCount: 0, noResults: false };
const POPUP_WITH_USER = { loginVisible: true, userVisible: true, cardCount: 0, noResults: false };
const READY = { loginVisible: false, userVisible: true, cardCount: 30, noResults: false };
const at = (sig, sec) => ({ ...sig, elapsedMs: sec * 1000 });

// 按时间逐步喂快照，返回每一步的判定，模拟 settleLoginState 的原地复查循环。
function run(seq) {
  const verdicts = [];
  for (let i = 1; i <= seq.length; i++) {
    const v = decideLoginState(seq.slice(0, i));
    verdicts.push(v);
    if (v !== 'wait') break;
  }
  return verdicts;
}

test('常量：原地复查间隔 1 秒、最多等约 12 秒', () => {
  assert.equal(LOGIN_SETTLE_POLL_MS, 1000);
  assert.equal(LOGIN_SETTLE_MAX_MS, 12000);
});

test('decideLoginState：弹框出现 → 3 秒后消失并出卡片 = 继续', () => {
  const seq = [at(POPUP, 0), at(POPUP, 1), at(POPUP, 2), at(READY, 3)];
  assert.deepEqual(run(seq), ['wait', 'wait', 'wait', 'continue']);
});

test('decideLoginState：弹框一直在、没卡片 → 等满 12 秒才判需人工', () => {
  const seq = [];
  for (let s = 0; s <= 12; s++) seq.push(at(POPUP, s));
  const verdicts = run(seq);
  assert.equal(verdicts.length, 13);
  assert.ok(verdicts.slice(0, 12).every((v) => v === 'wait'), '12 秒内都应只等待');
  assert.equal(verdicts[12], 'manual');
});

test('decideLoginState：一开始就没弹框、已登录有卡片 = 直接继续', () => {
  assert.deepEqual(run([at(READY, 0)]), ['continue']);
});

test('decideLoginState：userVisible=true 但弹框还在且无卡片 → 先等待，不判人工也不继续', () => {
  assert.equal(decideLoginState([at(POPUP_WITH_USER, 0)]), 'wait');
  assert.equal(decideLoginState([at(POPUP_WITH_USER, 0), at(POPUP_WITH_USER, 5)]), 'wait');
});

test('decideLoginState：已登录且明确无结果（noResults）= 继续', () => {
  const noRes = { loginVisible: false, userVisible: true, cardCount: 0, noResults: true };
  assert.deepEqual(run([at(POPUP, 0), at(noRes, 2)]), ['wait', 'continue']);
});

test('decideLoginState：已登录但卡片迟迟不出，等满后按原逻辑继续（不误判人工）', () => {
  const loggedNoCards = { loginVisible: false, userVisible: true, cardCount: 0, noResults: false };
  assert.equal(decideLoginState([at(loggedNoCards, 5)]), 'wait');
  assert.equal(decideLoginState([at(loggedNoCards, 12)]), 'continue');
});

test('decideLoginState：实采误判修复——头像可见+有结果卡片时，不管登录弹窗/文案信号，一律继续', () => {
  // 实采信号（2026-09-28）：登录弹窗文案"扫码登录"可见，但头像可见、30 张结果卡片、非无结果页。
  // 用户手动确认页面完全正常、未登录框。说明该文案是页面残留/常驻，不代表未登录。
  const real = { loginVisible: true, userVisible: true, cardCount: 30, noResults: false };
  assert.equal(decideLoginState([at(real, 0)]), 'continue');
});

test('decideLoginState：无头像+弹框+0卡 → 等待后判人工（对照组，不因新规则误放行）', () => {
  const seq = [];
  for (let s = 0; s <= 12; s++) seq.push(at(POPUP, s));
  const verdicts = run(seq);
  assert.equal(verdicts[verdicts.length - 1], 'manual');
});

test('decideLoginState：有头像+弹框+0卡 → 仍先等待（无结果卡片时新规则不生效）', () => {
  assert.equal(decideLoginState([at(POPUP_WITH_USER, 0)]), 'wait');
});

test('decideLoginState：空序列 = 等待', () => {
  assert.equal(decideLoginState([]), 'wait');
  assert.equal(decideLoginState(null), 'wait');
});

// ---------------- 关键词自动切分兜底默认关闭（2026-09-28 改） ----------------
// 背景：原来"原词结果不足"会自动切成更短的词再搜（如「AI老照片修复」切成「修复」），
// 搜出无关结果也照样截图、写进数据摘要。现在默认不切词；--allow-fallback-split 才会
// 尝试候选词；且不管是否切词，都不再有"尽力词"兜底（够不上想要卡阈值就是失败，不凑合）。

test('parseArgs：不传 --allow-fallback-split 时默认关闭切词兜底', () => {
  const a = parseArgs(['--query', 'AI老照片修复', '--out', 'scratch/x']);
  assert.equal(a.allowFallbackSplit, undefined);
});

test('parseArgs：传 --allow-fallback-split 才打开切词兜底', () => {
  const a = parseArgs(['--query', 'AI老照片修复', '--out', 'scratch/x', '--allow-fallback-split']);
  assert.equal(a.allowFallbackSplit, true);
});

test('chooseQuery：唯一一次尝试且想要卡数达标 → 选中它', () => {
  const attempts = [{ query: 'AI老照片修复', noResults: false, cards: [1, 2, 3, 4, 5, 6], wantsCount: 6 }];
  const chosen = chooseQuery(attempts);
  assert.equal(chosen.query, 'AI老照片修复');
});

test('chooseQuery：原词想要卡数不足阈值、默认不切词（只有一次尝试）→ 判失败，不选任何词', () => {
  // 对应默认关闭切词兜底时的真实场景：candidateQueries 只含原词一次。
  const attempts = [{ query: 'AI老照片修复', noResults: false, cards: [1, 2], wantsCount: 2 }];
  assert.equal(chooseQuery(attempts, MIN_WANTS_CARDS), null);
});

test('chooseQuery：不再有"尽力词"兜底——即使某候选词有卡片但都不达标，也一律不选（原来会挑想要卡最多的凑合）', () => {
  const attempts = [
    { query: '修复', noResults: false, cards: [1, 2, 3], wantsCount: 1 },
    { query: '老照片', noResults: false, cards: [1], wantsCount: 0 },
  ];
  assert.equal(chooseQuery(attempts, MIN_WANTS_CARDS), null);
});

test('chooseQuery：原词无结果 → 判失败', () => {
  const attempts = [{ query: 'AI老照片修复', noResults: true, cards: [], wantsCount: 0 }];
  assert.equal(chooseQuery(attempts), null);
});

test('chooseQuery：开启切词兜底时，候选词中第一个达标的会被选中', () => {
  const attempts = [
    { query: 'AI老照片修复', noResults: false, cards: [1, 2], wantsCount: 2 },
    { query: '老照片修复', noResults: false, cards: [1, 2, 3, 4, 5, 6, 7], wantsCount: 7 },
  ];
  const chosen = chooseQuery(attempts, MIN_WANTS_CARDS);
  assert.equal(chosen.query, '老照片修复');
});

test('chooseQuery：空/非法输入不报错，返回 null', () => {
  assert.equal(chooseQuery([]), null);
  assert.equal(chooseQuery(null), null);
  assert.equal(chooseQuery(undefined), null);
});
