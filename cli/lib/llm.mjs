// 模型调用层：兼容 Anthropic 官方、Anthropic 兼容中转、OpenAI 兼容中转（中转站/代理），
// 以及本机已登录的 Claude Code CLI（headless，用订阅额度、免 API key）。
// HTTP 两档零依赖，全用全局 fetch（Node 18+）；claude-code 档 spawn 本机 claude 命令。
// 三档共用同一套提示词与输出解析，只在这里分叉。
//
// 环境变量：
//   STYLE_LLM_API_KEY   anthropic/openai 必填；claude-code 档免。
//   STYLE_LLM_BASE_URL  可选。默认按 provider 取官方地址（claude-code 档不用）。
//   STYLE_LLM_MODEL     可选。anthropic/openai 默认 DEFAULT_MODEL；claude-code 档留空即用本机默认型号。
//   STYLE_LLM_PROVIDER  可选。"anthropic"（默认）| "openai" | "claude-code"。
//   STYLE_CLAUDE_CMD    可选（仅 claude-code 档 / 测试用）。claude 可执行名，默认 "claude"。

import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import { join, delimiter, isAbsolute } from 'node:path';

export const DEFAULT_MODEL = 'claude-opus-5'; // Anthropic 当前主力最强可用型号（skill: claude-api 默认）。
const ANTHROPIC_DEFAULT_BASE = 'https://api.anthropic.com';
const ANTHROPIC_VERSION = '2023-06-01';
const REQUEST_TIMEOUT_MS = 600000; // 长稿留足；非流式 + 长超时，避免中转站不支持 SSE。
const CLAUDE_CODE_TIMEOUT_MS = 900000; // CLI 启动 + 生成比直连 API 慢，留足 900s。
const NOT_INSTALLED_MSG = '服务器未安装 Claude Code（claude 命令），无法用订阅额度出稿。';

export class LlmError extends Error {}

// 密钥脱敏：只留头 4 尾 4。
function maskKey(k) {
  if (!k) return '(空)';
  if (k.length <= 10) return k.slice(0, 2) + '****';
  return `${k.slice(0, 4)}****${k.slice(-4)}`;
}
// baseURL 脱敏：只留协议 + host，丢掉可能带 token 的 path/query。
function maskUrl(u) {
  try {
    const url = new URL(u);
    return `${url.protocol}//${url.host}`;
  } catch {
    return u;
  }
}

// 从环境读配置并校验。dryRun 时允许缺 key（不会真的调）。
export function resolveLlmConfig({ dryRun = false } = {}) {
  const provider = (process.env.STYLE_LLM_PROVIDER || 'anthropic').trim().toLowerCase();
  if (provider !== 'anthropic' && provider !== 'openai' && provider !== 'claude-code') {
    throw new LlmError(
      `STYLE_LLM_PROVIDER 只能是 "anthropic"、"openai" 或 "claude-code"，收到「${process.env.STYLE_LLM_PROVIDER}」。` +
      '（anthropic=官方或 Anthropic 兼容中转；openai=OpenAI 兼容中转/代理；claude-code=本机已登录的 Claude Code CLI，用订阅额度、免 key。）'
    );
  }
  const apiKey = process.env.STYLE_LLM_API_KEY || '';
  const rawModel = (process.env.STYLE_LLM_MODEL || '').trim();
  // claude-code 档：留空即用本机 claude 默认型号（不强加 DEFAULT_MODEL）。
  const model = rawModel || (provider === 'claude-code' ? '' : DEFAULT_MODEL);
  const baseUrl = (process.env.STYLE_LLM_BASE_URL || (provider === 'anthropic' ? ANTHROPIC_DEFAULT_BASE : '')).replace(/\/+$/, '');

  if (!dryRun) {
    // claude-code 档走本机订阅额度，免 STYLE_LLM_API_KEY。
    if (provider !== 'claude-code' && !apiKey) {
      throw new LlmError('没读到模型密钥 STYLE_LLM_API_KEY。请设置环境变量后重试（联系老板要密钥），或用 --dry-run 走离线自测。');
    }
    if (provider === 'openai' && !baseUrl) {
      throw new LlmError('STYLE_LLM_PROVIDER=openai 时必须给 STYLE_LLM_BASE_URL（中转站地址，如 https://xxx.com/v1）。');
    }
  }
  return { provider, apiKey, model, baseUrl: baseUrl || ANTHROPIC_DEFAULT_BASE };
}

