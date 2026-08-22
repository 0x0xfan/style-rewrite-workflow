# 虚构叙事型口播 IP（待人工确认）｜Style DNA

- Profile: narrative-fixture-spoken-ip-v1
- Status: draft
- Domain: zh-short-video-spoken
- Human approval required: yes

## 沟通人格（可观察行为）

### 置身事件的参与式观察者（candidate）

- 定义：说话者从自己身处的日常片段出发，以观察和轻微行动变化承担叙事，而不是站在外部讲大道理。
- 生成动作：只使用目标内容中真实存在的第一人称位置、感知对象和行动变化，不新增旁观权威身份。
- 适用：目标内容确有第一人称场景和可描述的行动或注意力变化。
- 不适用：纯观点、教程、资讯或没有叙事主体时。
- 风险：这是沟通位置，不证明作者现实身份或品格。
- Evidence: narrative-fixture-v1:u01/narrative-fixture-v1:u01:p01/independent:narrative-fixture-v1:u01；narrative-fixture-v1:u02/narrative-fixture-v1:u02:p01/independent:narrative-fixture-v1:u02；narrative-fixture-v1:u03/narrative-fixture-v1:u03:p01/independent:narrative-fixture-v1:u03

### 有边界的个人反思（candidate）

- 定义：结论停留在这次经历可支持的个人理解，不升级为普遍事实或道德裁判。
- 生成动作：把目标内容已有反思写成有范围的个人判断，保留不确定性和说话者立场。
- 适用：目标内容明确给出反思范围和不确定性。
- 不适用：需要给出可验证普遍结论、教程指令或商业承诺时。
- 风险：不得据此推断受众认同或作者价值观。
- Evidence: narrative-fixture-v1:u01/narrative-fixture-v1:u01:p04/independent:narrative-fixture-v1:u01；narrative-fixture-v1:u02/narrative-fixture-v1:u02:p04/independent:narrative-fixture-v1:u02；narrative-fixture-v1:u03/narrative-fixture-v1:u03:p04/independent:narrative-fixture-v1:u03

## 内容策略

### 场景—转向—有界反思（candidate）

- 定义：从普通场景进入，让一个可见细节改变注意力或行动，再将结果收束为不过度外推的反思。
- 生成动作：先按目标事件顺序铺场景，再写真实转向，最后只使用目标内容已有反思。
- 适用：场景、转向和反思三者均有目标内容事实支持。
- 不适用：任一环节只能靠补造人物、事件或结论时。
- 风险：三个合成样本题材相近，不能外推为跨题材稳定策略。
- Evidence: narrative-fixture-v1:u01/narrative-fixture-v1:u01:p02/independent:narrative-fixture-v1:u01；narrative-fixture-v1:u02/narrative-fixture-v1:u02:p02/independent:narrative-fixture-v1:u02；narrative-fixture-v1:u03/narrative-fixture-v1:u03:p02/independent:narrative-fixture-v1:u03

## 内容类型

### 日常片段反思叙事（candidate）

从第一人称日常片段进入，经由注意力或行动的轻微转向，在结尾把具体经历收束为克制的关系性反思。

- Availability: profile_approval_required
- 生成目标：用目标内容自己的场景、转向和反思形成低戏剧性的短叙事。
- Selector required：content.has_scene、content.has_action_turn
- Selector excluded：content.has_steps
- Selector priority：70
- Evidence: narrative-fixture-v1:u01/narrative-fixture-v1:u01:p04/independent:narrative-fixture-v1:u01；narrative-fixture-v1:u02/narrative-fixture-v1:u02:p04/independent:narrative-fixture-v1:u02；narrative-fixture-v1:u03/narrative-fixture-v1:u03:p04/independent:narrative-fixture-v1:u03

## 内容类型框架

### 场景进入—反思落点（两节拍）（candidate）

