# 风格仿写项目 - 补全生成引擎执行计划

**创建时间**: 2026-07-25  
**目标**: 补全从"用户文案"到"风格仿写稿"的完整自动化链路  
**当前状态**: 有风格拆解能力，缺生成/仿写能力

---

## 一、现状分析

### ✅ 已有能力
1. **风格拆解 Skill** (`spoken-style-profiler`)
   - 从样本提取 Style DNA
   - 验证、审计、对抗测试
   - 生成人类可读的风格文档

2. **钱十七风格档案** (draft 状态)
   - 完整的 Style DNA 规则
   - 唯一人类可读主文件: `style-engine/evaluation/spoken-style-profiler-qian17/钱十七-DNA-重构版.md`
   - 机器审计契约: `style-engine/evaluation/spoken-style-profiler-qian17/style-dna.draft.json`
   - 包含: 框架、表达规则、负面风格清单

3. **测试基础设施**
   - Contract 模板
   - 验证器
   - 泄漏检测

### ❌ 缺失能力
1. **没有自动化的仿写生成引擎**
2. **没有 contract → 文案 的生成 skill**
3. **没有批量仿写能力**
4. **现有的改写接口已暂停开发**

---

## 二、目标架构

```
用户输入原始文案
    ↓
[事实提取器] → source-contract.md
    ↓
[风格选择器] → 选择钱十七 Style DNA
    ↓
[仿写生成器] → 应用风格规则生成文案
    ↓
[自动验证器] → 检查数据保留、禁用词、泄漏
    ↓
输出最终文案 + 验证报告
```

---

## 三、执行计划（分阶段）

### 🎯 阶段 1：创建仿写生成 Skill（核心）

**任务 1.1**: 创建 `style-copywriter` skill
- **位置**: `style-engine/skills/style-copywriter/`
- **功能**:
  - 读取 source-contract.md（用户项目事实）
  - 读取 Style DNA（风格规则）
  - 根据 DNA 中的框架和表达规则生成文案
  - 输出生成稿 + 元数据

**任务 1.2**: 定义生成器输入输出规范
- **输入格式**:
  ```json
  {
    "contract_path": "path/to/source-contract.md",
    "style_dna_path": "path/to/style-dna.draft.json",
    "generation_config": {
      "framework": "fw-low-barrier-project",  // 可选，自动选择
      "intensity": 0.6,  // 风格强度 0-1
      "target_length": "auto"  // 或具体字数
    }
  }
  ```

- **输出格式**:
  ```json
  {
    "output_path": "path/to/generated-copy.md",
    "metadata": {
      "framework_used": "fw-low-barrier-project",
      "rules_applied": ["pt-data-meaning-value", "pt-section-value-bridge", ...],
      "generation_timestamp": "2026-07-25T...",
      "validation_status": "pending"
    }
  }
  ```

**任务 1.3**: 实现核心生成逻辑
- **文件**: `style-engine/skills/style-copywriter/SKILL.md`
- **核心流程**:
  1. 解析 contract，提取关键事实（数据、主体、步骤、CTA）
  2. 读取 Style DNA，识别适用的框架（selector 匹配）
  3. 按框架的节拍（beats）组织内容
  4. 应用表达规则（patterns）
  5. 检查负面风格（avoids）
  6. 输出文案

**任务 1.4**: 创建 Skill 配置文件
- `style-engine/skills/style-copywriter/SKILL.md` - 主文档
- `style-engine/skills/style-copywriter/QUICKSTART.md` - 快速使用指南
- `style-engine/skills/style-copywriter/config.json` - 默认配置

---

### 🎯 阶段 2：创建事实提取器（辅助）

**任务 2.1**: 创建 contract 提取器
- **位置**: `style-engine/skills/style-copywriter/contract-extractor.md`
- **功能**:
  - 从用户原始文案中提取结构化事实
  - 自动识别：数据主体、数字、步骤、结果、CTA
  - 生成 source-contract.md

**任务 2.2**: 定义提取模板
- **基于**: `style-engine/skills/spoken-style-profiler-v2/assets/templates/contract-template.md`
- **增强**:
  - 自动数据主体检测
  - 模糊表述标记（"某店铺"/"案例"等）
  - 风险表述识别

---

### 🎯 阶段 3：集成验证层

**任务 3.1**: 复用现有验证器
- **位置**: `style-engine/skills/spoken-style-profiler-v2/assets/tests/`
- **集成到生成流程**:
  - 生成后自动运行验证
  - 检查项:
    - 数据保留（16组数字是否都在）
    - 数据主体明确性
    - 禁用词检测
    - 来源泄漏扫描（20字符连续重合）

**任务 3.2**: 创建生成验证报告模板
- **输出**: `generation-validation-report.md`
- **内容**:
  - ✅ 通过项
  - ⚠️ 警告项
  - ❌ 失败项
  - 建议修改

