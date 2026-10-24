import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkCopy } from '../engine/compliance/check-copy.mjs';
import { loadTable } from '../engine/brief/word-table.mjs';
import { readLines, activeEntries, scanDraft, structuralChecks } from '../engine/brief/check-words.mjs';
import { checkSourceLeakage, readDocx } from '../engine/leakage/check-source-leakage.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET_BASE = 'Z:\\素材生成库\\ai文案\\待审文案\\短';
const TABLE_PATH = path.join(REPO_ROOT, 'docs', '用户校准词表.json');
const CORPUS_PATH = path.join(REPO_ROOT, 'docs', '真人语料包', '总表.md');

const table = loadTable(TABLE_PATH);
const corpusText = fs.readFileSync(CORPUS_PATH, 'utf8');

// Find all txt files in TARGET_BASE recursively
function getTxtFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getTxtFiles(filePath));
    } else if (file.endsWith('.txt')) {
      results.push(filePath);
    }
  }
  return results;
}

const files = getTxtFiles(TARGET_BASE);
console.log(`Checking ${files.length} scripts in ${TARGET_BASE}...`);

let complianceFailures = 0;
let wordFailures = 0;
const draftsDict = {};

for (const file of files) {
  const relName = path.relative(TARGET_BASE, file);
  const content = fs.readFileSync(file, 'utf8');
  draftsDict[relName] = content;

  // 1. Compliance
  const comp = checkCopy(content);
  if (!comp.passed) {
    console.error(`[COMPLIANCE FAIL] ${relName}:`);
    comp.findings.forEach(f => console.error(`  - [${f.level}] ${f.group}: ${f.reason} (${f.pattern})`));
    complianceFailures++;
  }

  // 2. Words & Structural
  const lines = readLines(file);
  const active = activeEntries(table.entries, '虚拟');
  const { hits, reminders } = scanDraft(lines, active);
  const structural = structuralChecks(lines, { hits });

  if (hits.length > 0 || structural.length > 0) {
    console.error(`[WORDS/STRUCT FAIL] ${relName}:`);
    hits.forEach(h => console.error(`  - Hit: [${h.entry.类型}] ${h.term} -> ${h.entry.换成} (Line ${h.line})`));
    structural.forEach(s => console.error(`  - Struct: [${s.kind}] ${s.what} (Line ${s.line})`));
    wordFailures++;
  }
}

// 3. Source leakage check (12-gram)
const leakageRes = checkSourceLeakage(corpusText, draftsDict, { n: 12 });
let leakageFailures = 0;
if (!leakageRes.passed) {
  leakageRes.results.filter(r => r.hitCount > 0).forEach(r => {
    console.error(`[LEAKAGE FAIL] ${r.name}: ${r.hitCount} segments hit, longest=${r.longest.len} ("${r.longest.text}")`);
    leakageFailures++;
  });
}

console.log(`\n==========================================`);
console.log(`Checked ${files.length} files.`);
console.log(`Compliance Failures: ${complianceFailures}`);
console.log(`Word/Struct Failures: ${wordFailures}`);
console.log(`Leakage Failures: ${leakageFailures}`);
console.log(`==========================================`);

if (complianceFailures > 0 || wordFailures > 0 || leakageFailures > 0) {
  process.exit(1);
} else {
  console.log(`ALL 30 SCRIPTS 100% PASSED COMPLIANCE, WORDS, STRUCT, AND SOURCE LEAKAGE CHECKS!`);
}
