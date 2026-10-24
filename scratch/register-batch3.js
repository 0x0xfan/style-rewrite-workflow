import { execSync } from 'node:child_process';
import fs from 'node:fs';

const items = [
  {
    id: '20261011-买家拍下不付款该怎么催-chat-v',
    topic: '买家拍下不付款该怎么催',
    film: 'chat-maijia-baixia-bufukuan',
    draft: 'scratch/聊天记录式/20261011-买家拍下不付款该怎么催-chat-v.txt',
    angle: '粉丝请教买家拍下不付款的催单话术与库存释放',
    style: '常规',
    note: '聊天记录式短视频；账号 chat-v；lengthTarget 1-2min；素材 闲鱼经验库 X-售后-027、X-客服-029；NAS Z:/素材生成库/ai文案/待审文案/买家拍下不付款该怎么催/20261011-买家拍下不付款该怎么催-chat-v.txt'
  },
  {
    id: '20261011-为什么商品主图千万不能用白底电商图-selfie-01',
    topic: '为什么商品主图千万不能用白底电商图',
    film: 'selfie-zhutu-baidi-01',
    draft: 'scratch/20261011-为什么商品主图千万不能用白底电商图-selfie-01.txt',
    angle: '真人出镜主图烟火气与信任感',
    style: '常规',
    note: '真人出镜；账号 selfie-01；lengthTarget 1-2min；素材 闲鱼经验库 X-上架-025、X-上架-024；NAS Z:/素材生成库/ai文案/待审文案/为什么商品主图千万不能用白底电商图/20261011-为什么商品主图千万不能用白底电商图-selfie-01.txt'
  },
  {
    id: '20261011-新账号第一周每天上几个品最稳妥-selfie-02',
    topic: '新账号第一周每天上几个品最稳妥',
    film: 'selfie-shangpin-jiezou-02',
    draft: 'scratch/20261011-新账号第一周每天上几个品最稳妥-selfie-02.txt',
    angle: '真人出镜新账号起步上新节奏与算法赛马',
    style: '常规',
    note: '真人出镜；账号 selfie-02；lengthTarget 1-2min；素材 闲鱼经验库 X-上架-042、X-上架-002；NAS Z:/素材生成库/ai文案/待审文案/新账号第一周每天上几个品最稳妥/20261011-新账号第一周每天上几个品最稳妥-selfie-02.txt'
  },
  {
    id: '20261011-测款测了几天没动静到底该不该放弃-selfie-03',
    topic: '测款测了几天没动静到底该不该放弃',
    film: 'selfie-cekuan-fangqi-03',
    draft: 'scratch/20261011-测款测了几天没动静到底该不该放弃-selfie-03.txt',
    angle: '真人出镜测款周期与漏斗数据排查',
    style: '常规',
    note: '真人出镜；账号 selfie-03；lengthTarget 1-2min；素材 闲鱼经验库 X-上架-010、X-上架-039、X-上架-002；NAS Z:/素材生成库/ai文案/待审文案/测款测了几天没动静到底该不该放弃/20261011-测款测了几天没动静到底该不该放弃-selfie-03.txt'
  }
];

for (const item of items) {
  const cmd = `node engine/return/registry.mjs add --id "${item.id}" --version v1 --topic "${item.topic}" --film "${item.film}" --draft "${item.draft}" --angle "${item.angle}" --date 2026-10-11 --style "${item.style}" --note "${item.note}"`;
  console.log('Registering:', item.id);
  const out = execSync(cmd, { encoding: 'utf8' });
  console.log(out.trim());
}

console.log('\nAll registered in registry!');
