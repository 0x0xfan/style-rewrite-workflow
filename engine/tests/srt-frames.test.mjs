import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseArgs,
  parseTimeToSeconds,
  formatClockForFilename,
  parseSignalstats,
  judgeSuspectFrame,
  buildManifestJson,
  buildManifestMarkdown,
} from '../collect/srt-frames.mjs';

// 只测纯函数：不启动 ffmpeg、不碰真实视频文件。

test('parseArgs：解析 --video/--times/--out/--offset，缺必填项报错', () => {
  const a = parseArgs(['--video', 'x.mp4', '--times', '00:01:23,00:02:05', '--out', 'scratch/x']);
  assert.equal(a.video, 'x.mp4');
  assert.deepEqual(a.timeList, ['00:01:23', '00:02:05']);
  assert.equal(a.out, 'scratch/x');
  assert.equal(a.offset, 0.5, '默认偏移 0.5 秒');

  assert.throws(() => parseArgs(['--times', 't', '--out', 'o']), /--video/);
  assert.throws(() => parseArgs(['--video', 'v', '--out', 'o']), /--times/);
  assert.throws(() => parseArgs(['--video', 'v', '--times', 't']), /--out/);
});

test('parseArgs：--offset 支持自定义，非数字报错', () => {
  const a = parseArgs(['--video', 'v', '--times', '0:01', '--out', 'o', '--offset', '1.2']);
  assert.equal(a.offset, 1.2);
  assert.throws(() => parseArgs(['--video', 'v', '--times', 't', '--out', 'o', '--offset', 'abc']), /--offset/);
});

test('parseArgs：--times 里的空白项和多余逗号不影响解析', () => {
  const a = parseArgs(['--video', 'v', '--times', ' 00:01:00 , , 00:02:00 ', '--out', 'o']);
  assert.deepEqual(a.timeList, ['00:01:00', '00:02:00']);
});

test('parseTimeToSeconds：HH:MM:SS / MM:SS / 带小数都能解析', () => {
  assert.equal(parseTimeToSeconds('00:01:23'), 83);
  assert.equal(parseTimeToSeconds('01:00:00'), 3600);
  assert.equal(parseTimeToSeconds('1:23'), 83);
  assert.equal(parseTimeToSeconds('00:01:23.5'), 83.5);
  assert.equal(parseTimeToSeconds('90'), 90);
});

test('parseTimeToSeconds：不认识的格式直接报错', () => {
  assert.throws(() => parseTimeToSeconds('abc'), /格式不认识/);
  assert.throws(() => parseTimeToSeconds('1:2:3:4'), /格式不认识/);
});

test('formatClockForFilename：秒数转文件名安全的 HH-MM-SS，丢小数不四舍五入', () => {
  assert.equal(formatClockForFilename(83), '00-01-23');
  assert.equal(formatClockForFilename(83.9), '00-01-23');
  assert.equal(formatClockForFilename(3661), '01-01-01');
  assert.equal(formatClockForFilename(0), '00-00-00');
});

test('parseSignalstats：从 ffmpeg metadata=print 的文本里取 YLOW/YHIGH/YAVG', () => {
  const text = [
    'frame:0    pts:0       pts_time:0',
    'lavfi.signalstats.YMIN=10',
    'lavfi.signalstats.YLOW=20',
    'lavfi.signalstats.YAVG=128.5',
    'lavfi.signalstats.YHIGH=230',
  ].join('\n');
  const r = parseSignalstats(text);
  assert.equal(r.ylow, 20);
  assert.equal(r.yhigh, 230);
  assert.equal(r.yavg, 128.5);
});

test('parseSignalstats：空文本或解析不到时都返回 null 字段，不报错', () => {
  assert.deepEqual(parseSignalstats(''), { ylow: null, yhigh: null, yavg: null });
  assert.deepEqual(parseSignalstats(null), { ylow: null, yhigh: null, yavg: null });
  assert.deepEqual(parseSignalstats('some unrelated text'), { ylow: null, yhigh: null, yavg: null });
});

test('judgeSuspectFrame：亮度分布很窄判疑似黑帧/转场', () => {
  const r = judgeSuspectFrame({ ylow: 100, yhigh: 105, yavg: 102 });
  assert.equal(r.suspect, true);
  assert.match(r.reason, /亮度分布很窄/);
});

test('judgeSuspectFrame：均值贴近纯黑或纯白也判疑似', () => {
  const black = judgeSuspectFrame({ ylow: 0, yhigh: 60, yavg: 5 });
  assert.equal(black.suspect, true);
  assert.match(black.reason, /很暗/);

  const white = judgeSuspectFrame({ ylow: 200, yhigh: 255, yavg: 250 });
  assert.equal(white.suspect, true);
  assert.match(white.reason, /很亮/);
});

test('judgeSuspectFrame：正常画面（分布宽、均值居中）不判疑似', () => {
  const r = judgeSuspectFrame({ ylow: 10, yhigh: 240, yavg: 120 });
  assert.equal(r.suspect, false);
  assert.equal(r.reason, null);
});

test('judgeSuspectFrame：三项都量不到时不判疑似，但说明原因', () => {
  const r = judgeSuspectFrame({ ylow: null, yhigh: null, yavg: null });
  assert.equal(r.suspect, false);
  assert.match(r.reason, /未量到/);
});

test('buildManifestJson：带 schema_version 和人工隐私检查提示', () => {
  const j = buildManifestJson({ video: 'a.mp4', offset: 0.5, frames: [{ file: 'x.png' }] });
  assert.equal(j.schema_version, '1.0');
  assert.equal(j.video, 'a.mp4');
  assert.equal(j.offset_seconds, 0.5);
  assert.match(j.privacy_note, /昵称、头像、订单号、手机号/);
  assert.equal(j.frames.length, 1);
});

test('buildManifestMarkdown：表头开头有人工检查项提示，每行列出疑似标注', () => {
  const md = buildManifestMarkdown({
    video: 'D:/a/b.mp4',
    offset: 0.5,
    frames: [
      {
        requested_time: '00:01:23', captured_at_seconds: 83.5, file: '帧-00-01-23.png',
        width: 1920, height: 1080, suspect_blank_or_transition: false, suspect_reason: null,
      },
      {
        requested_time: '00:02:00', captured_at_seconds: 120.5, file: '帧-00-02-00.png',
        width: 1920, height: 1080, suspect_blank_or_transition: true, suspect_reason: '亮度分布很窄（YHIGH-YLOW=5.0 ≤ 12），画面接近纯色，像转场或黑场',
      },
    ],
  });
  assert.match(md, /人工检查项/);
  assert.match(md, /昵称、头像、订单号、手机号/);
  assert.match(md, /帧-00-01-23\.png/);
  assert.match(md, /亮度分布很窄/);
  assert.match(md, /1920×1080/);
});
