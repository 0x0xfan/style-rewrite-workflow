import fs from 'node:fs';
import path from 'node:path';
import { ASSETS_DIR } from '../engine/brief/check-plan.mjs';

const testSlugs = [
  'ai-pinche-qian17',
  'chuangye-jihuashu',
  'topic-mvel3b4v',
  'liaotian-jilu-daochu',
  'topic-mveyf9yv',
  'topic-mveydvi9',
  'topic-mv97gi1y',
  'topic-mvarsxuz',
  'topic-mvarvk18',
  'topic-mvc6r6r6',
  'topic-mveycs7q',
  'topic-mv97f2ll',
  'touping-ruanjian',
  'ai-tishici',
  'ai-upan'
];

for (const s of testSlugs) {
  const p = path.join(ASSETS_DIR, s);
  const factsFile = path.join(p, 'facts.json');
  const topicFile = path.join(p, 'topic.json');
  const t = JSON.parse(fs.readFileSync(topicFile, 'utf8'));
  let facts = null;
  if (fs.existsSync(factsFile)) {
    facts = JSON.parse(fs.readFileSync(factsFile, 'utf8'));
  }
  console.log(`\n=== [${s}] ${t.title || t.name} ===`);
  if (facts) {
    console.log('facts 数据摘要:', JSON.stringify(facts, null, 2).slice(0, 300));
  } else {
    console.log('无 facts.json');
  }
}