// 启动日志（脱敏），走 stderr 供面板 SSE 显示。
export function describeConfig(cfg) {
  if (cfg.provider === 'claude-code') {
    return `模型配置：provider=claude-code  model=${cfg.model || '默认'}  使用本机 Claude Code 订阅额度`;
  }
  return `模型配置：provider=${cfg.provider}  baseURL=${maskUrl(cfg.baseUrl)}  model=${cfg.model}  key=${maskKey(cfg.apiKey)}`;
}

// 把 HTTP 状态 / 错误体翻译成员工能懂的人话。
function humanizeHttpError(status, bodyText, cfg) {
  const lower = (bodyText || '').toLowerCase();
  if (status === 401 || status === 403 || lower.includes('invalid api key') || lower.includes('authentication')) {
    return '模型密钥无效或没有权限，请联系老板检查 API 密钥。';
  }
  if (status === 402 || lower.includes('insufficient') || lower.includes('quota') || lower.includes('balance') || lower.includes('欠费') || lower.includes('额度')) {
    return '模型额度不足或已欠费，请联系老板充值。';
  }
  if (status === 429 || lower.includes('rate limit') || lower.includes('too many')) {
    return '请求太频繁或额度用完了，请稍等一会儿再试；若一直这样请联系老板检查额度。';
  }
  if (status === 404 || lower.includes('model') && lower.includes('not') && lower.includes('found')) {
    return `中转站找不到模型「${cfg.model}」，请检查 STYLE_LLM_MODEL 是否为该中转站支持的型号。`;
  }
  if (status >= 500) {
    return `模型服务暂时故障（服务器返回 ${status}），请稍后重试。`;
  }
  return `模型接口返回错误（HTTP ${status}）：${(bodyText || '').slice(0, 300)}`;
}

async function postJson(url, headers, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal });
  } catch (e) {
    if (e.name === 'AbortError') throw new LlmError('模型响应超时，请稍后重试。');
    throw new LlmError(`连不上模型服务（${maskUrl(url)}）：${e.message}。请检查网络或 STYLE_LLM_BASE_URL 配置。`);
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  return { res, text };
}

// 统一入口。messages: [{role, content}]（role: 'user'|'assistant'）。system: 字符串。
// 返回模型输出的纯文本。
export async function callModel({ cfg, system, messages, maxTokens = 32000 }) {
  if (cfg.provider === 'claude-code') return callClaudeCode({ cfg, system, messages });
  if (cfg.provider === 'anthropic') return callAnthropic({ cfg, system, messages, maxTokens });
  return callOpenAI({ cfg, system, messages, maxTokens });
}

// Anthropic 协议（官方 / Anthropic 兼容中转）：POST {base}/v1/messages。
async function callAnthropic({ cfg, system, messages, maxTokens }) {
  const url = `${cfg.baseUrl}/v1/messages`;
  const headers = {
    'content-type': 'application/json',
    'x-api-key': cfg.apiKey,
    'anthropic-version': ANTHROPIC_VERSION
  };
  const body = {
    model: cfg.model,
    max_tokens: maxTokens,
    system,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    thinking: { type: 'adaptive' }
  };
  let { res, text } = await postJson(url, headers, body);
  // 中转站/老模型可能不认 thinking 字段；命中 400 且提到 thinking 就去掉重试一次。
  if (res.status === 400 && /thinking|adaptive|output_config/i.test(text)) {
    delete body.thinking;
    ({ res, text } = await postJson(url, headers, body));
  }
  if (!res.ok) throw new LlmError(humanizeHttpError(res.status, text, cfg));
  let data;
  try { data = JSON.parse(text); } catch { throw new LlmError(`模型返回的不是合法 json：${text.slice(0, 200)}`); }
  if (data.stop_reason === 'refusal') {
    throw new LlmError('模型以安全原因拒绝了本次生成，请调整选题或要点后重试。');
  }
  const out = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  if (!out.trim()) throw new LlmError('模型返回了空内容，请重试。');
  return out;
}

