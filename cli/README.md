# 文案工坊 · 生成 CLI

P013 面板会 spawn 本 CLI，为员工「按钮化」出稿。两档均已交付：
- **第一档**：已有事实卡的 filmId 直接成稿。
- **第二档（自动采集档）**：filmId 没有事实卡时，CLI 自动跑「闲鱼采集 → 百度需求佐证 → GitHub 供应线索 → 组装机器底稿事实卡 → 自动补完 → 登记」流水线（约 2–5 分钟，日志实时吐），再进第一档主流程。见下方「自动采集档」。

## 用法

```bash
node cli/generate.mjs --style <styleId> --order <工单json路径> --out <输出目录> [--dry-run]
```

- `--style`：风格 id（`qian17` / `banfo`），须与工单 `styleId` 一致。
- `--order`：工单 json 路径。
- `--out`：输出目录（自动创建；同工单重跑**覆盖** `script.txt` / `storyboard.md` / `generation-report.md`，幂等无残留）。
- `--dry-run`：不调模型，用内置 fixture 走完 门禁→抽取→校验→落盘 全链路。无密钥自测 / P013 联调用。

契约：**零交互**（不读 stdin、无确认）；日志全走 stdout/stderr（中文，员工能看懂，供面板 SSE 实时显示）；退出码 **0=成功、非0=失败**且 stderr 给人话原因。

### 工单 json 字段

```json
{
  "filmId": "jiudian-daiding",          // 必填 · 影片稳定键（小写 kebab）
  "styleId": "qian17",                   // 必填 · 风格 id，须与 --style 一致
  "topic": "酒店代订",                    // 必填 · 本期选题一句话
  "points": ["先证需求成立", "..."],      // 可空 · 必谈要点
  "assetsHint": "今日闲鱼7张 + 第37期抽帧", // 可空 · 素材提示
  "audience": "起步期",                   // 可空 · 默认「起步期」
  "mode": "topic",                       // "topic" | "rewrite"
  "rewriteSourcePath": "…/原稿.md",      // mode=rewrite 时必填（过渡期兼容旧名 sourcePath）
  "factCardPath": "…/事实卡-终版.md",     // 可空 · 显式指定事实卡（优先级最高）
  "lengthPreset": "standard"             // 可空 · "short" | "standard" | "long"，缺省 standard
}
```

### 篇幅档位（`lengthPreset`）

可选字段，缺省 `standard`；**未识别的值不报错**——打一行中文 warn 到 stdout，按 `standard` 处理（向后兼容）。

| 档位 | 目标口播字数（约 300 字/分钟） | 时长 | 形态 |
| --- | --- | --- | --- |
| `short` | 350–650 | 1–2 分钟 | **短视频形态**（小红书/抖音，走平台合规门禁） |
| `standard`（默认） | 900–1500 | 3–5 分钟 | 长视频形态（照旧，不走合规层） |
| `long` | 1800–3000 | 6 分钟以上 | 长视频形态（现行长视频带，照旧） |

- **`short` 触发短视频形态规则**（重要，见 `docs/platform-compliance.md` / `docs/generation-intake.md`）：
  1. 提示词按短视频口径注入——把收益数字 / 收益推算 / 资源 CTA 类诱导**换形式**成悬念 / 反差 / 信息缺口 / 损失厌恶 / 互动钩子 / 消费阶梯（是转换，**不是截短、不是删诱导**），并注入目标字数区间。
  2. 成稿后额外过平台合规门禁 `engine/compliance/check-copy.mjs`，必须 PASS；不过则反馈模型重写，**并入现有 AI 味重试循环、共享 3 次上限**；连续 3 次仍不过则非 0 退出并给人话原因。
  3. `generation-report.md` 记录合规结果（门禁四）。
- `standard` / `long` 不走合规层，长视频形态照旧。
- `--dry-run` 用的是长稿 fixture：对 `short` 档**跳过**合规门禁，报告与日志标注「dry-run 使用长稿 fixture，合规层跳过」。

