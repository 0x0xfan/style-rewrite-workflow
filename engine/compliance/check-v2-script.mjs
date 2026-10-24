#!/usr/bin/env node
/**
 * engine/compliance/check-v2-script.mjs
 * 
 * 校验短视频 v2.0 事实驱动分镜脚本 (JSON 规范)
 * 严格执行 D-040（数据零幻觉/不造假）、D-041（三级视觉资产）、4 大红线与 5 幕黄金叙事结构
 * 
 * 用法:
 *   node engine/compliance/check-v2-script.mjs <script.json> [--topic <slug>] [--export-txt <out.txt>] [--export-material <out.素材.md>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const REMOTION_ROOT = path.resolve('D:/项目仓库/remotion视频制作');

const EXPECTED_SCENES = [
  { sceneId: 'S01', role: 'HOOK_BREAK_BIAS', name: '黄金3秒钩子' },
  { sceneId: 'S02', role: 'MARKET_VALIDATION', name: '大盘刚需确权' },
  { sceneId: 'S03', role: 'COMMERCIAL_PROOF_AND_NICHES', name: '商业实力与细分长尾' },
  { sceneId: 'S04', role: 'SOURCING_AND_AUTO_DELIVERY', name: '极速履约与以买代采' },
  { sceneId: 'S05', role: 'CALL_TO_ACTION', name: '破局行动号召' }
];

function parseArgs(argv) {
  const args = { file: null, topic: null, exportTxt: null, exportMaterial: null };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--topic') {
      args.topic = argv[++i];
    } else if (arg === '--export-txt') {
      args.exportTxt = argv[++i];
    } else if (arg === '--export-material') {
      args.exportMaterial = argv[++i];
    } else if (!args.file && !arg.startsWith('--')) {
      args.file = arg;
    }
  }
  return args;
}

export function validateV2Script(scriptData, options = {}) {
  const findings = [];
  const warnings = [];

  const addError = (code, msg, sceneId = null) => {
    findings.push({ severity: 'error', code, msg, sceneId });
  };
  const addWarn = (code, msg, sceneId = null) => {
    warnings.push({ severity: 'warning', code, msg, sceneId });
  };

  // 1. 基础结构校验
  if (!scriptData || typeof scriptData !== 'object') {
    addError('STRUCTURE_INVALID', '脚本必须是一个有效的 JSON 对象');
    return { valid: false, findings, warnings };
  }

  const slug = options.topic || scriptData.slug;
  if (!slug) {
    addError('SLUG_MISSING', '脚本缺少 slug 字段');
  }

  // 2. 切入角度校验 (红线 1: 点菜制)
  const selectedAngle = scriptData.selectedAngle;
  if (!selectedAngle || !selectedAngle.id) {
    addError('ANGLE_MISSING', '缺少 selectedAngle 字段或 selectedAngle.id (红线 1: 点菜制)');
  }

  // 尝试读取上游 asset 目录
  const topicDir = path.join(REMOTION_ROOT, 'public/ips/xianyu-fanshen/assets', slug || '');
  let deconstructData = null;
  let factsData = null;
  let sourcingData = null;

  if (fs.existsSync(topicDir)) {
    const decPath = path.join(topicDir, 'deconstruct.json');
    const factsPath = path.join(topicDir, 'facts.json');
    const sourcingPath = path.join(topicDir, 'sourcing.json');

    if (fs.existsSync(decPath)) {
      try {
        deconstructData = JSON.parse(fs.readFileSync(decPath, 'utf8'));
      } catch (e) {
        addWarn('UPSTREAM_DEC_ERROR', `上游 deconstruct.json 解析失败: ${e.message}`);
      }
    }
    if (fs.existsSync(factsPath)) {
      try {
        factsData = JSON.parse(fs.readFileSync(factsPath, 'utf8'));
      } catch (e) {
        addWarn('UPSTREAM_FACTS_ERROR', `上游 facts.json 解析失败: ${e.message}`);
      }
    }
    if (fs.existsSync(sourcingPath)) {
      try {
        sourcingData = JSON.parse(fs.readFileSync(sourcingPath, 'utf8'));
      } catch (e) {
        addWarn('UPSTREAM_SOURCING_ERROR', `上游 sourcing.json 解析失败: ${e.message}`);
      }
    }
  } else {
    addWarn('TOPIC_DIR_NOT_FOUND', `未找到视频项目对应资产目录: ${topicDir}，部分上游合同校验将跳过`);
  }

  // 红线 1 校验：候选菜单
  if (deconstructData && deconstructData.angleCandidates && selectedAngle) {
    const validCandidate = deconstructData.angleCandidates.find(c => c.id === selectedAngle.id);
    if (!validCandidate) {
      addError(
        'RED_LINE_1_INVALID_ANGLE',
        `selectedAngle.id [${selectedAngle.id}] 不在 deconstruct.json.angleCandidates 候选菜单中！(红线 1: 严禁无米之炊，严禁臆造角度)`
      );
    }
  }

  // 3. 5 幕黄金叙事结构校验
  const scenes = scriptData.scenes;
  if (!Array.isArray(scenes) || scenes.length === 0) {
    addError('SCENES_MISSING', 'scenes 数组为空或不存在');
    return { valid: false, findings, warnings };
  }

  if (scenes.length !== 5) {
    addWarn('SCENE_COUNT_UNUSUAL', `标准黄金结构推荐 5 幕 (S01~S05)，当前脚本共有 ${scenes.length} 幕`);
  }

  let totalDuration = 0;
  const sceneMap = new Map();

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const sId = scene.sceneId || `Scene_${i + 1}`;
    sceneMap.set(sId, scene);

    // 校验 sceneId 与 role 对应关系
    const expected = EXPECTED_SCENES[i];
    if (expected) {
      if (scene.sceneId !== expected.sceneId) {
        addWarn('SCENE_ID_MISMATCH', `第 ${i + 1} 幕推荐 ID 为 ${expected.sceneId} (${expected.name})，实际为 ${scene.sceneId}`, sId);
      }
      if (scene.role !== expected.role) {
        addWarn('SCENE_ROLE_MISMATCH', `第 ${i + 1} 幕推荐 role 为 ${expected.role}，实际为 ${scene.role}`, sId);
      }
    }

    // 口播台词非空
    if (!scene.voiceover || typeof scene.voiceover !== 'string' || scene.voiceover.trim().length === 0) {
      addError('VOICEOVER_EMPTY', `分镜口播台词 voiceover 不能为空`, sId);
    }

    // 估算时长
    const dur = parseFloat(scene.estimatedDurationSec);
    if (isNaN(dur) || dur <= 0) {
      addWarn('DURATION_INVALID', `estimatedDurationSec 应为正数，当前为 ${scene.estimatedDurationSec}`, sId);
    } else {
      totalDuration += dur;
    }

    // 红线 4 & D-041: 画面素材三级铁律 (必须绑定具体视觉资产，严禁纯文字卡)
    if (!scene.visualAsset || typeof scene.visualAsset !== 'string' || scene.visualAsset.trim().length === 0) {
      addError('RED_LINE_4_NO_VISUAL_ASSET', `分镜缺少 visualAsset 资产路径，严禁使用纯文字卡偷懒！(D-041 铁律)`, sId);
    } else {
      // 检查文件在磁盘上是否存在
      let assetRelative = scene.visualAsset.trim().replace(/^public[\\/]/, '');
      const fullAssetPath1 = path.join(REMOTION_ROOT, 'public', assetRelative);
      const fullAssetPath2 = path.join(REMOTION_ROOT, assetRelative);

      if (!fs.existsSync(fullAssetPath1) && !fs.existsSync(fullAssetPath2)) {
        addError('ASSET_FILE_NOT_FOUND', `visualAsset 文件在视频项目磁盘中不存在: ${scene.visualAsset}`, sId);
      }
    }

    // 校验 highlightTarget (如果存在)
    if (scene.highlightTarget) {
      if (factsData && !scene.highlightTarget.startsWith('facts.')) {
        addWarn('HIGHLIGHT_TARGET_FORMAT', `highlightTarget 推荐指向 facts.* (如 facts.baiduTrend)`, sId);
      }
    }
  }

  // 总时长范围校验 (30s ~ 180s，支持 1~3 分钟灵活随机分布)
  if (totalDuration < 25 || totalDuration > 185) {
    addWarn('TOTAL_DURATION_OUT_OF_BOUNDS', `总估算时长 ${totalDuration.toFixed(1)} 秒，建议控制在 30~180 秒之间（1~3 分钟）`);
  }

  // 4. 红线 2: 零幻觉白名单与 D-040 铁律校验
  const allVoiceover = scenes.map(s => s.voiceover || '').join(' ');

  // 检查张冠李戴：全店历史销量 vs 单款销量
  if (allVoiceover.includes('单款卖了') || allVoiceover.includes('单件卖了') || allVoiceover.includes('这款卖了12万') || allVoiceover.includes('图纸卖了12万')) {
    addError('RED_LINE_2_MISATTRIBUTION', `口播出现偷换概念/张冠李戴！严禁把店铺总历史销量谎称为单款销量！(红线 2 / D-040)`);
  }

  // 如果上游 facts.json 存在，比对口播中的核心数字
  if (factsData && factsData.facts) {
    const f = factsData.facts;
    // 检查是否有明显凭空捏造的月入过万/夸张数字
    const wildRevenueMatch = allVoiceover.match(/(月入|月赚|日赚|躺赚|净赚)\s*([0-9万千百十]+)/);
    if (wildRevenueMatch) {
      // 检查白名单或体感转译中是否有该表述
      const phrase = wildRevenueMatch[0];
      const isInTranslation = JSON.stringify(f).includes(phrase);
      if (!isInTranslation) {
        addWarn('POTENTIAL_HALLUCINATED_REVENUE', `口播中出现收益宣称 "${phrase}"，请确保 100% 来源于 facts.json 白名单！`);
      }
    }
  }

  return {
    valid: findings.length === 0,
    findings,
    warnings,
    summary: {
      slug,
      angle: selectedAngle?.id,
      scenesCount: scenes.length,
      totalDurationSec: totalDuration.toFixed(1),
      errorsCount: findings.length,
      warningsCount: warnings.length
    }
  };
}

/**
 * 转换脚本为口播纯文本 (.txt) 与素材对照表 (.素材.md)
 */
