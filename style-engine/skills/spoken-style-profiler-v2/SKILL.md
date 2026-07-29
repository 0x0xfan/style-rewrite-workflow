---
name: spoken-style-profiler-v2
description: 口播风格提取工具 v2 - 改进版。从样本中提取风格特征，生成分层 Style DNA。包含证据质量分级、减法审查、事实契约分离等改进机制。
---

# spoken-style-profiler-v2

## 核心改进

相比 v1 版本的主要改进：

1. **分层提取策略** - 区分核心主干、稳定辅助、待验证特征
2. **证据质量分级** - A/B/C 级样本分别支持不同类型的规则
3. **减法审查机制** - 每次添加规则后强制对比测试
4. **事实与风格分离** - 严格区分 content-contract 和 style-DNA
5. **对抗式验证** - 正例、负例、误用、破坏性测试集

## 工作流程

### Phase 1: 样本采集与分级
```
输入：原始样本文件（音视频/文本）
输出：samples/sample-{id}.md（含质量分级标记）
```

### Phase 2: 核心主干提取
```
输入：3+ A级或B级样本
输出：style-dna/tier1-core-framework.md
要求：框架、信息优先级、段落职责
```

### Phase 3: 稳定辅助提取
```
输入：2+ A级或B级样本
输出：style-dna/tier2-stable-patterns.md
要求：修辞、包装、过渡承接
```

### Phase 4: 待验证特征标记
```
输入：1个样本的观察
输出：style-dna/tier3-pending-validation.md
要求：显式标注为待验证
```

### Phase 5: 减法审查
```
对每条新规则运行：
1. 生成"只用框架"版本
2. 生成"框架+新规则"版本
3. 人工判断哪个更像目标
4. 决定保留/删除/降权
```

### Phase 6: 对抗式测试
```
正例测试：应该生成
负例测试：应该拒绝
误用测试：应该降级
破坏性测试：应该检测错误
```

## 目录结构

```
spoken-style-profiler-v2/
├── SKILL.md                          # 本文件
├── assets/
│   ├── samples/                      # 样本库
│   │   ├── sample-001.md            # 样本1（含质量分级）
│   │   ├── sample-002.md
│   │   └── quality-checklist.md     # 质量评估清单
│   ├── style-dna/                    # 分层风格档案
│   │   ├── tier1-core-framework.md  # 核心主干（3+样本）
│   │   ├── tier2-stable-patterns.md # 稳定辅助（2+样本）
│   │   ├── tier3-pending.md         # 待验证特征（1样本）
│   │   └── integrated-dna.md        # 合并版（供生成使用）
│   ├── tests/                        # 测试集
│   │   ├── positive-cases/          # 正例（应该生成）
│   │   ├── negative-cases/          # 负例（应该拒绝）
│   │   ├── edge-cases/              # 边界（需要降级/确认）
│   │   └── adversarial-cases/       # 对抗（应该检测错误）
│   ├── generation/                   # 生成测试
│   │   ├── test-001-input.md
│   │   ├── test-001-contract.md     # 事实契约
│   │   ├── test-001-output.md       # 生成结果
│   │   └── test-001-audit.md        # 审计报告
│   ├── subtraction-audit/            # 减法审查记录
│   │   ├── rule-addition-log.md     # 规则添加记录
│   │   └── comparison-results.md    # 对比测试结果
│   └── templates/                    # 模板
│       ├── sample-template.md
│       ├── contract-template.md
│       └── dna-rule-template.md
└── scripts/
    ├── grade-sample.py               # 样本质量评分
    ├── extract-patterns.py           # 模式提取
    ├── subtraction-audit.py          # 减法审查
    └── adversarial-test.py           # 对抗式测试
```

## 使用方式

### 1. 初始化项目
```
spoken-style-profiler-v2 init --target-name "钱十七" --output-dir "./qian17-profile"
```

### 2. 添加样本
```
spoken-style-profiler-v2 add-sample --file "u01.mp4" --transcript "u01.txt"
# 自动评分为 A/B/C 级
```

### 3. 提取核心框架
```
spoken-style-profiler-v2 extract-tier1
# 需要至少 3 个 A/B 级样本
```

