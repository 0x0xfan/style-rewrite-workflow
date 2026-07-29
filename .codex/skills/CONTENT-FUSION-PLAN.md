# content-fusion Skill 开发计划

**Skill 名称**: content-fusion  
**版本**: v1.0  
**创建日期**: 2026-07-27  
**执行者**: Codex Agent  
**审查者**: 主 Agent

---

## 🎯 Skill 定位

**核心功能**: 整合**项目事实 + 项目知识 + 风格化**三块内容，生成高质量的闲鱼运营文案。

**与其他 Skill 的关系**:
```
goofish-research (项目事实采集)
    ↓
xianyu-knowledge-writer (项目知识检索)
    ↓
style-loader (风格特征加载)
    ↓
content-fusion (整合生成文案) ← 本 Skill
    ↓
输出: 完整文案 + 视频脚本 + 素材清单
```

---

## 📋 功能需求

### 核心能力

1. **读取项目事实**
   - 从 goofish-research 输出的证据包读取
   - 提取关键数据（需求、价格、竞争）
   - 提取视觉素材清单

2. **检索项目知识**
   - 调用 xianyu-knowledge-writer
   - 根据产品类型和场景检索相关知识
   - 获取避坑建议和话术模板

3. **加载风格特征**
   - 读取风格卡（如钱十七）
   - 提取 persona、框架、句式特征
   - 可选：不加载风格卡则使用通用风格

4. **智能融合生成**
   - 将 3 块内容有机融合
   - 生成 B 站口播视频文案
   - 或生成闲鱼标题、商品描述等

5. **输出完整素材包**
   - 文案（分段、有时间轴）
   - 视频脚本（画面 + 口播 + 时间戳）
   - 素材清单（截图、数据来源）
   - 合规报告（违规词检查）

---

## 🏗️ 技术架构

### 文件结构

```
content-fusion/
├── skill.md                    # Skill 定义
├── main.py                     # 主流程
├── config.yaml                 # 配置
├── requirements.txt            # 依赖
├── modules/
│   ├── fact_loader.py          # 项目事实加载器
│   ├── knowledge_retriever.py  # 知识检索器
│   ├── style_loader.py         # 风格加载器
│   ├── content_generator.py    # 内容生成引擎
│   └── output_formatter.py     # 输出格式化
├── templates/
│   ├── video_script.j2         # 视频脚本模板
│   ├── product_title.j2        # 商品标题模板
│   └── product_desc.j2         # 商品描述模板
├── prompts/
│   ├── video_content.txt       # 视频文案生成 Prompt
│   ├── title_optimization.txt  # 标题优化 Prompt
│   └── description.txt         # 描述生成 Prompt
└── examples/
    └── 统计年鉴数据/
        ├── input.yaml          # 输入示例
        ├── output/             # 输出示例
        │   ├── video_script.md
        │   ├── titles.json
        │   └── compliance_report.json
```

---

## 📝 详细设计

### 输入 Schema

```yaml
# 必需参数
product_name: "统计年鉴数据"
scenario: "video"  # video / title / description / script

# 项目事实来源
evidence_package: "path/to/goofish-research/evidence-package/"

# 知识检索参数
knowledge_params:
  product_type: "虚拟产品"
  tags: ["选品策略", "标题优化"]
  include_scripts: true

# 风格参数（可选）
style_params:
  style_card: "钱十七"  # 可选，不指定则使用通用风格
  tone: "亲切"
  length: "中"  # 短/中/长

# 输出参数
output_params:
  format: ["markdown", "json"]
  include_compliance_report: true
  include_material_list: true
```

### 输出 Schema

#### 场景 1: B站视频文案

