import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// check-all 的开头三项（2026-09-27 开头改按 dbs-hook 三法）：
// R002 前两句要有结果或数据 / R003 合同句前十句内 / R005 路线图停用。
// 跑真 CLI + 真规则表，只看这三行的结果。

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLI = join(ROOT, 'engine', 'brief', 'check-all.mjs');
const TAIL = ['我是圣矾。', '学闲鱼，找圣矾。', '这期视频就到这儿，学闲鱼找圣矾，我们下个视频见。'];

function run(lines, extra = []) {
  const dir = mkdtempSync(join(tmpdir(), 'check-all-opening-'));
  try {
    const f = join(dir, '稿.txt');
    writeFileSync(f, lines.join('\n') + '\n', 'utf8');
    const r = spawnSync(process.execPath, [CLI, f, ...extra], { cwd: ROOT, encoding: 'utf8' });
    assert.notEqual(r.status, 2, r.stderr);
    const row = (id) => {
      const ls = r.stdout.split(/\r?\n/);
      const i = ls.findIndex((l) => l.startsWith(id + ' '));
      assert.ok(i >= 0, `输出里没有 ${id}`);
      const detail = [];
      for (let k = i + 1; k < ls.length && /^\s{9}/.test(ls[k]); k++) detail.push(ls[k]);
      return { line: ls[i], detail: detail.join('\n') };
    };
    return { row };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const status = (line) => (line.match(/structure\s+(\S+(?: \d+)?)/) || [])[1];

test('R002：已售件数挨着「卖出」算数据，通过', () => {
  const { row } = run(['闲鱼上有家店，挂了三百多个大牌，卖出去两千多件，可他真正赚钱的地方不在闲鱼，今天我来给你拆解拆解。', ...TAIL]);
  assert.equal(status(row('R002').line), '通过');
});

test('R002：「一个月能搞到」带用户给的数，通过；第二句才有数不算（2026-10-03 改为第一句）', () => {
  assert.equal(status(run(['淘客这个生意做了快二十年，现在有人把它搬到了闲鱼上，一个月能搞到三万多，今天我来给你拆解拆解。', ...TAIL]).row('R002').line), '通过');
  assert.equal(status(run(['闲鱼上有个很多人不知道的生意。', '考驾照的资料一块钱，有八千五百多个人点了想要。', ...TAIL]).row('R002').line), '命中 1');
});

test('R002：只有商品售价、没有结果数，命中', () => {
  const { row } = run(['官方卖三千多的椅子，闲鱼上有人只挂一千多。', '他靠的是一个淘客生意，今天我给你讲清楚。', ...TAIL]);
  assert.equal(status(row('R002').line), '命中 1');
});

test('R002：结果数在第三句才出现，不算（2026-10-03 改为第一句）', () => {
  const { row } = run(['闲鱼上有个生意。', '今天给你拆解拆解。', '一个月能搞到三万多。', ...TAIL]);
  assert.equal(status(row('R002').line), '命中 1');
});

test('R002：结果数在第四句才出现，不算', () => {
  const { row } = run(['闲鱼上有个生意。', '今天给你拆解拆解。', '先说这是个什么生意。', '一个月能搞到三万多。', ...TAIL]);
  assert.equal(status(row('R002').line), '命中 1');
});

test('R002：--type 经验 时跳过；--type 乱写报参数错', () => {
  const { row } = run(['很多人在闲鱼上架以后没人问，这期讲怎么解决。', ...TAIL], ['--type', '经验']);
  assert.equal(status(row('R002').line), '跳过');
  const r = spawnSync(process.execPath, [CLI, 'x.txt', '--type', '实物'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 2);
});

test('R003：合同句放宽到前十句内', () => {
  const pre = Array.from({ length: 9 }, (_, i) => `第${'一二三四五六七八九'[i]}句，一个月能搞到三万多。`);
  assert.equal(status(run([...pre, ...TAIL]).row('R003').line), '通过');
  const pre10 = [...pre, '第十句。'];
  assert.equal(status(run([...pre10, ...TAIL]).row('R003').line), '命中 1');
});

test('R005：路线图停用，不报命中', () => {
  const { row } = run(['闲鱼上有家店，卖出去两千多件。', ...TAIL]);
  assert.equal(status(row('R005').line), '停用');
});
