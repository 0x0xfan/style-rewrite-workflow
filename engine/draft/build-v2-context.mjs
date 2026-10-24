#!/usr/bin/env node
/**
 * engine/draft/build-v2-context.mjs
 * 
 * 读取目标选题的 S0 升级资产 (deconstruct.json, facts.json, sourcing.json)
 * 并自动装配生成用于短视频文案 Agent v2.0 的完整提示词与事实上下文包
 * 
 * 用法:
 *   node engine/draft/build-v2-context.mjs --topic <slug> [--out <context.md>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REMOTION_ROOT = path.resolve('D:/项目仓库/remotion视频制作');

function parseArgs(argv) {
  const args = { topic: null, out: null };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--topic') {
      args.topic = argv[++i];
    } else if (arg === '--out') {
      args.out = argv[++i];
    }
  }
  return args;
}

export function buildV2Context(slug) {
  const topicDir = path.join(REMOTION_ROOT, 'public/ips/xianyu-fanshen/assets', slug);
  if (!fs.existsSync(topicDir)) {
    throw new Error(`选题目录未找到: ${topicDir}`);
  }

  const decPath = path.join(topicDir, 'deconstruct.json');
  const factsPath = path.join(topicDir, 'facts.json');
  const sourcingPath = path.join(topicDir, 'sourcing.json');

  if (!fs.existsSync(decPath) || !fs.existsSync(factsPath)) {
    throw new Error(`选题 [${slug}] 尚未完成 S0 素材整理升级！缺少 deconstruct.json 或 facts.json。请先在视频项目运行: node scripts/assets/process-topic-pipeline.mjs --slug ${slug}`);
  }

  const decData = JSON.parse(fs.readFileSync(decPath, 'utf8'));
  const factsData = JSON.parse(fs.readFileSync(factsPath, 'utf8'));
  let sourcingData = null;
  if (fs.existsSync(sourcingPath)) {
    sourcingData = JSON.parse(fs.readFileSync(sourcingPath, 'utf8'));
  }

  const promptContent = `
# 闲鱼虚拟资产 · 事实驱动型金牌文案 Agent 创作任务 (v2.0)

你已被分配为选题 **【${decData.name || slug}】** (slug: \`${slug}\`) 撰写 30~60 秒高完播短视频全案分镜脚本。

## 商业模型判定:
- **所属模型**: ${decData.classifiedModel?.id} (${decData.classifiedModel?.name})
- **钩子策略**: ${decData.classifiedModel?.hookStrategy || '-'}
- **视觉焦点**: ${decData.classifiedModel?.visualKey || '-'}

---

## 一、 输入协议 (请仔细阅读并吸收以下真实事实合同)

### 1. 差异化切入点菜单 (angleCandidates - 红线 1: 必须从中选 1 个):
\`\`\`json
${JSON.stringify(decData.angleCandidates, null, 2)}
\`\`\`

### 2. 事实数据与坐标合同 (facts.json - 红线 2: 零幻觉数据白名单):
\`\`\`json
${JSON.stringify(factsData, null, 2)}
\`\`\`

${sourcingData ? `### 3. 以买代采实操指南 (sourcing.json):\n\`\`\`json\n${JSON.stringify(sourcingData, null, 2)}\n\`\`\`\n` : ''}

---

## 二、 创作纪律与四项红线:
1. **红线 1 (点菜制)**: 必须且只能在上述 \`angleCandidates\` 候选菜单中选择 1 个切入点，严禁臆造角度！
2. **红线 2 (零幻觉白名单)**: 脚本中出现的数值必须 100% 取自 \`facts.json\`，严禁编造任何数字！严禁将全店历史总销量混淆为单品销量！
3. **红线 3 (视听错位)**: 耳朵听情绪、生活化痛点、阶层情绪与具象比喻 (采用 \`sensoryTranslation\`)；眼睛看高清真实截图原图并由 Remotion 聚光灯对准数据！
4. **红线 4 (画面素材三级铁律 / D-041)**: 每一幕必须明确绑定真实截图资产路径 (\`visualAsset\`)，涉及数据严禁纯文字卡！

---

## 三、 标准输出格式:
请严格输出标准 JSON 格式 (5 幕结构: S01 HOOK_BREAK_BIAS, S02 MARKET_VALIDATION, S03 COMMERCIAL_PROOF_AND_NICHES, S04 SOURCING_AND_AUTO_DELIVERY, S05 CALL_TO_ACTION):

\`\`\`json
{
  "slug": "${slug}",
  "selectedAngle": {
    "id": "<从候选菜单选中的 id>",
    "title": "<候选角度标题>",
    "rationale": "<选择该角度的原因与受众考量>"
  },
  "scenes": [
    {
      "sceneId": "S01",
      "role": "HOOK_BREAK_BIAS",
      "voiceover": "...",
      "visualAsset": "ips/xianyu-fanshen/assets/${slug}/...",
      "highlightTarget": null,
      "estimatedDurationSec": 5.0,
      "emotionTone": "颠覆、紧迫、惊叹"
    },
    ...
  ]
}
\`\`\`
`;

  return promptContent.trim();
}

// CLI
if (process.argv[1] && process.argv[1].endsWith('build-v2-context.mjs')) {
  const args = parseArgs(process.argv);
  if (!args.topic) {
    console.error('用法: node engine/draft/build-v2-context.mjs --topic <slug> [--out <context.md>]');
    process.exit(1);
  }

  try {
    const context = buildV2Context(args.topic);
    if (args.out) {
      fs.writeFileSync(path.resolve(args.out), context, 'utf8');
      console.log(`[build-v2-context] 上下文任务包已生成至: ${args.out}`);
    } else {
      console.log(context);
    }
  } catch (e) {
    console.error(`[build-v2-context] 错误: ${e.message}`);
    process.exit(1);
  }
}
