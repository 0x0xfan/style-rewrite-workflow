import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const validator = resolve('style-engine/skills/style-copywriter/scripts/validate-generation-inputs.mjs');
const digest = text => createHash('sha256').update(text, 'utf8').digest('hex');
const canonical = value => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

function fixture(mutator = () => {}) {
  const dir = mkdtempSync(join(tmpdir(), 'style-preflight-'));
  const calibrationText = '# Human calibration\n\nApproved hook and rejected AI shell.\n';
  const styleLocks = {
    schema_version: '1.0',
    lock_id: 'lock-t01',
    calibration_source: {
      path: 'calibration.md',
      sha256: digest(calibrationText)
    },
    preserve_exact: [{ id: 'keep-hook', text: '具体项目先摆出来' }],
    rejected_exact: [{ id: 'reject-ai', text: '你不用一开始都会，先练最简单的，就能开始' }],
    hook_duties: [{
      id: 'hook-01', hook_excerpt: '具体项目先摆出来', delivery_excerpt: '第一块把动作跑通',
      max_paragraph_gap: 1, evidence_ids: ['e01']
    }]
  };
  const styleLocksText = `${JSON.stringify(styleLocks, null, 2)}\n`;
  const role = {
    narrator: '项目筛选者',
    target_viewer: {
      goal: '测试闲鱼技术服务机会',
      starting_state: { codex_delivery_capability: 'absent' },
      excluded_assumptions: ['already_can_install', 'already_can_troubleshoot']
    },
    case_buyer: { problem: '安装受阻' },
    content_goal: '解释如何验证基础安装服务'
  };
  const gate = {
    required_slots: [
      { id: 'screening_value', allowed_states: ['verified'] },
      { id: 'test_action', allowed_states: ['test_only'] }
    ],
    slots: [
      { id: 'screening_value', state: 'verified', evidence_ids: ['e01'], claim_scope: 'market_presence' },
      { id: 'test_action', state: 'test_only', evidence_ids: ['e02'], claim_scope: 'publish_test_only' }
    ]
  };
  const task = {
    schema_version: '1.0',
    task_id: 't01',
    user_requirement: { verbatim: '面向尚不会 Codex 交付、想测试闲鱼机会的人' },
    content_mode: 'feasibility_screening',
    selected_framework: 'fw-screening-tutorial',
    style_profile_status: 'draft_review_only',
    requires_style_acceptance_lock: true,
    style_acceptance_lock: { path: 'style-locks.json', sha256: digest(styleLocksText) },
    comparison_plan: { baseline_output: 'baseline.md', enhanced_output: 'enhanced.md' },
    narrative_role_lock: structuredClone(role),
    evidence_registry: [
      { id: 'e01', status: 'verified', locator: 'market.png', supports: ['screening_value'] },
      { id: 'e02', status: 'test_only', locator: 'plan.md', supports: ['test_action'] }
    ],
    framework_gate: gate
  };
  const taskText = `${JSON.stringify(task, null, 2)}\n`;
  const taskHash = digest(taskText);
  const alignment = {
    task_id: task.task_id,
    task_brief_sha256: taskHash,
    content_mode: task.content_mode,
    selected_framework: task.selected_framework,
    narrative_role_lock: structuredClone(role)
  };
  const contract = `# Contract\n\n<!-- style-copywriter-task-alignment\n${JSON.stringify(alignment, null, 2)}\n-->\n`;
  const knowledge = {
    schema_version: '1.0',
    query: { topic: 'Codex install' },
    minimum_used_sources: 1,
    sources: [{
      id: 'k01', title: 'Official install', locator: 'https://example.test', excerpt: 'install',
      allowed_uses: ['method'],
      relevance: {
        task_brief_sha256: taskHash,
        allowed_stances: ['support'],
        allowed_sections: ['learning_path'],
        core_claim_compatible: true
      }
    }]
  };
  const metadata = {
    style_status: 'draft_review_only',
    delivery_status: 'evaluation_only',
    acceptance_status: 'pending_user_review',
    validation_status: 'pending',
    style_acceptance_status: 'pending_user_review',
    style_acceptance_lock: { lock_id: styleLocks.lock_id, sha256: digest(styleLocksText) },
    requires_baseline_enhanced_comparison: true,
    comparison_plan: { baseline_output: 'baseline.md', enhanced_output: 'enhanced.md', status: 'planned' },
    framework_used: task.selected_framework,
    framework_gate_sha256: digest(canonical(gate)),
    task_alignment: structuredClone(alignment),
    knowledge_sources_used: [{
      source_id: 'k01', section: 'learning_path', use_as: 'method', stance: 'support'
    }]
  };
  const bundle = { task, taskText, alignment, contract, knowledge, metadata, dir, calibrationText, styleLocks, styleLocksText };
  mutator(bundle);
  bundle.taskText = `${JSON.stringify(bundle.task, null, 2)}\n`;
  const taskPath = join(dir, 'task.json');
  const contractPath = join(dir, 'contract.md');
  const knowledgePath = join(dir, 'knowledge.json');
  const metadataPath = join(dir, 'metadata.json');
  const reportPath = join(dir, 'report.md');
  writeFileSync(taskPath, bundle.taskText);
  writeFileSync(contractPath, bundle.contract);
  writeFileSync(knowledgePath, JSON.stringify(bundle.knowledge, null, 2));
  writeFileSync(metadataPath, JSON.stringify(bundle.metadata, null, 2));
  writeFileSync(join(dir, 'calibration.md'), bundle.calibrationText);
  writeFileSync(join(dir, 'style-locks.json'), bundle.styleLocksText);
  return { taskPath, contractPath, knowledgePath, metadataPath, reportPath };
}