---

### 🎯 阶段 4：端到端测试

**任务 4.1**: 使用钱十七 DNA 进行测试
- **测试用例**: 使用一个新的项目文案（非闲鱼虚拟资料）
- **流程**:
  1. 准备原始文案
  2. 生成 contract
  3. 调用生成器
  4. 验证输出
  5. 人工评审

**任务 4.2**: 创建测试案例库
- **位置**: `style-engine/evaluation/style-copywriter-tests/`
- **结构**:
  ```
  test-case-001/
    ├── source-raw.md          # 原始文案
    ├── source-contract.md     # 提取的事实
    ├── generated-copy.md      # 生成的仿写稿
    ├── validation-report.md   # 验证报告
    └── human-review.md        # 人工评审
  ```

**任务 4.3**: 对比测试
- 生成稿 vs 当前唯一风格主文件与独立验证报告
- 评估维度:
  - 风格符合度
  - 事实准确性
  - 可读性
  - 生成速度

---

### 🎯 阶段 5：优化与批量能力

**任务 5.1**: 批量生成接口
- **功能**: 一次输入多个项目，批量生成
- **输入**:
  ```json
  {
    "batch_contracts": [
      "contracts/project-001.md",
      "contracts/project-002.md",
      "contracts/project-003.md"
    ],
    "style_dna": "qian17",
    "output_dir": "outputs/batch-001/"
  }
  ```

**任务 5.2**: 生成质量评分
- 自动评分维度:
  - 规则覆盖率（应用了多少个 pattern）
  - 数据密度（多少个具体数字）
  - 口语化程度（短句比例）
  - 负面风格命中数（越少越好）

**任务 5.3**: 创建生成日志
- 记录每次生成的:
  - 输入参数
  - 使用的规则
  - 生成时间
  - 验证结果
  - 用户反馈

---

## 四、优先级与时间估算

### 🔥 高优先级（必须完成）
- [x] **任务 1.1-1.3**: 创建基础生成 skill（2-3小时）
- [x] **任务 3.1**: 集成验证器（1小时）
- [x] **任务 4.1**: 端到端测试（1小时）

### 🟡 中优先级（强烈建议）
- [ ] **任务 2.1-2.2**: 事实提取器（1-2小时）
- [ ] **任务 4.2-4.3**: 测试案例库（1小时）

### 🟢 低优先级（可延后）
- [ ] **任务 5.1-5.3**: 批量能力与优化（2-3小时）

**总计**: 核心功能约 4-5 小时，完整功能约 8-10 小时

---

## 五、技术细节

### 5.1 Style DNA 解析策略

从 `style-dna.draft.json` 中读取：

1. **框架选择** (Selector Matching)
   ```
   读取 ## 内容类型框架 部分
   → 匹配 Selector required/excluded
   → 选择 priority 最高的框架
   ```

2. **节拍应用** (Beats Application)
   ```
   读取框架的节拍（beats）列表
   → 按顺序执行生成动作
   → hook → explanation → method → cta
   ```

3. **表达规则** (Pattern Application)
   ```
   读取 ## 表达规则 部分
   → 筛选 使用预算 > 0 的规则
   → 按位置（entry/body/close）应用
   → 检查 Avoid when 条件
   ```

4. **负面风格检查** (Avoid Patterns)
   ```
   读取 ## 六、负面风格（禁止清单）
   → 生成后逐条检查
   → 发现违规 → 重写或标记
   ```

### 5.2 Contract 解析策略

从 `source-contract.md` 中提取：

```markdown
## 项目核心
- 提取：主题、定位、目标受众

## 关键数据
- 提取：数字、主体、时间范围
- 验证：数据主体是否明确

## 操作步骤
- 提取：编号步骤、动作、结果

## 交付与收益
- 提取：具体收益、条件、证据

## CTA
- 提取：行动号召
```

### 5.3 生成 Prompt 模板

```
你是一个风格仿写引擎，严格按照给定的 Style DNA 规则生成文案。

## 输入
1. 项目事实（Contract）:
{contract_content}

2. 风格规则（Style DNA）:
- 框架: {framework_name}
- 节拍: {beats_list}
- 表达规则: {patterns_list}
- 负面风格: {avoids_list}

## 要求
1. 严格按照框架的节拍组织内容
2. 应用所有适用的表达规则（检查使用预算和位置）
3. 禁止使用负面风格清单中的所有表达方式
4. 保留 Contract 中的所有数据，数据主体必须明确
5. 生成的文案应该是口语化的、可以直接朗读的

## 输出
直接输出完整的口播文案，不要包含任何元数据或说明。
```

---

## 六、验收标准

### 核心功能验收
- [ ] 能够读取 contract 和 Style DNA
- [ ] 能够自动选择合适的框架
- [ ] 能够生成完整的口播文案
- [ ] 生成的文案通过基础验证（数据保留、禁用词）

