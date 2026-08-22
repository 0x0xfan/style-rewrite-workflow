# 风格仿写

一个不绑 IP 的双能力引擎：

- **能力一 · 拆解**：给一个 IP 的样本，拆出这个 IP 的写作风格 DNA。
- **能力二 · 仿写**：拿某个 IP 的 DNA，改写你自己的内容。

设计前提是会接入很多个 IP，所以引擎里不允许出现任何具体 IP 的痕迹。钱十七和半佛是当前的两个夹具。

## 结构

```text
engine/          不绑 IP 的引擎：拆解流水线、两个 Skill、夹具、测试
ips/<IP名>/      每个 IP 一个目录，统一为 corpus/dna/audits/generation/outputs
docs/            需求、命令、架构、验证、决策；docs/history/ 存放已归档文档
```

详见 [docs/architecture.md](docs/architecture.md)。

## 常用命令

```bash
npm test
```

拆解新 IP、校验 profile、运行生成门禁的完整命令见 [docs/commands.md](docs/commands.md)。

## 当前状态

没有任何已批准的风格 profile。

- 钱十七：`draft / review_only`，证据链完整（11 单元 / 10 证据簇），但连续三稿被用户拒绝。
- 半佛：手写档案，产出了两稿闲鱼餐饮券文案，但没有证据锚点，也没走任何校验。

下一步是把这两条路线做一次同题对照，判定哪套方法真的有效。详见 [CURRENT.md](CURRENT.md)。

## 核心边界

- 风格拆解只回答“怎么说”，用户输入才回答“说什么”。两者不共享事实字段。
- 来源事实不得流入新稿：收益、案例、截图、账号名、资源清单、平台策略。
- `draft` 永不自动升级为 `approved`；批准必须来自独立记录加五项人工检查。
- 技术门禁通过不等于风格通过。

完整规则见 [AGENTS.md](AGENTS.md)。

## 关键文件

- [CURRENT.md](CURRENT.md)：当前状态和下一步
- [HANDOFF.md](HANDOFF.md)：跨线程继续说明
- [AGENTS.md](AGENTS.md)：Agent 先读规则
- [DECISIONS.md](DECISIONS.md)：历史决策与理由
- [docs/requirements.md](docs/requirements.md)：项目边界和验收标准
- `ips/钱十七/dna/钱十七-DNA-重构版.md`：钱十七人读风格档案
- `ips/半佛/dna/半佛-DNA-可执行版.md`：半佛可执行规则档案
- `C:\Users\admin\.codex\skills\spoken-style-profiler\SKILL.md`：拆解 Skill 真身（仓库外）
