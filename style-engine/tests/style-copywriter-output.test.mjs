import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const validator = resolve('style-engine/skills/style-copywriter/scripts/validate-generated-copy.mjs');
const digest = text => createHash('sha256').update(text, 'utf8').digest('hex');

function enableStyleAcceptance(bundle) {
  bundle.styleLocks = {
    schema_version: '1.0',
    lock_id: 'lock-output-01',
    preserve_exact: [{ id: 'keep-hook', text: '具体项目先摆出来' }],
    preserve_semantic: [{ id: 'keep-action', all_of: ['第一块', '动作跑通'] }],
    rejected_exact: [{ id: 'reject-generic', text: '你不用一开始都会，先练最简单的，就能开始' }],
    forbidden_patterns: [{
      id: 'generic-reassurance-shell',
      pattern: '你不用[^。！？]{0,60}先[^。！？]{0,60}就能',
      flags: 'u',
      max_occurrences: 0
    }],
    hook_duties: [{
      id: 'hook-01',
      hook_excerpt: '具体项目先摆出来',
      delivery_excerpt: '第一块把动作跑通',
      max_paragraph_gap: 0,
      evidence_ids: ['e01']
    }],
    content_allocation: { max_supporting_share: 0.5 }
  };
  bundle.baseline = '# Baseline\n\n项目是什么，动作是什么，然后发布测试。';
  bundle.metadata.requires_style_acceptance_audit = true;
  bundle.metadata.style_acceptance_status = 'pending_user_review';
  bundle.metadata.requires_baseline_enhanced_comparison = true;
  bundle.metadata.content_allocation_audit = { supporting_excerpts: ['第二块把服务写清楚'] };
}

function fixture(mutator = () => {}) {
  const dir = mkdtempSync(join(tmpdir(), 'style-output-'));
  const copy = '# 测试口播\n\n具体项目先摆出来，这期分三块讲清楚。第一块把动作跑通，第二块把服务写清楚，最后再发布测试。这里用一条来自知识包的方法补充解释，随后继续给出动作。为了保证测试长度，这里再补充一段只属于目标内容的普通说明，不引用任何风格样本原句，也不添加项目收益、订单或平台背书。';
  const contract = '# Contract\n\n<!-- style-copywriter-validation\n{"required_literals":[],"required_groups":[],"forbidden_terms":[]}\n-->\n';
  const knowledge = {
    schema_version: '1.0',
    query: { topic: 'test' },
    minimum_used_sources: 1,
    sources: [{
      id: 'k01', title: 'method', locator: 'local:test', excerpt: 'method', allowed_uses: ['method']
    }]
  };
  const metadata = {
    requires_style_application_audit: true,
    required_style_controls: ['A1', 'A2'],
    rules_applied: ['P1'],
    style_application: {
      controls: [
        { rule_id: 'A1', purpose: 'hook', output_excerpt: '具体项目先摆出来' },
        { rule_id: 'A2', purpose: 'route', output_excerpt: '这期分三块讲清楚' },
        { rule_id: 'P1', purpose: 'bounded pattern', output_excerpt: '第一块把动作跑通' }
      ]
    },
    knowledge_sources_used: [{
      source_id: 'k01', section: 'body', use_as: 'method', output_excerpt: '一条来自知识包的方法补充解释'
    }]
  };
  const bundle = { copy, contract, knowledge, metadata, styleLocks: null, baseline: null };
  mutator(bundle);
  const paths = {
    copy: join(dir, 'copy.md'), contract: join(dir, 'contract.md'), knowledge: join(dir, 'knowledge.json'),
    metadata: join(dir, 'metadata.json'), report: join(dir, 'report.md')
  };
  writeFileSync(paths.copy, bundle.copy);
  writeFileSync(paths.contract, bundle.contract);
  writeFileSync(paths.knowledge, JSON.stringify(bundle.knowledge));
  if (bundle.styleLocks) {
    const lockText = `${JSON.stringify(bundle.styleLocks, null, 2)}\n`;
    const baselineText = bundle.baseline;
    const enhancedText = bundle.copy;
    writeFileSync(join(dir, 'style-locks.json'), lockText);
    writeFileSync(join(dir, 'baseline.md'), baselineText);
    writeFileSync(join(dir, 'enhanced.md'), enhancedText);
    bundle.metadata.style_acceptance_lock = {
      path: 'style-locks.json', lock_id: bundle.styleLocks.lock_id, sha256: digest(lockText)
    };
    bundle.metadata.comparison_audit = {
      status: 'completed_pending_user_review',
      selected_output: 'enhanced',
      baseline_path: 'baseline.md',
      enhanced_path: 'enhanced.md',
      baseline_sha256: digest(baselineText),
      enhanced_sha256: digest(enhancedText),
      dimensions: ['opening', 'structure', 'oral_voice', 'evidence']
    };
  }
  writeFileSync(paths.metadata, JSON.stringify(bundle.metadata));
  return paths;
}

function run(paths, expectFailure = false) {
  try {
    const stdout = execFileSync(process.execPath, [validator,
      '--contract', paths.contract, '--knowledge', paths.knowledge, '--metadata', paths.metadata,
      '--copy', paths.copy, '--report', paths.report
    ], { encoding: 'utf8' });
    if (expectFailure) assert.fail(`expected failure, got ${stdout}`);
    return JSON.parse(stdout);
  } catch (error) {
    if (!expectFailure) throw error;
    return readFileSync(paths.report, 'utf8');
  }
}

