# 生成工作流

## 1. Parse Input

Create a quick internal brief:

- `主题`: the product/project.
- `目标观众`: who should care.
- `核心利益`: save time, make money, avoid mistakes, get leads, find demand.
- `证据`: numbers, screenshots, cases, platform data.
- `交付物`: resource, table, tool, template, community, course, consultation.
- `风险`: exaggerated income, platform violation, sensitive product, unsafe advice.
- `讲述者`: who explains the case.
- `目标观众`: who should take action after watching.
- `案例买家`: whose pain proves demand.
- `内容目标`: what the target viewer should learn, sell, test, or earn from.

Separate the project fact contract from all other material. Only facts in that contract may become project-specific claims in the audience copy.

Stop and resolve the brief when `目标观众` and `案例买家` are the same only by accident. In a side-project breakdown, the seller/operator stays the viewpoint; the buyer appears only as demand evidence.

## 2. Retrieve and Gate Knowledge

For every full script, require three inputs: project facts, relevant knowledge, and the 钱十七 style profile.

- Obtain a nonempty knowledge pack or retrieval result from the intended knowledge base before drafting. If it is absent or cannot be retrieved, stop with `knowledge_input_required`.
- If no pack is supplied, call `KnowledgeRetriever` from `D:\项目仓库\风格仿写\.codex\skills\content-fusion\modules\knowledge_retriever.py` against `D:\项目仓库\闲鱼知识库\scripts\knowledge_api.py`, then call `build_knowledge_pack(...)`. The resulting pack must use schema `1.0` and be saved with the generation artifacts.
- Form queries from `主题 + 目标观众 + 核心问题 + 内容类型`; never replace this retrieval with remembered general advice.
- Check relevance against the project and planned script. If no result is relevant, stop with `knowledge_no_relevant_result`.
- Privately select 2–4 relevant items and map each to a major section. Record item ID/source, relevance, intended section, and whether it was used; at least one selected item must be used.
- Use knowledge only to improve explanation, method, mechanism, or risk handling. Do not copy its project-specific numbers, cases, earnings, platform claims, results, dates, or endorsements into the audience script unless independently verified and added to the fact contract.
- Keep sources, retrieval results, and the mapping private metadata; never show them in the audience-facing script.

## 3. Choose Script Frame

- 新手入门: `四大核心维度` or `三步起号/入门`.
- 选品/货源: `先讲不能做 -> 再讲怎么选 -> 最后给清单`.
- 项目拆解: `具体案例/结果摆到台面 -> 说明为什么成立 -> 边拆准备、上架和交付边给动作 -> 回到案例算收益`.
- 赚钱项目: `项目和市场信号 -> 观众能拿什么能力去卖 -> 买家为什么付费 -> 服务包装 -> 定价和情景算账 -> 固定交付 -> CTA`.
- 案例复盘: `结果 -> 为什么能成 -> 复制步骤 -> 注意事项`.
- 工具/表格引流: `痛点 -> 表格价值 -> 使用方法 -> 领取方式`.

## 4. Draft Skeleton

Use this skeleton:

```text
[Hook: 具体项目 + 一个数字/结果/疑问]

[场景化价值预演：目标观众学完后的生活/身份/动作/效率/收益画面]
[本次要讲通的路径]

[先看案例为什么成立]
[主要章节包装：下一知识点会带来什么可支持的具体变化 -> 进入方法]
[案例中的动作与结果]
[换一种场景继续包装下一主要章节 -> 进入方法]
[继续拆案例中的动作]

[必要风险：只在对应动作旁短提]
[结果/收益机制]
[中段互动 + 截图/保存节点]

[资料/表格/工具 CTA]
[总结 + 下期钩子 + 结束语]
```

## 5. Fill Evidence

- Use exact user-provided numbers where available.
- If a number is uncertain, mark `[待核实：...]`.
- If a screenshot is needed, place it right after the sentence that references it.
- If proof is weak, present it as a test idea, not a proven result.
- Draw method, mechanism, explanation, or risk detail from the private knowledge map only; do not treat knowledge as audience-facing evidence for the project.
- When the script teaches a money-making project but lacks real order evidence, calculate only transparent scenarios from a verified listing price, such as one order or several hypothetical orders. Label the result as service revenue/流水 and keep wants or views separate from orders.

## 6. Make It Sound Like 17

Revise for:

- More spoken transitions: `接下来`, `这里有个重点`, `千万记住`, `说白了`.
- More concrete actions: search terms, click paths, table columns, posting rhythm, reply script.
- Remove rhetorical `不是...而是...` by default. Keep only short literal boundaries when accuracy requires them, such as “想要不等于订单”.
- In a long project breakdown, package the opening and roughly three to five major sections with different target-supported result scenes. Show what changes in daily life, ability, same-day action, time, repeated work, delivery, or payoff, then enter the next action. Never announce a retention plan with `后面再讲`, `具体怎么计算`, or `等会告诉你`.
- Less abstract analysis.
- Delete process narration that does not help the viewer: `我拆了一遍`, `我先发现`, `我继续往下看`.

## 7. Build the Word Deliverable

- Treat the working Markdown and its visual markers as internal assembly material.
- Use the `$documents` workflow to create or update the canonical `.docx` rather than pasting the full draft into chat.
- Resolve each visual marker to one verified local image. Insert the image inline immediately after the paragraph whose claim it supports and add meaningful invisible alt text. Remove the marker from the final Word; do not add visible figure numbers or evidence captions.
- Keep the original screenshot unchanged as private evidence. For the Word display, crop a deterministic derivative or use Word-native cropping to show only the relevant product cards, price, wants, views, or service text. Remove browser chrome, sidebars, navigation, and empty margins. Never use generative editing on evidence screenshots.
- Never fabricate, substitute, or duplicate an image merely to fill a visual slot. If the evidence image is essential and missing, stop and request it. If it is optional, omit the slot and record the omission privately.
- Reuse the canonical Word path for revisions; do not create version-suffixed duplicates unless variants were requested.
- Render the `.docx` to page PNGs, inspect every page, and run the packaged image and accessibility audits. Fix high-severity findings and render again.

## 8. Final Output Checklist

Before output:

- A nonempty knowledge result passed the gate; 2–4 relevant items are privately mapped to major sections, and at least one was used.
- Knowledge sources and retrieval metadata remain private, and any project-specific claim from knowledge was independently verified and promoted to the fact contract or omitted.
- Hook has a reason to keep watching.
- Viewer can picture what they will be able to do, save, improve, or experience after each major section.
- Body has numbered steps.
- The CTA matches the user's actual offer.
- Every verified visual is embedded at the correct evidence paragraph; no unresolved visual marker remains in the final Word.
- Risky claims are softened or flagged.
- The simple framework-only version is not worse than the version with extra persona/cognitive/packaging controls.
- The script does not fall back to syllabus headings after the opening, and does not rely on `不是...而是...` or other corrective shells for momentum.
- The canonical Word passed page-by-page render review, image audit, and accessibility audit.
- The Word contains no visible `风格`、`配图证据版`、`项目拆解口播稿`、`图1/图2`、validation label, running header, footer, or page number unless the user explicitly asked for one.
- The chat response links to the Word file and reports validation concisely instead of repeating the full script.