```json
{
  "meta": {
    "product_name": "统计年鉴数据",
    "scenario": "video",
    "generated_at": "2026-07-27T12:00:00",
    "style_card": "钱十七"
  },
  
  "video_script": {
    "total_duration": "360s",
    "sections": [
      {
        "section": "开头钩子",
        "timestamp": "0-10s",
        "narration": "一个 9.9 元的统计年鉴，921 个人想要...",
        "visual": {
          "screenshot": "product-123456-title-annotated.png",
          "action": "放大价格和想要数",
          "source": "goofish-research"
        },
        "fact_source": "market_facts.top_wants[0] = 921",
        "knowledge_source": null,
        "style_feature": "痛点开场，反差钩子"
      },
      {
        "section": "需求验证",
        "timestamp": "30-45s",
        "narration": "我搜了一下「统计年鉴」，发现...",
        "visual": {
          "screenshot": "search-统计年鉴-overview.png",
          "action": "展示搜索结果数",
          "source": "goofish-research"
        },
        "fact_source": "search_results.total = 1234",
        "knowledge_source": "如何验证闲鱼需求.md",
        "style_feature": "数据验证，建立可信度"
      }
    ]
  },
  
  "compliance_report": {
    "violations_found": 0,
    "safe": true,
    "checked_at": "2026-07-27T12:00:00"
  },
  
  "material_list": {
    "screenshots": ["product-123456-title.png", "search-overview.png"],
    "knowledge_articles": ["如何验证闲鱼需求.md", "虚拟产品避坑指南.md"],
    "data_sources": ["goofish-research/analysis.json"]
  },
  
  "suggestions": [
    {
      "type": "improvement",
      "message": "可以增加对比其他平台的价格，增强说服力"
    }
  ]
}
```

#### 场景 2: 闲鱼标题优化

```json
{
  "meta": {
    "product_name": "统计年鉴数据",
    "scenario": "title",
    "generated_at": "2026-07-27T12:00:00"
  },
  
  "titles": [
    {
      "title": "2023年统计年鉴Excel 省级数据 论文用",
      "score": 9.2,
      "reasoning": {
        "fact_basis": "高频词: 2023(53%), Excel(45%), 省级(29%)",
        "knowledge_basis": "标题前置核心关键词，提高搜索曝光",
        "style_basis": "简洁直接，符合闲鱼用户搜索习惯"
      },
      "optimization": [
        "包含年份（2023）- 时效性",
        "包含格式（Excel）- 明确交付物",
        "包含用途（论文用）- 精准受众"
      ],
      "compliance": {"safe": true}
    },
    {
      "title": "统计年鉴数据整理好 省市县三级 毕业设计",
      "score": 8.8,
      "reasoning": {
        "fact_basis": "痛点关键词: 整理(35个商品提到)",
        "knowledge_basis": "强调「整理好」解决用户痛点",
        "style_basis": "痛点导向，吸引懒人用户"
      }
    }
  ],
  
  "compliance_report": {"safe": true},
  
  "material_list": {
    "fact_sources": ["title_patterns", "high_freq_words"],
    "knowledge_sources": ["标题优化技巧.md"]
  }
}
```

---

## 🔧 核心模块设计

### 模块 1: fact_loader.py

**功能**: 加载项目事实证据包

```python
class FactLoader:
    def __init__(self, evidence_path: str):
        self.evidence_path = Path(evidence_path)
        
    def load(self) -> Dict:
        """
        加载完整证据包
        
        返回:
        {
            "meta": {...},
            "market_facts": {...},
            "demand_facts": {...},
            "competition_facts": {...},
            "supply_facts": {...},
            "screenshots": {...}
        }
        """
        pass
    
    def get_key_data(self) -> Dict:
        """
        提取关键数据（供文案使用）
        
        返回:
        {
            "top_want": 921,
            "main_price": [5, 10],
            "target_audience": "学生",
            "core_pain": "整理",
            "high_freq_words": ["2023", "Excel"],
            "price_tiers": [...]
        }
        """
        pass
```

### 模块 2: knowledge_retriever.py

**功能**: 检索项目知识

```python
class KnowledgeRetriever:
    def __init__(self, knowledge_client):
        self.client = knowledge_client
    
    def retrieve_for_scenario(self, scenario: str, product_type: str, tags: List[str]) -> Dict:
        """
        根据场景检索知识
        
        场景:
        - video: 检索实战案例、避坑建议
        - title: 检索标题优化技巧
        - description: 检索卖点描述话术
        
        返回:
        {
            "articles": [...],
            "scripts": [...],
            "pitfalls": [...],
            "best_practices": [...]
        }
        """
        pass
    
    def check_compliance(self, text: str) -> Dict:
        """违规词检查"""
        pass
```

### 模块 3: style_loader.py

**功能**: 加载风格特征

```python
class StyleLoader:
    def load_style_card(self, style_name: str) -> Dict:
        """
        加载风格卡
        
        返回:
        {
            "persona": "接地气的实战派",
            "framework": "痛点开场 → 数据验证 → 实操演示 → CTA",
            "tone": "亲切、不装、有共鸣",
            "sentence_patterns": [
                "很多人...，但...",
                "你看...",
                "这个..."
            ],
            "hooks": ["数据 + 反差", "具体数字 + 悬念"],
            "avoid": ["空洞鸡血", "复读模板", "收益承诺"]
        }
        """
        pass
```