test('output validator traces every required and declared style rule to real copy', () => {
  const result = run(fixture());
  assert.equal(result.failures, 0);
});

test('output validator rejects style rules that exist only in metadata', () => {
  const paths = fixture(bundle => {
    bundle.metadata.style_application.controls = bundle.metadata.style_application.controls
      .filter(item => item.rule_id !== 'P1');
  });
  const report = run(paths, true);
  assert.match(report, /rules_applied 中有规则未绑定正文片段/u);
});

test('output validator keeps audit and visual literals out of the spoken-text requirement', () => {
  const paths = fixture(bundle => {
    bundle.contract = `# Contract\n\n<!-- style-copywriter-validation\n${JSON.stringify({
      required_literals: [
        { id: 'spoken-price', value: '19.9 元', surface: 'spoken' },
        { id: 'package-name', value: '@openai/codex@0.145.0', surface: 'audit' },
        { id: 'version-screen', value: 'codex-cli 0.145.0', surface: 'visual' }
      ],
      required_groups: [],
      forbidden_terms: []
    })}\n-->\n`;
    bundle.copy += '\n这个测试商品标价 19.9 元。';
  });
  const result = run(paths);
  assert.equal(result.failures, 0);
});

test('output validator rejects raw technical tokens on a TTS speech surface', () => {
  const paths = fixture(bundle => {
    bundle.contract = `# Contract\n\n<!-- style-copywriter-validation\n${JSON.stringify({
      required_literals: [],
      required_groups: [],
      forbidden_terms: [],
      speech_surface: {
        mode: 'tts',
        forbid_raw_technical_tokens: true,
        forbidden_raw_terms: ['API Key']
      }
    })}\n-->\n`;
    bundle.copy += '\n按官方方式安装 @openai/codex@0.145.0，再填写 API Key。';
  });
  const report = run(paths, true);
  assert.match(report, /合成口播仍含原始技术字符串/u);
  assert.match(report, /package_handle/u);
});

test('output validator traces a listener progression plan without treating it as similarity proof', () => {
  const paths = fixture(bundle => {
    bundle.metadata.requires_listener_progression_audit = true;
    bundle.metadata.listener_progression = {
      core_question: '这个项目为什么值得继续了解',
      beats: [
        {
          id: 'lp01',
          question_before: '项目是什么',
          information_revealed: '具体项目先摆出来',
          meaning_for_viewer: '观众知道本期对象',
          expected_judgment_after: '值得先听清路径',
          next_question: '具体分几步',
          output_excerpt: '具体项目先摆出来'
        },
        {
          id: 'lp02',
          question_before: '具体分几步',
          information_revealed: '这期分三块讲清楚',
          meaning_for_viewer: '观众知道内容范围',
          expected_judgment_after: '可以按三块跟进',
          next_question: '第一步做什么',
          output_excerpt: '这期分三块讲清楚'
        }
      ]
    };
  });
  const result = run(paths);
  assert.equal(result.failures, 0);
});

test('output validator rejects a listener progression beat with no real copy span', () => {
  const paths = fixture(bundle => {
    bundle.metadata.requires_listener_progression_audit = true;
    bundle.metadata.listener_progression = {
      core_question: '这个项目为什么值得继续了解',
      beats: [{
        id: 'lp01',
        question_before: '项目是什么',
        information_revealed: '不存在的揭晓',
        meaning_for_viewer: '观众知道本期对象',
        expected_judgment_after: '值得先听清路径',
        next_question: '具体分几步',
        output_excerpt: '正文里没有这句话'
      }]
    };
  });
  const report = run(paths, true);
  assert.match(report, /听众推进计划/u);
});

test('output validator enforces human locks, hook fulfillment and fresh baseline comparison', () => {
  const result = run(fixture(bundle => enableStyleAcceptance(bundle)));
  assert.equal(result.failures, 0);
});

test('output validator rejects removal of a user-approved exact expression', () => {
  const paths = fixture(bundle => {
    enableStyleAcceptance(bundle);
    bundle.copy = bundle.copy.replace('具体项目先摆出来', '项目先讲一下');
  });
  const report = run(paths, true);
  assert.match(report, /已通过表达被删除或改写/u);
});

test('output validator rejects a hook whose promised content is not delivered nearby', () => {
  const paths = fixture(bundle => {
    enableStyleAcceptance(bundle);
    bundle.styleLocks.hook_duties[0].delivery_excerpt = '正文不存在的兑现内容';
  });
  const report = run(paths, true);
  assert.match(report, /钩子没有在限定段落内兑现/u);
});

test('output validator rejects a user-rejected AI shell', () => {
  const paths = fixture(bundle => {
    enableStyleAcceptance(bundle);
    bundle.copy += '\n\n你不用什么都会，先做最简单的就能开始。';
  });
  const report = run(paths, true);
  assert.match(report, /AI 句壳超过预算/u);
});

test('output validator rejects stale baseline or enhanced comparison hashes', () => {
  const paths = fixture(bundle => {
    enableStyleAcceptance(bundle);
    bundle.baseline = bundle.copy;
  });
  const report = run(paths, true);
  assert.match(report, /baseline_and_enhanced_identical|Baseline\/Enhanced/u);
});

test('output validator rejects supporting content that exceeds the task-specific share', () => {
  const paths = fixture(bundle => {
    enableStyleAcceptance(bundle);
    bundle.styleLocks.content_allocation.max_supporting_share = 0.01;
  });
  const report = run(paths, true);
  assert.match(report, /辅助内容占比门禁失败/u);
});