- 适用：目标内容确有一个可讲述的日常瞬间、主体的注意力或行动发生轻微改变，并可从该改变推出不夸张的个人反思时使用。
- 不适用：只有观点没有可感知场景、需要讲清教程步骤、需要展示复杂证据链，或结尾只能靠强行动号召成立时不使用。
- Availability: profile_approval_required
- Selector required：content.has_scene、content.has_action_turn
- Selector excluded：content.has_steps、content.has_strong_cta
- Selector priority：70

节拍：

1. hook：以第一人称置身于一个具体、低戏剧性的日常场景，建立立即可理解的在场感。（必需）
   - 生成动作：用目标内容已有第一人称位置、场景和轻微张力开场，按感知顺序呈现，不补人物或冲突。
   - 受众意图：create_curiosity
2. summary：在转向后的结尾，将具体片段收束为有条件、不过度自我表彰的个人反思。（必需）
   - 生成动作：把目标内容已有转向连接到有边界的个人反思；没有反思时停在事件结果。
   - 受众意图：leave_reflection

证据路径：narrative-fixture-v1:u01/independent:narrative-fixture-v1:u01；narrative-fixture-v1:u02/independent:narrative-fixture-v1:u02；narrative-fixture-v1:u03/independent:narrative-fixture-v1:u03

## 表达规则

### 具体第一人称场景开场（hook / candidate）

- 公式：第一人称处境 + 具象日常对象或动作 + 尚未解释的轻微张力
- 适用：适用于故事的第一段能由一处可观察场景启动、且后文会解释其意义的反思型短叙事。
- 不适用：不适用于没有叙事主体和场景的纯观点、资讯播报、教程或需要先交代结论的内容。
- 生成动作：用目标内容自己的第一人称位置、具象对象和轻微张力开场，第一段不提前解释全部意义。
- 使用预算：0–1 次；位置 entry
- Avoid when：content.has_steps
- 风险：不要把具象细节误当成可迁移素材；下游必须改用目标内容自己的场景和对象。
- Evidence: narrative-fixture-v1:u01/narrative-fixture-v1:u01:p01/independent:narrative-fixture-v1:u01；narrative-fixture-v1:u02/narrative-fixture-v1:u02:p01/independent:narrative-fixture-v1:u02；narrative-fixture-v1:u03/narrative-fixture-v1:u03:p01/independent:narrative-fixture-v1:u03

### 即时倾向被打断后的关系性领悟（sentence / candidate）

- 公式：原本的即时倾向或路径 + 注意力被具体人、物或记忆打断 + 行动或理解微调 + 不绝对化的关系性领悟
- 适用：适用于来源事实中确有注意力、判断或行动被改变的时刻，并且结尾反思没有超出该事件可支持的范围。
- 不适用：不适用于没有真实转向、只能靠捏造他人需求推动剧情，或需要证明因果结果的内容。
- 生成动作：按目标事实写原始倾向、触发细节和真实转向，再连接到已有反思；不补他人动机。
- 使用预算：0–1 次；位置 body
- Avoid when：content.has_steps
- 风险：不得为了制造感动而添加受助者、回忆或道德动机；也不得把克制反思改写为普遍事实。
- Evidence: narrative-fixture-v1:u01/narrative-fixture-v1:u01:p02/independent:narrative-fixture-v1:u01；narrative-fixture-v1:u02/narrative-fixture-v1:u02:p02/independent:narrative-fixture-v1:u02；narrative-fixture-v1:u03/narrative-fixture-v1:u03:p02/independent:narrative-fixture-v1:u03

### 低戏剧性收束（persuasion / candidate）