## 事实卡定位约定（拒绝裸生成）

三输入缺一不可。定位顺序（`cli/lib/inputs.mjs` 的 `locateFactCard`）：

1. 工单可选字段 `factCardPath`（相对工单文件解析；存在即用）。
2. 否则按 `filmId` 查 `cli/film-index.json` 的映射表 → 映射目录里按优先级找卡：`事实卡-终版.md` → `事实卡-终版候选.md` → `事实卡-机器底稿.md` → `事实卡.md`。
3. 否则在 `research-runs/` 下模糊找目录名含 `filmId` 且带上述任一事实卡的目录。
4. **仍找不到 → 自动跑采集流水线现造一张机器底稿事实卡**（见「自动采集档」），成功即命中；采不出合格素材才非 0 退出。

`cli/film-index.json` 初始含：`jiudian-daiding → 2026-08-28_酒店代订_采集`、`mac-weixin-duokai → 2026-08-27_mac微信多开_净采4`；自动采集成功会自动追加 `filmId → workshop-<日期>_<filmId>` 一行（幂等）。**新选题手工登记也只需一行。**

### 事实卡成熟度与终审警示

- `locateFactCard` 接受「终版候选」及以上，也接受**纯机器草稿卡**（卡头标「机器组装」/ 受众或结论仍为占位/缺口）。
- 命中机器草稿卡时，`generation-report.md` **顶部加醒目警示**「⚠️ 事实卡为机器草稿，终审时请重点核对数字」，并在「事实卡来源」标注成熟度。
- **无论哪种卡，报告都保留「待用户终审」铁律**——机器只保证不违规/不重复/不像 AI，数字与结论一律人工抽检。

## 模型密钥与第三方 API 配置

模型密钥从环境变量读取。模型层**兼容第三方中转/代理**，不锁死 Anthropic 官方，也可**直接借用本机已登录的 Claude Code CLI 出稿（用订阅额度、免 key）**。环境变量：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `STYLE_LLM_API_KEY` | 是* | 密钥。缺失时人话报错退出（除 `--dry-run`）。*`claude-code` 档免填。 |
| `STYLE_LLM_BASE_URL` | 否 | 中转/代理地址。默认官方（`claude-code` 档不用）。 |
| `STYLE_LLM_MODEL` | 否 | 型号。`anthropic`/`openai` 默认 `claude-opus-5`；`claude-code` 档留空即用本机默认型号。 |
| `STYLE_LLM_PROVIDER` | 否 | `anthropic`（默认）\| `openai` \| `claude-code`。 |

- `anthropic`：走 Anthropic Messages 协议（`POST {base}/v1/messages`，`x-api-key` 鉴权），`baseURL` 可指向 Anthropic 兼容中转。
- `openai`：走 OpenAI 兼容协议（`POST {base}/chat/completions`，`Bearer` 鉴权，`messages` 格式），覆盖绝大多数第三方中转站。
- `claude-code`：不走 HTTP API，`spawn` 本机 `claude -p --output-format json`（headless），完整提示词走 stdin，**用本机已登录的 Claude Code 订阅额度、免 API key**。依赖服务器上已装好并 `claude /login` 登录的 `claude` 命令；工作目录用系统临时目录（隔离本仓库上下文），超时 900s。命令不存在 / 登录失效都翻译成人话。

前两条路径共用同一套提示词组装与输出解析，零依赖（纯 `fetch`，无需装 SDK）。启动时会打印实际 provider / baseURL(脱敏) / model 便于排错；鉴权失败、额度不足、网络不通等都翻译成人话。

### 四种 `.env` 样例

