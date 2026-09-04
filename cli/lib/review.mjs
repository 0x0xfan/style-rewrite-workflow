// LLM 二审（门禁七）。正则做不到的三条判据，交一次模型判断。
//
// 为什么要有这一层：docs/AI味治理-外部对照.md §4a-L 把三条最重要的判据点名为「正则不行」——
//   L1 空洞金句：对仗工整、听起来像格言，但没带来前文没有的新信息；
//   L2 讲述者立场：整篇有没有一个属于他自己的判断，还是每句判断都挂着免责尾巴；
//   L3 跨稿撞骨架：把两段里的商品名和数字互换之后，是不是几乎完全一样。
// 前两条是「空洞不空洞、有没有态度」，第三条是「功能位相同的段落对」——都要读懂意思才判得了。
//
// 接法（主线程 2026-09-03 裁定）：
//   - 只调**一次**，且只在本地六道门全过之后跑（省 token，也避免对着废稿评空洞）。
//   - 命中则做**最多一次定向重写**，不进 3 次重写循环。
//   - 重写后仍命中，就只写进 generation-report.md 的 warn 小节，**不 fail、不拦稿**。
//   - `--dry-run` 跳过（不调模型）；`--no-llm-review` 手动关。
//
// 本文件不自己建连接，复用 cli/lib/llm.mjs 的 provider 配置与 callModel；单测用 mock 注入 call。
import { callModel } from './llm.mjs';

export class ReviewError extends Error {}

export const REVIEW_ISSUE_TYPES = ['hollow-punchline', 'no-stance', 'skeleton-collision'];

export const REVIEW_SYSTEM = `你是一位中文口播稿的终审读者，不是写手。你只做判断，不改稿、不夸奖、不给整体评价。

你要判断三件事，一件都不许漏，也一件都不许多判：

（1）空洞金句。找出稿子里所有"金句"——对仗工整、听起来像格言的短句。对每一句问：它有没有带来前文没有的新信息？如果只是把前文换个说法再说一遍，或者只是情绪修饰，就标为空洞。带新信息的金句不算问题，不要报。

（2）讲述者有没有立场。讲述者是一个做闲鱼副业教学的博主。问三件事：整篇里有没有任何一个**属于他自己的判断**（不是转述、不是数据陈述、不是"你自己定"）？有没有一处他说了对自己或对这门生意不利的话、而且后面没有紧跟免责尾巴？"你自己判断 / 我不替你下结论 / 我没核实"这类退让一共出现几次？最后回答：读完这篇，听众能不能说出讲述者本人对这门生意的态度。答不出来，就报一条 no-stance；答得出来，就不要报。

（3）与历史稿撞骨架。如果给了历史稿，找出**功能相同**的段落对（开场钩子、推算免责、口径澄清、收口动作、暂停记笔记指令这类）。对每一对问：把两段里的商品名和数字互换之后，是不是几乎完全一样？是就报一条 skeleton-collision。只报功能位相同的，不要因为都在讲闲鱼就算撞。没给历史稿就不要报这一类。

严格只输出一个 JSON 对象，不要 markdown 代码围栏、不要任何解释文字：

{"verdict":"pass"|"issues","issues":[{"type":"hollow-punchline"|"no-stance"|"skeleton-collision","quote":"原句或段落首句，照抄，不改字","why":"一句话说明为什么判它","fix":"一句话说该怎么改成平白陈述或怎么换骨架"}]}

规则：没有任何问题时输出 {"verdict":"pass","issues":[]}。有问题时 verdict 填 "issues"。no-stance 最多一条（它是全篇判断）。issues 总数不超过 8 条，超了只留最该改的 8 条。quote 必须是稿子里真实存在的原文。`;