// claude-code 档：把 system+messages 合并成一条完整提示词，走 stdin 喂给本机 claude CLI。
// 命令行只放固定 flag（绝不放提示词，Windows 命令行有长度限制）。
function buildClaudeCodePrompt(system, messages) {
  const parts = [];
  if (system && system.trim()) parts.push(system.trim());
  for (const m of messages || []) {
    const label = m.role === 'assistant' ? '【上一版你的产出】' : '【任务】';
    parts.push(`${label}\n${m.content}`);
  }
  return parts.join('\n\n');
}

// claude 的错误文本（--output-format json 的 result 字段）→ 人话。
function humanizeClaudeCodeError(resultText) {
  const lower = (resultText || '').toLowerCase();
  if (/not logged in|logged in|\/login|unauthorized|authentication|invalid api key|401|403/.test(lower)) {
    return 'Claude Code 登录已失效，需在服务器重新登录后重试。';
  }
  if (/429|rate limit|overloaded/.test(lower)) {
    return 'Claude Code 出稿被上游拒绝（429/限流表象）。注意：本机 claude 命令行与桌面 App 的登录凭据不同池，' +
      '此表象常见根因其实是命令行无登录态——请先在服务器终端跑一次 claude login 确认登录，再重试；确为限流则稍候重试。';
  }
  return `Claude Code 出稿失败：${(resultText || '').slice(0, 300)}`;
}

// 跨平台把命令解析成 PATH 上的绝对路径（Windows 额外套 PATHEXT）。用于 spawn 前确定性地
// 给出「未安装」人话错，且不用 shell:true（避开本地化 stderr 乱码 + 参数拼接不转义的告警）。
// 命中返回绝对路径；找不到返回 null。
function resolveCommand(cmd) {
  if (isAbsolute(cmd) || cmd.includes('/') || cmd.includes('\\')) return existsSync(cmd) ? cmd : null;
  const dirs = (process.env.PATH || '').split(delimiter).filter(Boolean);
  // Windows：可执行性靠扩展名。裸名不可直接 spawn（会命中同名的无扩展 shell 脚本却无法执行），
  // 故只认 PATHEXT 里的扩展（除非 cmd 自带扩展名，如 STYLE_CLAUDE_CMD=claude.cmd）。POSIX 用裸名。
  const hasExt = /\.[^\\/.]+$/.test(cmd);
  const exts = process.platform === 'win32'
    ? (hasExt ? [''] : (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean))
    : [''];
  for (const dir of dirs) {
    for (const ext of exts) {
      const p = join(dir, cmd + ext);
      if (existsSync(p)) return p;
    }
  }
  return null;
}