```bash
# ① Anthropic 官方
STYLE_LLM_API_KEY=sk-ant-xxxxx
# provider 默认 anthropic，base/model 用默认即可

# ② Anthropic 兼容中转
STYLE_LLM_PROVIDER=anthropic
STYLE_LLM_API_KEY=<中转站给的key>
STYLE_LLM_BASE_URL=https://your-relay.com        # 该中转的 Anthropic 兼容根地址
STYLE_LLM_MODEL=claude-opus-5

# ③ OpenAI 兼容中转（最常见的第三方代理）
STYLE_LLM_PROVIDER=openai
STYLE_LLM_API_KEY=<中转站给的key>
STYLE_LLM_BASE_URL=https://your-relay.com/v1     # 通常带 /v1
STYLE_LLM_MODEL=claude-opus-5                     # 填该中转支持的型号名

# ④ 本机 Claude Code 订阅额度（免 key）
STYLE_LLM_PROVIDER=claude-code
# 免 STYLE_LLM_API_KEY：直接借用本机已登录的 claude 命令，走订阅额度、共享该机订阅
# STYLE_LLM_MODEL=claude-opus-5                   # 可选；留空用本机 claude 默认型号
# 依赖：服务器已装 claude 命令且已 `claude /login` 登录；未装/登录失效会人话报错
```

## 生成流程

1. 组装系统提示：风格 DNA 全文 + 信任配方十条 + 去 AI 味规则 + 学结构不学词 + 受众锁 + 事实卡全文 + 工单 points/assetsHint，并写死红线（事实只用事实卡、推算带链条、无拿货价不出利润、亲测缺口不编、收入话术禁入、招牌话术硬拦截名单）。
2. 调模型产出**画面驱动分段稿**（`### 段名 / **画面** / **口播** / **目的**`）。
3. 本地跑 `check-ai-flavor`（对纯口播）：`block>0` 把违规项反馈给模型重写，最多重试 3 次；仍 block 则非 0 退出并附报告。**`short` 档同一循环里再跑 `check-copy` 平台合规门禁**（收益承诺/推算/暴富/绝对化/导流/赚钱词密度），与 AI 味共享这 3 次上限；两道任一未过都反馈重写，连续 3 次仍不过非 0 退出。
4. 跑 `check-lexicon` 存报告（warn 不拦）。
5. 从分段稿抽口播拼 `script.txt`：按句号分句、单句 ≤50 字（逗号/分号升级为句号做最小拆分，不改词序）、数字转可念写法（区间用「到」、¥ 用「元」）、消灭破折号。
6. 脚本级校验 storyboard 口播与 `script.txt` 逐字一致（去空白比对）。
7. 写 `generation-report.md`。

## 输出

- `script.txt`：纯口播稿，满足 remotion `docs/handoff/film-input-spec.md` §1（只含要念的字、句号分句、单句 ≤50 字、数字可念）。
- `storyboard.md`：我方画面驱动分段稿，口播字段与 `script.txt` 逐字一致。
- `generation-report.md`：门禁结果 / 用词层警告 / 信任配方自查 / 事实卡来源路径。**报告头写明「待用户终审」——产出永远是草稿态。**

## 质量铁律

- **三输入缺一不可，但不裸生成**：事实卡不存在时不直接放弃，而是自动采集现造一张机器底稿（第二档）；采不出合格素材（无结果/登录失效/超时）才非 0 退出。绝不无事实凭据成稿。
- **产出永远是草稿态**：报告头标「待用户终审」；六道门禁只保证「不违规/不重复/不像 AI」，「可不可信、成不成交、像不像本人」由用户按 `docs/信任配方-保留清单.md` 抽检终审。

## 自动采集档（第二档）

filmId 没有事实卡时，`locateFactCard` 在抛错前自动调 `cli/lib/collect.mjs` 的 `autoCollectFactCard(order)`，以工单 `topic` 为搜索词跑完整流水线，产出 `research-runs/workshop-<日期>_<filmId>/`，登记 `film-index.json`，返回机器底稿卡路径。生成主流程一行不改。

流水线六步（每步中文日志实时透传到 stdout，供面板 SSE）：

