import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  parseArgs,
  matchEpisodeName,
  episodeTitle,
  decodeText,
  parseSrt,
  formatTs,
  cuesToTranscript,
  pickFiles,
  run,
} from '../brief/srt-find.mjs';

// 纯函数 + 本地临时目录，不碰 NAS。

test('parseArgs：必填 --episode（数字）和 --out', () => {
  const a = parseArgs(['--episode', '047', '--out', 'x']);
  assert.equal(a.episode, '47');
  assert.equal(a.out, 'x');
  assert.throws(() => parseArgs(['--out', 'x']), /--episode/);
  assert.throws(() => parseArgs(['--episode', '淘客', '--out', 'x']), /--episode/);
  assert.throws(() => parseArgs(['--episode', '47']), /--out/);
});

test('matchEpisodeName：按期号精确匹配目录名', () => {
  assert.ok(matchEpisodeName('47.淘客', '47'));
  assert.ok(matchEpisodeName('13.重', '13'));
  assert.ok(matchEpisodeName('47淘客', 47));
  assert.ok(matchEpisodeName('047.淘客', '47'));
  assert.ok(!matchEpisodeName('147.x', '47'));
  assert.ok(!matchEpisodeName('4.x', '47'));
  assert.ok(!matchEpisodeName('47', '4'));
  assert.ok(!matchEpisodeName('投流视频2', '2'));
  assert.ok(!matchEpisodeName('圣矾混剪02', '2'));
});

test('episodeTitle：去掉期号', () => {
  assert.equal(episodeTitle('47.淘客'), '淘客');
  assert.equal(episodeTitle('32.网盘拉新揭秘'), '网盘拉新揭秘');
  assert.equal(episodeTitle('13'), '13');
});

test('decodeText：UTF-8 BOM / UTF-16LE / GBK', () => {
  assert.equal(decodeText(Buffer.from([0xef, 0xbb, 0xbf, ...Buffer.from('你好')])), '你好');
  const le = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('你好', 'utf16le')]);
  assert.equal(decodeText(le), '你好');
  assert.equal(decodeText(Buffer.from([0xc4, 0xe3, 0xba, 0xc3])), '你好'); // GBK
});

test('parseSrt：CRLF、多行合并、去标签、跳过空条', () => {
  const srt = '﻿1\r\n00:00:00,000 --> 00:00:00,766\r\n各位小伙伴们\r\n\r\n'
    + '2\r\n00:01:23,450 --> 00:01:25,000\r\n<i>一单</i>赚\r\n{\\an8}两块\r\n\r\n'
    + '3\r\n00:01:26,000 --> 00:01:27,000\r\n\r\n\r\n'
    + '4\n01:02:03.5 --> 01:02:04.000\n最后一句\n';
  const cues = parseSrt(srt);
  assert.equal(cues.length, 3);
  assert.deepEqual(cues[0], { index: 1, startMs: 0, endMs: 766, text: '各位小伙伴们' });
  assert.equal(cues[1].text, '一单赚 两块');
  assert.equal(cues[1].startMs, 83450);
  assert.equal(cues[2].index, 4);
  assert.equal(cues[2].startMs, 3723500);
});

test('formatTs / cuesToTranscript', () => {
  assert.equal(formatTs(0), '00:00:00');
  assert.equal(formatTs(83999), '00:01:23');
  assert.equal(formatTs(3723500), '01:02:03');
  const txt = cuesToTranscript([{ startMs: 83450, text: '一单两块' }, { startMs: 90000, text: '第二句' }]);
  assert.equal(txt, '[00:01:23] 一单两块\n[00:01:30] 第二句\n');
  assert.equal(cuesToTranscript([]), '');
});

test('pickFiles：同名 mp4 优先，UUID 杂 mp4 不干扰', () => {
  const r = pickFiles(['淘客/4dd3.mp4', '淘客/6a13.mp4', '淘客/淘客.mp4', '淘客/淘客.srt']);
  assert.equal(r.srt.pick, '淘客/淘客.srt');
  assert.equal(r.mp4.status, 'same-name');
  assert.equal(r.mp4.pick, '淘客/淘客.mp4');
});

test('pickFiles：同目录只有一个 mp4 名字不同 → only-one；多个且无同名 → many 不猜', () => {
  const a = pickFiles(['1121.srt', '2.mp4']);
  assert.equal(a.mp4.status, 'only-one');
  assert.equal(a.mp4.pick, '2.mp4');
  const b = pickFiles(['x.srt', 'a.mp4', 'b.mp4']);
  assert.equal(b.mp4.status, 'many');
  assert.equal(b.mp4.pick, null);
  assert.deepEqual(b.mp4.candidates, ['a.mp4', 'b.mp4']);
});

test('pickFiles：外层 mp4 和子目录 srt 同名时取同目录的', () => {
  const r = pickFiles(['20.驾考.mp4', '20.驾考/20.驾考.mp4', '20.驾考/20.驾考.srt']);
  assert.equal(r.mp4.pick, '20.驾考/20.驾考.mp4');
});

test('pickFiles：没有 srt / 多个 srt / 没有 mp4', () => {
  assert.equal(pickFiles(['19.mp4']).srt.status, 'none');
  assert.equal(pickFiles(['a.srt', 'b/b.srt']).srt.status, 'many');
  const r = pickFiles(['a.srt']);
  assert.equal(r.srt.status, 'ok');
  assert.equal(r.mp4.status, 'none');
});

test('run：本地假根目录端到端（找到 / 找不到 / 多个候选）', () => {
  const root = mkdtempSync(join(tmpdir(), 'srt-find-'));
  try {
    mkdirSync(join(root, '47.淘客', '淘客'), { recursive: true });
    writeFileSync(join(root, '47.淘客', '淘客', '淘客.srt'), '1\n00:00:05,700 --> 00:00:06,766\n淘客新路子\n');
    mkdirSync(join(root, '19.聊天恢复'), { recursive: true });
    writeFileSync(join(root, '19.聊天恢复', 'a.mp4'), '');
    mkdirSync(join(root, '5.a'));
    mkdirSync(join(root, '5.b'));
    writeFileSync(join(root, '12.x.mp4'), '');

    const out = join(root, 'out');
    const logs = [];
    const quiet = (m) => logs.push(m);
    assert.equal(run(['--episode', '47', '--out', out, '--root', root], quiet, quiet), 0);
    assert.equal(readFileSync(join(out, '字幕.txt'), 'utf8'), '[00:00:05] 淘客新路子\n');
    assert.ok(logs.some((l) => l.includes('mp4：没找到')));

    assert.equal(run(['--episode', '19', '--out', out, '--root', root], quiet, quiet), 1);
    assert.equal(run(['--episode', '5', '--out', out, '--root', root], quiet, quiet), 1);
    assert.equal(run(['--episode', '12', '--out', out, '--root', root], quiet, quiet), 1);
    assert.equal(run(['--episode', '99', '--out', out, '--root', root], quiet, quiet), 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