export function exportScriptOutputs(scriptData, paths = {}) {
  const scenes = scriptData.scenes || [];

  if (paths.txtPath) {
    const lines = scenes.map(s => (s.voiceover || '').trim()).filter(Boolean);
    fs.writeFileSync(paths.txtPath, lines.join('\n') + '\n', 'utf8');
  }

  if (paths.materialPath) {
    const mdLines = [
      `# ${scriptData.slug} 短视频素材对照 (v2.0 事实驱动版)`,
      `slug: ${scriptData.slug}`,
      `切入角度: ${scriptData.selectedAngle?.title || ''} (${scriptData.selectedAngle?.id || ''})`,
      `画幅: 竖屏 9:16`,
      '',
      `| 幕次 | 结构角色 | 预估时长 | 画面资产 (visualAsset) | 口播台词 (voiceover) |`,
      `|---|---|---|---|---|`
    ];

    for (const s of scenes) {
      const dur = s.estimatedDurationSec ? `${s.estimatedDurationSec}s` : '-';
      const cleanVo = (s.voiceover || '').replace(/[\r\n|]+/g, ' ');
      mdLines.push(`| ${s.sceneId} | ${s.role} | ${dur} | \`${s.visualAsset}\` | ${cleanVo} |`);
    }

    mdLines.push('');
    fs.writeFileSync(paths.materialPath, mdLines.join('\n'), 'utf8');
  }
}