// spawn 本机 claude -p --output-format json，完整提示词走 stdin，工作目录用系统临时目录
// （避免 spawn 出的 claude 读到本仓库上下文），超时 900s。
export async function callClaudeCode({ cfg, system, messages }) {
  const cmd = (process.env.STYLE_CLAUDE_CMD || 'claude').trim();
  const resolved = resolveCommand(cmd);
  if (!resolved) throw new LlmError(NOT_INSTALLED_MSG);
  const args = ['-p', '--output-format', 'json'];
  if (cfg.model) args.push('--model', cfg.model);
  const prompt = buildClaudeCodePrompt(system, messages);

  // Windows 的 npm shim 是 claude.cmd/.bat：新版 Node 不许 shell:false 直接 spawn .cmd，
  // 改为经 cmd.exe /c 调用（Node 对 cmd.exe 会自动转义 args，安全且不触发弃用告警）。
  let spawnCmd = resolved;
  let spawnArgs = args;
  if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(resolved)) {
    spawnCmd = process.env.ComSpec || 'cmd.exe';
    spawnArgs = ['/d', '/s', '/c', resolved, ...args];
  }

  // 剥掉可能把 claude 重定向到中转站 / API key 的环境变量，强制其走本机订阅登录态。
  const childEnv = { ...process.env };
  for (const k of ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_MODEL']) {
    delete childEnv[k];
  }

  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(spawnCmd, spawnArgs, { cwd: tmpdir(), env: childEnv, windowsHide: true });
    } catch (e) {
      reject(new LlmError(NOT_INSTALLED_MSG));
      return;
    }
    let stdout = '';
    let stderr = '';
    let settled = false;
    const done = (fn) => { if (!settled) { settled = true; clearTimeout(timer); fn(); } };
    const timer = setTimeout(() => {
      try { child.kill(); } catch { /* noop */ }
      done(() => reject(new LlmError('Claude Code 响应超时（超过 900 秒），请稍后重试。')));
    }, CLAUDE_CODE_TIMEOUT_MS);

    child.on('error', (e) => {
      done(() => reject(new LlmError(e.code === 'ENOENT' ? NOT_INSTALLED_MSG : `无法启动 Claude Code：${e.message}`)));
    });
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (code) => {
      done(() => {
        let data = null;
        try { data = JSON.parse(stdout); } catch { /* 非 json，落到下方兜底 */ }
        if (!data) {
          // 解析不出 json：多半是命令不存在或进程崩溃。
          if (/is not recognized|command not found|not found|no such file|cannot find/i.test(stderr)) {
            reject(new LlmError(NOT_INSTALLED_MSG));
          } else {
            reject(new LlmError(`Claude Code 未返回可解析结果（退出码 ${code}）：${(stderr || stdout || '').slice(0, 300)}`));
          }
          return;
        }
        if (data.is_error) { reject(new LlmError(humanizeClaudeCodeError(data.result))); return; }
        const out = typeof data.result === 'string' ? data.result : '';
        if (!out.trim()) { reject(new LlmError('Claude Code 返回了空内容，请重试。')); return; }
        resolve(out);
      });
    });
    child.stdin.on('error', () => { /* 忽略 EPIPE：claude 提前退出时写 stdin 会报错 */ });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

// OpenAI 兼容协议（绝大多数第三方中转站）：POST {base}/chat/completions，Bearer 鉴权。
async function callOpenAI({ cfg, system, messages, maxTokens }) {
  const url = `${cfg.baseUrl}/chat/completions`;
  const headers = {
    'content-type': 'application/json',
    authorization: `Bearer ${cfg.apiKey}`
  };
  const body = {
    model: cfg.model,
    max_tokens: maxTokens,
    messages: [{ role: 'system', content: system }, ...messages.map((m) => ({ role: m.role, content: m.content }))]
  };
  const { res, text } = await postJson(url, headers, body);
  if (!res.ok) throw new LlmError(humanizeHttpError(res.status, text, cfg));
  let data;
  try { data = JSON.parse(text); } catch { throw new LlmError(`模型返回的不是合法 json：${text.slice(0, 200)}`); }
  const msg = data.choices && data.choices[0] && data.choices[0].message;
  const out = typeof msg?.content === 'string'
    ? msg.content
    : Array.isArray(msg?.content) ? msg.content.map((c) => (typeof c === 'string' ? c : c.text || '')).join('') : '';
  if (!out.trim()) throw new LlmError('模型返回了空内容，请重试。');
  return out;
}