### 模块 4: content_generator.py（核心）

**功能**: 融合 3 块内容生成文案

```python
class ContentGenerator:
    def __init__(self, facts, knowledge, style):
        self.facts = facts
        self.knowledge = knowledge
        self.style = style
    
    def generate_video_script(self) -> Dict:
        """
        生成 B 站视频文案
        
        流程:
        1. 构建开头钩子（用事实 + 风格）
        2. 需求验证（用事实数据）
        3. 价值说明（用知识经验）
        4. 实操演示（用事实 + 知识）
        5. 避坑提示（用知识）
        6. CTA（用风格）
        """
        pass
    
    def generate_titles(self, count: int = 5) -> List[Dict]:
        """
        生成闲鱼标题（多个方案）
        
        结合:
        - 事实: 高频词、标题模式
        - 知识: 标题优化技巧
        - 风格: 语言特点
        """
        pass
    
    def generate_description(self) -> Dict:
        """
        生成商品描述
        
        结合:
        - 事实: 价格、竞品分析
        - 知识: 卖点话术、交付边界
        - 风格: 表达方式
        """
        pass
    
    def _build_prompt(self, scenario: str) -> str:
        """
        构建生成 Prompt
        
        Prompt 结构:
        ## 项目事实
        {从 facts 提取的关键数据}
        
        ## 知识参考
        {从 knowledge 提取的经验和技巧}
        
        ## 风格要求
        {从 style 提取的特征}
        
        ## 任务
        {具体的生成任务}
        
        ## 约束
        - 禁用违规词: {违规词列表}
        - 所有数据必须有来源
        - 避免空洞承诺
        """
        pass
    
    def _call_llm(self, prompt: str) -> str:
        """
        调用 LLM 生成内容
        
        可选:
        - Claude API
        - GPT API
        - 本地模型
        """
        pass
```

### 模块 5: output_formatter.py

**功能**: 格式化输出

```python
class OutputFormatter:
    def format_video_script(self, content: Dict) -> str:
        """
        格式化视频脚本
        
        输出 Markdown:
        # B站视频脚本 - 统计年鉴数据
        
        ## 开头钩子 (0-10s)
        
        **画面**: product-123456-title.png
        **动作**: 放大价格和想要数
        
        **口播**:
        一个 9.9 元的统计年鉴，921 个人想要...
        
        **数据来源**: goofish-research/market_facts.top_wants[0]
        """
        pass
    
    def format_titles(self, titles: List[Dict]) -> str:
        """格式化标题方案"""
        pass
    
    def generate_compliance_report(self, checks: List[Dict]) -> Dict:
        """生成合规报告"""
        pass
    
    def generate_material_list(self, sources: Dict) -> Dict:
        """生成素材清单"""
        pass
```

---

## 📄 Prompt 设计

### video_content.txt

```
# B站口播视频文案生成任务

你是一位闲鱼运营专家，需要基于真实的项目事实、实战知识和风格特征，生成一篇 B 站口播视频文案。

## 项目事实

### 市场数据
- Top 1 商品想要数: {top_want}
- 主力价格带: {main_price[0]}-{main_price[1]} 元
- 搜索结果数: {search_count}
- 目标受众: {target_audience}

### 需求分析
- 核心痛点: {core_pain}
- 使用场景: {usage_scenarios}
- 需求密度: {wants_density}

### 竞争态势
- 卖家数量: {seller_count}
- 竞争强度: {competition_level}

## 知识参考

### 相关经验文章
{knowledge_articles}

### 避坑建议
{pitfalls}

### 话术模板
{scripts}

## 风格要求

### Persona
{style.persona}

### 框架
{style.framework}

### 语言特点
- 语气: {style.tone}
- 句式: {style.sentence_patterns}
- 避免: {style.avoid}

## 任务

生成一篇 300-400 字的 B 站口播视频文案，要求:

1. **开头钩子** (0-10s)
   - 使用具体数据（价格、想要数）
   - 制造反差或悬念
   - 符合风格特征

2. **需求验证** (30-45s)
   - 展示搜索数据
   - 说明目标人群
   - 验证需求真实性

3. **价值说明** (45-90s)
   - 解释为什么这个品好卖
   - 融入知识库的经验
   - 说明机会点

4. **实操演示** (90-240s)
   - 讲解价格策略
   - 展示标题技巧
   - 说明交付方式

5. **避坑提示** (240-300s)
   - 融入知识库的避坑建议
   - 具体且实用

6. **CTA** (300-360s)
   - 自然引导关注/私信
   - 符合风格特征

## 约束

- 禁止使用以下违规词: {violation_words}
- 所有数据必须来自项目事实，不要编造
- 避免空洞承诺（"零成本"、"躺赚"等）
- 避免复读模板句式
- 确保每 20-30 秒有屏幕动作

## 输出格式

请按以下格式输出:

### 开头钩子 (0-10s)
口播: ...
画面: ...

### 需求验证 (30-45s)
口播: ...
画面: ...

...
```

