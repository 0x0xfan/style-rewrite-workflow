const cp = require('child_process');

const cmds = [
  [
    'node', 'engine/return/registry.mjs', 'add',
    '--id', '20261015-三角洲-black-yellow-v2-h',
    '--film', 'san-jiao-zhou',
    '--topic', '三角洲',
    '--style', '小Lin',
    '--draft', 'Z:/素材生成库/ai文案/待审文案/三角洲/20261015-三角洲-black-yellow-v2-h.txt',
    '--note', '写稿模型 Gemini；长稿；账号 black-yellow-v2-h；lengthTarget 5min；风格 小Lin；NAS Z:\\素材生成库\\ai文案\\待审文案\\三角洲\\20261015-三角洲-black-yellow-v2-h.txt'
  ],
  [
    'node', 'engine/return/registry.mjs', 'add',
    '--id', '20261015-PPT模板-lime-capsule-h',
    '--film', 'ppt-moban',
    '--topic', 'PPT模板',
    '--style', '嘴替',
    '--draft', 'Z:/素材生成库/ai文案/待审文案/PPT模板/20261015-PPT模板-lime-capsule-h.txt',
    '--note', '写稿模型 Gemini；长稿；账号 lime-capsule-h；lengthTarget 5min；风格 嘴替；NAS Z:\\素材生成库\\ai文案\\待审文案\\PPT模板\\20261015-PPT模板-lime-capsule-h.txt'
  ],
  [
    'node', 'engine/return/registry.mjs', 'add',
    '--id', '20261015-拼豆图纸-signature-wall-h',
    '--film', 'pindou-tuzhi',
    '--topic', '拼豆图纸',
    '--style', '老友',
    '--draft', 'Z:/素材生成库/ai文案/待审文案/拼豆图纸/20261015-拼豆图纸-signature-wall-h.txt',
    '--note', '写稿模型 Gemini；长稿；账号 signature-wall-h；lengthTarget 5min；风格 老友；NAS Z:\\素材生成库\\ai文案\\待审文案\\拼豆图纸\\20261015-拼豆图纸-signature-wall-h.txt'
  ],
  [
    'node', 'engine/return/registry.mjs', 'add',
    '--id', '20261015-Hermes部署-ledger-desk-h',
    '--film', 'hermes-bushu',
    '--topic', 'Hermes部署',
    '--style', '钱十七',
    '--draft', 'Z:/素材生成库/ai文案/待审文案/Hermes部署/20261015-Hermes部署-ledger-desk-h.txt',
    '--note', '写稿模型 Gemini；长稿；账号 ledger-desk-h；lengthTarget 5min；风格 钱十七；NAS Z:\\素材生成库\\ai文案\\待审文案\\Hermes部署\\20261015-Hermes部署-ledger-desk-h.txt'
  ],
  [
    'node', 'engine/return/registry.mjs', 'add',
    '--id', '20261015-苹果多开分身-blueprint-h',
    '--film', 'pingguo-duokai',
    '--topic', '苹果多开分身',
    '--style', '老王',
    '--draft', 'Z:/素材生成库/ai文案/待审文案/苹果多开分身/20261015-苹果多开分身-blueprint-h.txt',
    '--note', '写稿模型 Gemini；长稿；账号 blueprint-h；lengthTarget 5min；风格 老王；NAS Z:\\素材生成库\\ai文案\\待审文案\\苹果多开分身\\20261015-苹果多开分身-blueprint-h.txt'
  ],
  [
    'node', 'engine/return/registry.mjs', 'add',
    '--id', '20261015-高质量人生指南-pixel-arcade-h',
    '--film', 'gaozhiliang-rensheng-zhinan',
    '--topic', '高质量人生指南',
    '--style', '半佛',
    '--draft', 'Z:/素材生成库/ai文案/待审文案/高质量人生指南/20261015-高质量人生指南-pixel-arcade-h.txt',
    '--note', '写稿模型 Gemini；长稿；账号 pixel-arcade-h；lengthTarget 5min；风格 半佛；NAS Z:\\素材生成库\\ai文案\\待审文案\\高质量人生指南\\20261015-高质量人生指南-pixel-arcade-h.txt'
  ]
];

for (const cmd of cmds) {
  const res = cp.spawnSync(cmd[0], cmd.slice(1), { encoding: 'utf8' });
  console.log(res.stdout || res.stderr);
}