// 组装二审的 user 消息。history = { 稿件名: 全文 }；只取前 maxDocs 篇、每篇前 maxChars 字，控 token。
export function buildReviewPrompt(scriptText, history = {}, { maxDocs = 3, maxChars = 2600 } = {}) {
  const names = Object.keys(history).slice(0, maxDocs);
  const hist = names.length
    ? names.map((n) => `#### 历史稿《${n}》\n${String(history[n]).slice(0, maxChars)}`).join('\n\n')
    : '（本次没有历史稿可比，第 3 类 skeleton-collision 一条都不要报。）';
  return `### 待审口播稿\n${scriptText}\n\n### 同一博主的历史稿（用于第 3 类判断）\n${hist}`;
}

// 解析模型输出。容忍代码围栏、前后废话；解析不了不抛错，返回 { verdict:'unparsed' } 让上层降级成 warn。
export function parseReviewOutput(text) {
  const raw = String(text || '');
  let jsonText = raw.trim();
  const fence = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) jsonText = fence[1].trim();
  else {
    const s = jsonText.indexOf('{');
    const e = jsonText.lastIndexOf('}');
    if (s >= 0 && e > s) jsonText = jsonText.slice(s, e + 1);
  }
  let data;
  try { data = JSON.parse(jsonText); } catch {
    return { verdict: 'unparsed', issues: [], parseError: `模型没返回可解析的 JSON：${raw.slice(0, 160)}` };
  }
  const issues = Array.isArray(data.issues) ? data.issues : [];
  const clean = issues
    .filter((i) => i && REVIEW_ISSUE_TYPES.includes(i.type))
    .slice(0, 8)
    .map((i) => ({
      type: i.type,
      quote: String(i.quote || '').slice(0, 120),
      why: String(i.why || '').slice(0, 200),
      fix: String(i.fix || '').slice(0, 200)
    }));
  const verdict = clean.length ? 'issues' : (data.verdict === 'issues' ? 'pass' : (data.verdict || 'pass'));
  return { verdict: verdict === 'issues' ? 'issues' : 'pass', issues: clean };
}

// 跑一次二审。call 可注入（单测用 mock，绝不真调模型）。
// 返回 { ran, skipped?, verdict, issues, parseError? }。任何异常都降级成 { ran:false, error }——
// 二审是加分项，绝不能因为它挂了就拦住一篇本地门禁已经全过的稿子。
export async function runLlmReview({ cfg, scriptText, history = {}, call = callModel, enabled = true, reason = '' } = {}) {
  if (!enabled) return { ran: false, skipped: true, reason: reason || '已用 --no-llm-review 关闭', verdict: 'skipped', issues: [] };
  try {
    const out = await call({
      cfg,
      system: REVIEW_SYSTEM,
      messages: [{ role: 'user', content: buildReviewPrompt(scriptText, history) }],
      maxTokens: 4000
    });
    const parsed = parseReviewOutput(out);
    if (parsed.verdict === 'unparsed') {
      return { ran: true, verdict: 'unparsed', issues: [], parseError: parsed.parseError };
    }
    return { ran: true, ...parsed };
  } catch (e) {
    return { ran: false, verdict: 'error', issues: [], error: e && e.message ? e.message : String(e) };
  }
}

const TYPE_LABEL = {
  'hollow-punchline': '空洞金句',
  'no-stance': '讲述者没有立场',
  'skeleton-collision': '与历史稿撞骨架'
};

// 二审 findings → 给模型的定向重写反馈（只改这几处，别重写整篇）。
export function reviewFeedback(result) {
  if (!result || !result.issues || !result.issues.length) return '- （二审无命中）';
  const lines = ['- 下面是终审读者挑出来的问题。**只改这几处，别重写整篇**，其余段落一字不动：'];
  for (const i of result.issues) {
    lines.push(`  - 【${TYPE_LABEL[i.type] || i.type}】「${i.quote}」`);
    if (i.why) lines.push(`    问题：${i.why}`);
    if (i.fix) lines.push(`    改法：${i.fix}`);
  }
  lines.push('  另外提醒：改完后仍要满足「去 AI 味 · 配额」那一节的正向配额（口头禅 ≥3 处、短句占比 ≥四分之一、至少一句自己的判断且不挂退让尾巴）。');
  return lines.join('\n');
}

export { TYPE_LABEL as REVIEW_TYPE_LABEL };
