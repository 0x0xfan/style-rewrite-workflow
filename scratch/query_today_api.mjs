async function main() {
  const res = await fetch('http://localhost:4181/api/today');
  const data = await res.json();
  console.log('unfinishedCounts:', data.unfinishedCounts);

  const unfinished = data.unfinished || [];
  const groups = {};
  for (const item of unfinished) {
    groups[item.group] = (groups[item.group] || 0) + 1;
  }
  console.log('unfinished group 统计:', groups);

  const queued = unfinished.filter(x => x.group === 'queued');
  console.log(`\n=== 等待出片（queued）总计: ${queued.length} 条 ===`);
  queued.forEach((it, idx) => {
    const copy = it.copy || {};
    const date = it.firstDispatchedOn || copy.meta?.date || '-';
    console.log(`${idx + 1}. [${date}] #${copy.no || '-'} 【${it.label || it.skin || '-'}】 标题:「${copy.title || copy.file}」 确认时间: ${it.confirmedAt || copy.queue?.confirmedAt || '-'}`);
  });

  const blocked = unfinished.filter(x => x.group === 'blocked');
  if (blocked.length > 0) {
    console.log(`\n=== 缺截图（blocked）总计: ${blocked.length} 条 ===`);
    blocked.forEach((it, idx) => {
      const copy = it.copy || {};
      console.log(`${idx + 1}. #${copy.no || '-'} 【${it.label}】 标题:「${copy.title || copy.file}」 缺 ${it.missingScreenshots} 张截图`);
    });
  }

  const running = unfinished.filter(x => x.group === 'running');
  if (running.length > 0) {
    console.log(`\n=== 出片中（running）总计: ${running.length} 条 ===`);
    running.forEach((it, idx) => {
      const copy = it.copy || {};
      console.log(`${idx + 1}. #${copy.no || '-'} 【${it.label}】 标题:「${copy.title || copy.file}」`);
    });
  }

  // 同时也查查 copy-ledger 中有多少个 confirmed
  const ledgerRes = await fetch('http://localhost:4181/api/copy-ledger');
  const ledgerData = await ledgerRes.json();
  const confirmedCopies = (ledgerData.copies || []).filter(c => c.queue?.state === 'confirmed');
  console.log(`\n=== 文案台账中 state === 'confirmed' 的文案数: ${confirmedCopies.length} 条 ===`);
  if (confirmedCopies.length !== queued.length) {
    console.log(`差异分析：ledger confirmed: ${confirmedCopies.length}, unfinished queued: ${queued.length}`);
    confirmedCopies.forEach((c, idx) => {
      console.log(`${idx + 1}. #${c.no} [${c.meta?.date || '-'}] 【${c.queue?.skin || c.meta?.skin} ${c.queue?.orientation || c.meta?.orientation}】 标题:「${c.title || c.file}」 assetCheck verdict: ${c.assetCheck?.verdict || '无'}`);
    });
  }
}

main().catch(console.error);
