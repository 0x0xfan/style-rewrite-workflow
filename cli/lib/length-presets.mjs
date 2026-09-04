// 篇幅三档的唯一来源。视频方合同口径：口播去空白字数。
//
// 为什么单独拆一个文件：cli/lib/inputs.mjs（工单解析）与 engine/naturalness/check-ai-flavor.mjs
// （AI 味门禁，按档位取免责句上限）都要用这三档。inputs.mjs 会拉起采集层，
// 检查器不该为了一个常量把整条 CLI 依赖进来，所以把常量拆成这个无副作用的叶子模块，两边共读。
// **禁止在别处再抄一份三档数字。**

export const LENGTH_PRESETS = {
  short:    { id: 'short',    min: 350,  max: 650,  minutes: '1–2 分钟',   shortForm: true,  label: '短（1–2 分钟）' },
  standard: { id: 'standard', min: 900,  max: 1500, minutes: '3–5 分钟',   shortForm: false, label: '标准（3–5 分钟）' },
  long:     { id: 'long',     min: 1800, max: 3000, minutes: '6 分钟以上', shortForm: false, label: '长（6 分钟以上，长视频带）' }
};

export const DEFAULT_LENGTH_PRESET = 'standard';

// 没有工单、只拿到一篇稿时，按去空白字数反推档位（口径与上表同源，不写死数字）。
// 落在两档之间（比如 700 字）就归到下面那档：宁可按更严的档判，不放水。
export function inferLengthPreset(chars) {
  const n = Number(chars) || 0;
  if (n >= LENGTH_PRESETS.long.min) return 'long';
  if (n >= LENGTH_PRESETS.standard.min) return 'standard';
  return 'short';
}