function run(paths, expectFailure = false) {
  try {
    const stdout = execFileSync(process.execPath, [validator,
      '--task', paths.taskPath,
      '--contract', paths.contractPath,
      '--knowledge', paths.knowledgePath,
      '--metadata', paths.metadataPath,
      '--report', paths.reportPath
    ], { encoding: 'utf8' });
    if (expectFailure) assert.fail(`expected failure, got ${stdout}`);
    return JSON.parse(stdout);
  } catch (error) {
    if (!expectFailure) throw error;
    return readFileSync(paths.reportPath, 'utf8');
  }
}

test('generation preflight accepts a fully bound task, gate and knowledge plan', () => {
  const result = run(fixture());
  assert.equal(result.status, 'passed');
});

test('generation preflight rejects role drift even when beginner-like words could be added', () => {
  const paths = fixture(bundle => {
    bundle.metadata.task_alignment.narrative_role_lock.target_viewer.starting_state.codex_delivery_capability = 'present';
  });
  const report = run(paths, true);
  assert.match(report, /任务语义锁不一致/u);
});

test('generation preflight rejects a framework whose required slot is unverified', () => {
  const paths = fixture(bundle => {
    bundle.task.framework_gate.slots[1].state = 'unverified';
    const newTaskText = `${JSON.stringify(bundle.task, null, 2)}\n`;
    const newHash = digest(newTaskText);
    bundle.contract = bundle.contract.replace(bundle.alignment.task_brief_sha256, newHash);
    bundle.metadata.task_alignment.task_brief_sha256 = newHash;
    bundle.knowledge.sources[0].relevance.task_brief_sha256 = newHash;
    bundle.metadata.framework_gate_sha256 = digest(canonical(bundle.task.framework_gate));
  });
  const report = run(paths, true);
  assert.match(report, /test_action/u);
});

test('generation preflight rejects counterevidence used as the core mechanism', () => {
  const paths = fixture(bundle => {
    bundle.knowledge.sources[0].allowed_uses = ['method', 'risk'];
    bundle.knowledge.sources[0].relevance.allowed_stances = ['support', 'counterevidence'];
    bundle.metadata.knowledge_sources_used[0].stance = 'counterevidence';
    bundle.metadata.knowledge_sources_used[0].use_as = 'method';
  });
  const report = run(paths, true);
  assert.match(report, /stance_misuse/u);
});

test('generation preflight rejects a user-rejected plan before generation', () => {
  const paths = fixture(bundle => {
    bundle.metadata.delivery_status = 'rejected_by_user';
    bundle.metadata.acceptance_status = 'failed_user_rejected';
  });
  const report = run(paths, true);
  assert.match(report, /用户拒绝状态/u);
});

test('generation preflight rejects a changed calibration source behind a stale style lock', () => {
  const paths = fixture(bundle => {
    bundle.calibrationText += 'Changed after approval.\n';
  });
  const report = run(paths, true);
  assert.match(report, /人工校准/u);
});

test('generation preflight rejects a draft profile without a fresh comparison plan', () => {
  const paths = fixture(bundle => {
    delete bundle.metadata.comparison_plan;
  });
  const report = run(paths, true);
  assert.match(report, /Baseline\/Enhanced/u);
});

test('generation preflight rejects reuse of an old passed validation state after structural change', () => {
  const paths = fixture(bundle => {
    bundle.metadata.validation_status = 'passed_from_old_copy';
  });
  const report = run(paths, true);
  assert.match(report, /旧 validation\/style acceptance 状态未重置/u);
});