### 质量验收
- [ ] 生成稿与手工稿的风格相似度 > 80%
- [ ] 所有数据主体明确，无模糊表述
- [ ] 禁用词命中数 = 0
- [ ] 来源泄漏 20 字符连续重合 = 0

### 可用性验收
- [ ] 有完整的使用文档
- [ ] 有测试用例和示例
- [ ] 端到端流程可在 5 分钟内完成
- [ ] 错误信息清晰，可定位问题

---

## 七、风险与应对

### 风险 1：生成质量不稳定
**应对**: 
- 使用温度参数控制随机性
- 多次生成取最佳
- 人工审阅机制

### 风险 2：规则冲突
**应对**:
- 规则优先级机制
- 冲突检测与报警
- 人工决策接口

### 风险 3：性能问题
**应对**:
- 缓存 DNA 解析结果
- 批量生成并行化
- 渐进式输出

---

## 八、后续扩展方向

1. **多风格支持**
   - 除了钱十七，支持其他 IP 风格
   - 风格混合（70% 钱十七 + 30% 另一个 IP）

2. **交互式优化**
   - 用户标记不满意的段落
   - 系统自动重写该段落

3. **A/B 测试**
   - 同一 contract 生成多个版本
   - 用户选择最佳版本
   - 反馈用于优化规则权重

4. **视觉化 DNA 编辑器**
   - 图形界面编辑风格规则
   - 实时预览生成效果

---

## 九、开始执行

### 立即开始（第一步）
```bash
# 1. 创建 skill 目录结构
mkdir -p "D:\项目仓库\风格仿写\style-engine\skills\style-copywriter"
mkdir -p "D:\项目仓库\风格仿写\style-engine\skills\style-copywriter\assets"
mkdir -p "D:\项目仓库\风格仿写\style-engine\skills\style-copywriter\examples"

# 2. 创建测试目录
mkdir -p "D:\项目仓库\风格仿写\style-engine\evaluation\style-copywriter-tests\test-case-001"

# 3. 复制模板文件（如果需要）
# ...
```

### 关键文件清单
执行完成后应该创建以下文件：

**核心文件**:
- `style-engine/skills/style-copywriter/SKILL.md` - 主 skill 文档
- `style-engine/skills/style-copywriter/QUICKSTART.md` - 快速指南
- `style-engine/skills/style-copywriter/generator-core.md` - 生成器核心逻辑
- `style-engine/skills/style-copywriter/contract-parser.md` - Contract 解析器

**资产文件**:
- `style-engine/skills/style-copywriter/assets/prompt-template.md` - 生成 prompt 模板
- `style-engine/skills/style-copywriter/assets/validation-checklist.md` - 验证清单

**测试文件**:
- `style-engine/evaluation/style-copywriter-tests/test-case-001/source-raw.md`
- `style-engine/evaluation/style-copywriter-tests/test-case-001/source-contract.md`
- `style-engine/evaluation/style-copywriter-tests/README.md` - 测试说明

---

## 十、执行检查点

每完成一个阶段，执行以下检查：

### ✅ 阶段 1 完成检查
- [ ] `style-copywriter` skill 目录存在
- [ ] SKILL.md 文档完整
- [ ] 能够解析 Style DNA
- [ ] 能够解析 contract
- [ ] 能够输出文本（即使质量不高）

### ✅ 阶段 2 完成检查
- [ ] 事实提取器能够识别数据主体
- [ ] 能够标记模糊表述
- [ ] 生成的 contract 格式正确

### ✅ 阶段 3 完成检查
- [ ] 验证器能够自动运行
- [ ] 生成验证报告
- [ ] 报告包含具体问题定位

### ✅ 阶段 4 完成检查
- [ ] 至少 1 个测试用例通过
- [ ] 端到端流程运行成功
- [ ] 生成稿可读且符合基本风格

---

## 附录：参考文件路径

### 现有资源
- 钱十七人类可读主文件: `style-engine/evaluation/spoken-style-profiler-qian17/钱十七-DNA-重构版.md`
- 钱十七机器审计契约: `style-engine/evaluation/spoken-style-profiler-qian17/style-dna.draft.json`
- Contract 示例: `style-engine/evaluation/style-copywriter-tests/test-case-001/source-contract.md`
- 验证器: `style-engine/skills/spoken-style-profiler-v2/assets/tests/`

### 新建资源
- 生成器 skill: `style-engine/skills/style-copywriter/`
- 测试案例: `style-engine/evaluation/style-copywriter-tests/`

---

**最后更新**: 2026-07-25  
**状态**: 🔥 高优先级任务已完成；阶段 2 与阶段 5 待后续指令  
**预计完成时间**: 4-10 小时（根据优先级）