1. **闲鱼直采**（`engine/collect/goofish-collect.mjs`）：搜索页 + Top3 详情 + 店铺主页。无结果时采集器**自带切词兜底**降级试更短候选词。
2. **状态判定**：读 `capture.json` 的 `status`（见下方降级表）。
3. **百度需求佐证**（`engine/collect/baidu-demand.mjs`）：下拉联想 / 结果页 / 相关搜索三图 + `demand-manifest.md`。**失败不致命**——降级为「需求层缺口」记入卡，继续。
4. **GitHub 供应线索**：无鉴权 `search API`，按 star 取 Top3 仓库名/星标/描述，写入事实卡并标「自动检索线索，未人工核实」。**失败不致命**——降级为缺口，继续。
5. **组装机器底稿 + 自动补完**（`engine/factcard/build-fact-card.mjs`）：受众＝工单 `audience`；核心结论＝占位「待终审时确认」（不臆造）；供应/需求层按第 3/4 步结果填或标缺口。
6. **登记** `cli/film-index.json`（`filmId → 目录名`，幂等）。

**全程 8 分钟硬超时**，超时人话报错非 0 退出。产出的机器底稿事实卡默认草稿态，进入生成后报告顶部会加醒目警示（见「事实卡成熟度与终审警示」）。

### 降级 / 失败行为表

| 情形 | 判定来源 | 行为 | 退出码 |
| --- | --- | --- | --- |
| 闲鱼有结果（含切词兜底命中） | `capture.status=ok/verified` | 继续组装 | 0（成稿） |
| 闲鱼原词+所有切词候选均无结果 | `status=no_results` | 非 0 退出：「闲鱼搜不到这个选题的商品，请换个说法或走人工流程」 | 非 0 |
| 闲鱼登录失效 | `status=blocked_login` | 非 0 退出：「闲鱼登录已失效，**需人工在风格仿写侧重新登录**后重试」 | 非 0 |
| 闲鱼人机验证（滑块/验证码） | `status=blocked_captcha` | 非 0 退出：人话提示需人工完成验证后重试 | 非 0 |
| 采集/组装崩溃、无 capture.json | 缺文件 / `status=error` | 非 0 退出，附人话原因 | 非 0 |
| 百度需求采集失败/验证码 | baidu-demand 非 0 | **降级**：记「需求层缺口」，继续 | 0（成稿） |
| GitHub 检索失败/超时/无匹配 | 子进程返回 `ok:false` | **降级**：记「供应线索缺口」，继续 | 0（成稿） |
| 全流程超 8 分钟 | 硬超时 | 非 0 退出：「自动采集超过 8 分钟硬超时…请确认采集专用 Chrome 状态后重跑」 | 非 0 |

> 采集专用 Chrome 走独立 profile（`.collect-chrome-profile`）、复用或自启调试端口 9222。登录失效时窗口保留在登录页，人工扫码后重跑本工单即可。

### rewrite 模式（`mode=rewrite`）

- 采集流程照跑（同 topic 模式），额外把原稿整段作为「**来源文案宣称（未核实）**」层写入事实卡：写稿事实一律以实采数据为准，原稿数字不得直接引用。
- 本档为**骨架版**：逐条结构化事实抽取（把原稿数字拆成可核对条目）为 **rewrite 自动档下批交付**。

## 测试

```bash
node --test engine/tests/cli-generate.test.mjs   # 单元测试（provider 校验、拆句、无结果/登录失效报错、film-index 幂等、卡成熟度判定）
npm run lint                                       # node --check 全部文件（含 collect.mjs / baidu-demand.mjs）
node cli/generate.mjs --style qian17 --order <工单> --out <目录> --dry-run   # 全链路离线自测（--dry-run 也会真跑自动采集，仅不调模型）
```

模型层与落盘层（`cli/lib/llm.mjs` / `spoken.mjs` / `gates.mjs` / `report.mjs`）与采集无关，两档共用。