// CLI 执行
if (process.argv[1] && process.argv[1].endsWith('check-v2-script.mjs')) {
  const args = parseArgs(process.argv);
  if (!args.file) {
    console.error('用法: node engine/compliance/check-v2-script.mjs <script.json> [--topic <slug>] [--export-txt <out.txt>] [--export-material <out.素材.md>]');
    process.exit(2);
  }

  const scriptPath = path.resolve(args.file);
  if (!fs.existsSync(scriptPath)) {
    console.error(`[check-v2-script] 文件不存在: ${scriptPath}`);
    process.exit(2);
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));
  } catch (e) {
    console.error(`[check-v2-script] 非法 JSON 文件: ${e.message}`);
    process.exit(1);
  }

  const result = validateV2Script(data, { topic: args.topic });

  console.log('\n======================================================');
  console.log(`[check-v2-script] 短视频 v2.0 规范与铁律检查报告: [${result.summary.slug}]`);
  console.log(`  切入角度: ${result.summary.angle}`);
  console.log(`  分镜幕数: ${result.summary.scenesCount} 幕 | 预估总时长: ${result.summary.totalDurationSec} 秒`);
  console.log(`  结果状态: ${result.valid ? '✅ PASS (无退回级错误)' : '❌ FAIL (发现红线违规)'}`);
  console.log('======================================================\n');

  if (result.findings.length > 0) {
    console.log('【退回级红线违规】:');
    for (const f of result.findings) {
      const sPrefix = f.sceneId ? `[${f.sceneId}] ` : '';
      console.log(`  ❌ ${sPrefix}(${f.code}) ${f.msg}`);
    }
    console.log('');
  }

  if (result.warnings.length > 0) {
    console.log('【优化建议 / 提示】:');
    for (const w of result.warnings) {
      const sPrefix = w.sceneId ? `[${w.sceneId}] ` : '';
      console.log(`  ⚠️ ${sPrefix}(${w.code}) ${w.msg}`);
    }
    console.log('');
  }

  if (args.exportTxt || args.exportMaterial) {
    exportScriptOutputs(data, {
      txtPath: args.exportTxt ? path.resolve(args.exportTxt) : null,
      materialPath: args.exportMaterial ? path.resolve(args.exportMaterial) : null
    });
    console.log(`[check-v2-script] 已导出文案正文与素材对照表`);
  }

  process.exit(result.valid ? 0 : 1);
}