### 4. 提取辅助模式
```
spoken-style-profiler-v2 extract-tier2
# 需要至少 2 个 A/B 级样本
```

### 5. 生成测试
```
spoken-style-profiler-v2 generate --input "test-input.md" --contract "test-contract.md"
```

### 6. 运行减法审查
```
spoken-style-profiler-v2 subtraction-audit --rule "新规则ID"
# 生成对比版本，等待人工判断
```

## 核心约定

### 样本质量分级

**A级：可回听音视频 + 高质量转写**
- 支持：框架、策略、句式、节奏、修辞
- 最低数量要求：框架类 2个、句式类 2个、修辞类 3个

**B级：有原文但无音频**
- 支持：框架、策略、句式
- 不支持：真实节奏、停连
- 最低数量要求：框架类 3个、句式类 3个

**C级：低质量单行转写**
- 仅支持：宏观框架、段落职责
- 不支持：句式、词汇、修辞、节奏
- 最低数量要求：框架类 5个
- **禁止**：C级不得单独支持句式类和修辞类规则

### 事实与风格分离

**content-contract.md（事实契约层）**
- 锁定所有数据：数值、主体、范围、条件、时间
- 锁定项目路径：步骤顺序、依赖关系
- 锁定讲述身份：谁在说、谁的经历、谁的数据
- 锁定风险边界：授权、合规、隐私

**style-dna.md（风格表达层）**
- 只提取"怎么说"，不提取"说什么"
- 每条规则明确：适用条件、不适用条件、事实依赖
- 生成时：DNA只能重构表达，不能改变契约层的事实

### 减法审查流程

每次添加新规则后：
1. 生成 baseline 版本（只用已有规则）
2. 生成 new-rule 版本（已有规则 + 新规则）
3. 盲测：让评估者判断哪个更像目标（不告知哪个是哪个）
4. 记录结果：
   - 如果 new-rule 版本更好 → 保留规则，权重 1.0
   - 如果 baseline 版本更好 → 删除规则
   - 如果持平 → 降低规则权重到 0.5
5. 累积 3 次"更差"判断 → 自动删除该规则

### 对抗式测试要求

**正例测试（positive-cases/）**
- 完整信息的标准案例
- 边界条件（最短、最长、最复杂）

**负例测试（negative-cases/）**
- 缺少关键信息（无数据、无步骤、无证据）
- 风格不匹配（纯故事、纯观点、学术论文）
- 事实不清（数据主体不明、条件缺失）
→ 期望行为：拒绝生成或输出警告

**边界测试（edge-cases/）**
- 证据质量不足但可生成
- 需要用户确认的情况
→ 期望行为：降级生成并标注不确定性

**对抗测试（adversarial-cases/）**
- 故意混淆数据主体（案例商品 vs 店铺 vs 个人累计）
- 故意迁移样本事实
- 故意夸大收益
→ 期望行为：检测到错误并拒绝或修正

## 常见触发词

- `初始化风格提取项目` - 创建目录结构
- `添加样本` - 评分并录入样本库
- `提取核心框架` - 生成 tier1 主干
- `提取辅助模式` - 生成 tier2 辅助
- `标记待验证特征` - 记录到 tier3
- `运行减法审查` - 对比测试新规则
- `生成测试稿` - 基于契约+DNA生成
- `运行对抗测试` - 批量测试所有测试集
- `合并风格档案` - 生成 integrated-dna.md

## 关键检查点

### 样本采集阶段
- [ ] 样本质量分级准确
- [ ] 同一文案的不同转写版本已合并
- [ ] 模板复用段落已隔离标注

### 提取阶段
- [ ] 核心框架有 3+ 独立样本支持
- [ ] 辅助模式有 2+ 独立样本支持
- [ ] 单样本观察已标注为待验证
- [ ] 跨层重复已消除（framework/attention/pattern不重复）

### 生成阶段
- [ ] contract 和 DNA 严格分离
- [ ] 数据主体清晰（谁的数据）
- [ ] 数据范围清晰（多久的数据）
- [ ] 条件性收益未写成固定收益

### 审查阶段
- [ ] 每条新规则都运行了减法审查
- [ ] 对抗测试全部通过
- [ ] 事实锁未被风格规则破坏