---

## 🧪 测试用例

### 测试用例 1: B站视频文案

**输入**:
```yaml
product_name: "统计年鉴数据"
scenario: "video"
evidence_package: "goofish-research/evidence-package/"
knowledge_params:
  product_type: "虚拟产品"
  tags: ["选品策略", "避坑指南"]
style_params:
  style_card: "钱十七"
  tone: "亲切"
  length: "中"
```

**预期输出**:
- 300-400 字视频文案
- 6 个段落（开头、需求、价值、实操、避坑、CTA）
- 每段有口播 + 画面 + 数据来源
- 无违规词
- 符合钱十七风格

### 测试用例 2: 闲鱼标题

**输入**:
```yaml
product_name: "统计年鉴数据"
scenario: "title"
evidence_package: "goofish-research/evidence-package/"
knowledge_params:
  tags: ["标题优化"]
```

**预期输出**:
- 5 个标题方案
- 每个有评分和优化说明
- 基于高频词和标题模式
- 融入知识库的优化技巧

---

## ✅ 验收标准

### 功能验收（100分）

1. **项目事实读取** (15分)
   - [ ] 能读取 goofish-research 证据包
   - [ ] 提取关键数据（想要数、价格、痛点等）
   - [ ] 提取视觉素材清单

2. **知识检索** (15分)
   - [ ] 能调用 xianyu-knowledge-writer
   - [ ] 根据场景检索相关知识
   - [ ] 获取话术和避坑建议

3. **风格加载** (10分)
   - [ ] 能加载风格卡
   - [ ] 提取 persona、框架、句式
   - [ ] 不加载风格卡时使用通用风格

4. **内容生成** (40分)
   - [ ] 生成 B 站视频文案（300-400字）
   - [ ] 生成闲鱼标题（5个方案）
   - [ ] 内容融合了 3 块来源
   - [ ] 数据来源可追溯

5. **输出质量** (20分)
   - [ ] 格式规范（JSON + Markdown）
   - [ ] 包含合规报告
   - [ ] 包含素材清单
   - [ ] 有优化建议

### 质量验收

1. **融合度**
   - 事实、知识、风格三者自然融合
   - 不生硬拼凑

2. **可追溯性**
   - 每个关键数据标注来源
   - 可回溯到原始证据

3. **合规性**
   - 无违规词
   - 数据真实，不编造

4. **实用性**
   - 可直接用于录制视频
   - 可直接用于发布商品

---

## 🚀 实施指令

**给 Codex Agent 的指令**:

```
请实施 content-fusion Skill v1.0。

工作目录: D:\项目仓库\风格仿写\.codex\skills\content-fusion

实施步骤:
1. 创建完整的目录结构
2. 实现 5 个核心模块
3. 设计 3 个 Prompt 模板
4. 创建测试用例
5. 用"统计年鉴数据"生成示例输出

关键要求:
- 能读取 goofish-research 的证据包
- 能调用 xianyu-knowledge-writer 的 API
- 能加载风格卡（钱十七）
- 生成的内容要自然融合 3 块来源
- 所有数据可追溯

测试要求:
- 生成 1 个完整的 B 站视频文案
- 生成 5 个闲鱼标题方案
- 验证合规性
- 验证可追溯性

完成后提交:
- 所有模块代码
- Prompt 模板
- 示例输出
- 实施报告
```

---

## 📊 预期成果

完成后，content-fusion 应该能够:

**输入**: 产品名 + 场景 + 证据包路径  
**输出**: 完整的文案素材包

**示例**:
```bash
python main.py \
  --product "统计年鉴数据" \
  --scenario video \
  --evidence "goofish-research/evidence-package/" \
  --style "钱十七"

# 输出:
# output/
# ├── video_script.md       # B站视频文案
# ├── material_list.json    # 素材清单
# └── compliance_report.json # 合规报告
```

---

**方案制定人**: 主 Agent  
**日期**: 2026-07-27  
**状态**: 待执行  
**预计完成时间**: 2-3 小时
