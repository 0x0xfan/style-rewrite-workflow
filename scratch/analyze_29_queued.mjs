import fs from 'fs';
import path from 'path';

async function main() {
  const res = await fetch('http://localhost:4181/api/copy-ledger');
  const data = await res.json();
  const copies = data.copies || [];

  const queued = copies.filter(c => c.queue?.state === 'confirmed');
  const running = copies.filter(c => c.queue?.state === 'running');

  console.log(`\n=== 队列总览：queued (等待出片): ${queued.length} 条 | running (出片中): ${running.length} 条 ===\n`);

  // 按日期归类统计
  const byDate = {};
  for (const c of queued) {
    const d = c.meta?.date || c.firstDispatchedOn || '未知日期';
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(c);
  }

  console.log('--- 按文案日期分布 ---');
  for (const [d, list] of Object.entries(byDate).sort()) {
    console.log(`【${d}】: ${list.length} 篇`);
  }

  console.log('\n--- 29 条等待出片清单明细 ---');
  queued.sort((a, b) => (a.meta?.date || '').localeCompare(b.meta?.date || '') || (a.no - b.no));
  queued.forEach((c, idx) => {
    const skin = c.queue?.skin || c.meta?.skin || '未定';
    const ori = c.queue?.orientation || c.meta?.orientation || '未定';
    const confTime = c.queue?.confirmedAt ? new Date(c.queue.confirmedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '未知';
    console.log(`${String(idx + 1).padStart(2, '0')}. [#${c.no}] 日期: ${c.meta?.date || '-'} | 皮肤: ${skin} (${ori}) | 选题:「${c.title}」`);
    console.log(`    文件: ${c.file}`);
    console.log(`    确认时间: ${confTime}`);
  });

  if (running.length > 0) {
    console.log('\n--- 2 条 running (出片中) 明细 ---');
    running.forEach((c, idx) => {
      console.log(`${idx + 1}. [#${c.no}] 选题:「${c.title}」 | 皮肤: ${c.queue?.skin} (${c.queue?.orientation}) | 状态: running`);
    });
  }
}

main().catch(console.error);
