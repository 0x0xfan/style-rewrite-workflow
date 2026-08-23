import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';
import { checkAiFlavor, inferIp, splitSentences } from '../naturalness/check-ai-flavor.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');

// 用长度稀释密度：给一段无标点、无破折号的中性正文，把每千字率压到阈值以下。
const filler = '这段是用来稀释密度的中性正文写得平实一些让每千字的比率不会被拉高到触发闸门的程度我们只想单独测某一个指标而不受其它指标干扰所以把它写得足够长又不带任何标点符号和破折号'.repeat(3);

test('破折号超标报 block', () => {
  const r = checkAiFlavor('有个东西不占地方——就是餐饮券。' + filler);
  assert.ok(r.metrics.dashPer1000.value > r.metrics.dashPer1000.max, '破折号密度应超阈值');
  assert.equal(r.passed, false);
  assert.ok(r.findings.some((f) => f.metric === 'dashPer1000' && f.level === 'block'));
});

test('总结壳被计数并（超阈值时）报 block', () => {
  const r = checkAiFlavor('说白了这就是信息差。核心是你得先搞清楚。一句话别贪便宜。');
  assert.equal(r.metrics.summaryShellPer1000.raw, 4, '应数出 说白了/这就是/核心是/一句话 共四处');
  // 短文本里 4 个总结壳密度极高，必然超 0.6/千字
  assert.ok(r.metrics.summaryShellPer1000.value > 0.6);
  assert.ok(r.findings.some((f) => f.metric === 'summaryShellPer1000' && f.level === 'block'));
});

test('悬空"的"命中：只收说得清出处的。', () => {
  const r = checkAiFlavor('只收说得清出处的。' + filler);
  assert.equal(r.metrics.danglingDeCount.value, 1);
  assert.ok(r.metrics.danglingDeCount.samples[0].includes('只收说得清出处的'));
  assert.equal(r.passed, false, '悬空"的" >0 应 block');
});

test('悬空"的"不命中：我拿的是最便宜的券。（有中心词"券"收尾）', () => {
  const r = checkAiFlavor('我拿的是最便宜的券。' + filler);
  assert.equal(r.metrics.danglingDeCount.value, 0);
});

test('"不是…是…"句壳计数', () => {
  const r = checkAiFlavor('这不是倒券，是拿时间换差价。它不是躺着收钱，而是辛苦活。' + filler);
  assert.equal(r.metrics.notButShellCount.value, 2);
});

test('半佛：句长 CV 过低门禁（block）', () => {
  // 全是清一色等长短句，CV 很低。
  const even = '券要说清楚来路。渠道也要盯紧。号别乱操作。挂价随手定好。售后自己扛住。价格写在明面。买家问了就答。';
  const r = checkAiFlavor(even, { ip: '半佛' });
  assert.ok(r.metrics.sentenceCvMin.gated, '半佛应门禁句长');
  assert.ok(r.metrics.sentenceCvMin.value < 0.7);
  assert.ok(r.findings.some((f) => f.metric === 'sentenceCvMin' && f.level === 'block'), '半佛低 CV 应报 block');
});

test('钱十七：句长不门禁（CV 低也不产生 finding）', () => {
  const even = '券要说清楚来路。渠道也要盯紧。号别乱操作。挂价随手定好。售后自己扛住。价格写在明面。买家问了就答。';
  const r = checkAiFlavor(even, { ip: '钱十七' });
  assert.equal(r.metrics.sentenceCvMin.gated, false, '钱十七不门禁句长');
  assert.ok(r.metrics.sentenceCvMin.value < 0.7, '前提：这段 CV 确实很低');
  assert.equal(r.findings.some((f) => f.metric === 'sentenceCvMin'), false, '钱十七不应因句长 CV 产生 finding');
});

test('连续反问：最长串长度与门禁', () => {
  const q = '券哪来？渠道稳吗？说得清吗？平台信谁？我图啥？';
  const half = checkAiFlavor(q + filler, { ip: '半佛' }); // 半佛上限 4
  assert.equal(half.metrics.consecutiveQuestions.value, 5);
  assert.ok(half.findings.some((f) => f.metric === 'consecutiveQuestions' && f.level === 'block'));
});

test('IP 自动识别：从 ips/<IP>/ 路径推断', () => {
  assert.equal(inferIp('ips/钱十七/outputs/闲鱼餐饮券-短视频版.md'), '钱十七');
  assert.equal(inferIp('ips\\半佛\\outputs\\闲鱼餐饮券-长视频版.md'), '半佛');
  assert.equal(inferIp('engine/fixtures/batch-test-20260822/02-账号养号基础.md'), undefined, '无 ips 段应回落 undefined→default');
});

test('未指定 IP 回落 default，且 default 门禁句长', () => {
  const r = checkAiFlavor('券要说清楚来路。渠道也要盯紧。号别乱操作。挂价随手定好。', {});
  assert.equal(r.ip, 'default');
  assert.equal(r.metrics.sentenceCvMin.gated, true);
});

test('切句：段落换行也作句界', () => {
  const s = splitSentences('第一句没有句号\n第二句。第三句？');
  assert.equal(s.length, 3);
  assert.equal(s[1].end, '。');
  assert.equal(s[2].end, '？');
});

// 信息性用例：只打印四篇交付稿现状，不断言。它们当前会 FAIL，这正是后续要改的清单。
test('交付稿 AI 味现状（信息性，不断言）', () => {
  const drafts = [
    ['钱十七', '闲鱼餐饮券-长视频版.md'],
    ['钱十七', '闲鱼餐饮券-短视频版.md'],
    ['半佛', '闲鱼餐饮券-长视频版.md'],
    ['半佛', '闲鱼餐饮券-短视频版.md']
  ];
  for (const [ip, name] of drafts) {
    const p = join(repo, 'ips', ip, 'outputs', name);
    if (!existsSync(p)) continue;
    const r = checkAiFlavor(readFileSync(p, 'utf8'), { ip });
    console.log(`  [信息] ${ip}/${name}: ${r.passed ? 'PASS' : 'FAIL'} block=${r.blockCount} warn=${r.warnCount} ` +
      `破折号=${r.metrics.dashPer1000.value.toFixed(2)} 悬空的=${r.metrics.danglingDeCount.value} 连问=${r.metrics.consecutiveQuestions.value} CV=${r.metrics.sentenceCvMin.value.toFixed(2)}`);
  }
  assert.ok(true);
});