- 公式：完成或未完成的小动作 + 回避功劳化或宏大化 + 留下可由观众自行延展的温和结论
- 适用：适用于以普通经历承载情绪或关系判断、且结尾可以容纳余韵的短叙事。
- 不适用：不适用于需要明确指令、交易转化、风险警示或强证据结论的内容。
- 生成动作：用目标事件结果和说话者已有立场完成收束，不加功劳化、宏大化或强行动号召。
- 使用预算：0–1 次；位置 close
- Avoid when：content.has_steps、content.has_strong_cta
- 风险：只是一种表达收束，不能据此推断人物品格、受众反应或社会效果。
- Evidence: narrative-fixture-v1:u01/narrative-fixture-v1:u01:p03/independent:narrative-fixture-v1:u01；narrative-fixture-v1:u02/narrative-fixture-v1:u02:p03/independent:narrative-fixture-v1:u02；narrative-fixture-v1:u03/narrative-fixture-v1:u03:p03/independent:narrative-fixture-v1:u03

### 口播停顿与语速（rhythm / observation）

- 公式：书面转写呈现出短中句交替，但实际口播停顿、重音和语速尚未验证。
- 适用：仅在获得原始音视频或可靠逐字转录后，才可复核为节奏规则。
- 不适用：不得仅依据书面标点用于生成或评价口播节奏。
- 生成动作：保持未知，不依据书面标点生成语速、停顿或重音。
- 使用预算：0–0 次；位置 any
- Avoid when：无
- 风险：将书面标点直接当作口播节奏会造成伪精确。
- Evidence: narrative-fixture-v1:u01/narrative-fixture-v1:u01:p04/independent:narrative-fixture-v1:u01；narrative-fixture-v1:u02/narrative-fixture-v1:u02:p04/independent:narrative-fixture-v1:u02

## 注意力节奏（文本意图）

- Basis: textual_function_inference
- 具象场景进入 0–0.25：用可感知细节建立在场感和轻微疑问；动作：前四分之一只铺目标内容已有场景和轻微张力，不抢先给宏大结论。（candidate）
- 轻微转向 0.25–0.75：让一个真实细节改变注意力、判断或行动；动作：只写目标事实中的真实转向，不为制造感动补角色或动机。（candidate）
- 有界反思收束 0.75–1：留下不过度外推的个人反思；动作：结尾只保留目标内容可支持的个人理解，不升级为普遍道德或行动号召。（candidate）

## 负面风格

- 避免宏大化与自我表彰（candidate）：不要把小动作写成英雄叙事、普遍道德结论或必然社会效果。；依据 observed_contrast；触发 content.has_reflection

## 生成接口状态

- selector 无唯一匹配时必须 abstain。
- 内容锁以外部 content contract 与人工确认的 output audit 为准。
- pattern/avoid span 审计是绑定输出的 bookkeeping，不能单独证明语义正确。
- 纯文本档案不包含 IP 视觉风格。

## 来源与事实边界

- 只沉淀叙事结构、关系型句式、克制收束与证据位置；不沉淀来源人物、地点、物件、事件、具体措辞或情节。
- 下游新稿只能使用目标内容另行提供的场景、主体、事件顺序、结论范围与证据；不得用本档案补造转折或反思。
- 本档案不包含教程、项目、数据、收益、平台操作或 CTA 槽位；没有真实来源支撑时不得由下游添加。

## 局限

- 样本只有 3 个独立单元，且题材均为日常关系性叙事；候选规则不能外推为稳定、跨题材的 IP DNA。
- 没有留出独立样本：3 个单元均用于候选规则融合，不能宣称已完成留出验证。
- 第三单元被样本健康检查标为偏短；不得单独支撑候选规则。
- 源文件是书面文本，未提供音视频或可靠逐字转录；真实语速、停顿、重音与口播表演均保持未知。
- 尚未取得人工对候选内容类型、两节拍框架、样本取舍与来源边界的确认；档案不可选用，严禁批准。

## 人工确认

- [ ] 样本取舍已确认
- [ ] 规则和框架证据已逐项确认
- [ ] 来源事实与 CTA 未进入 DNA
- [ ] 隔离 generation suite 已覆盖正例、拒绝例、fallback、pattern 上限与 avoid trigger
- [ ] 用户明确批准后才可另建 approved 版本
