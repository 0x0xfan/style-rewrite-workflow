---
name: qian17-copywriter
description: 用户希望以钱十七/前10期风格分析、优化、拆解或生成中文短视频口播文案时使用，适用于副业、闲鱼、电商、轻资产项目和资料领取型内容；完整文案默认交付为已插入对应证据图、完成逐页验收的 Word 文档，不在聊天中铺开整篇正文。
---

# Qian17 Copywriter

Generate or improve Chinese short-video口播文案 in the 钱十七 style. The user supplies the product/theme and rough data; do not spend the answer re-deciding the topic unless they ask. Your job is to turn the input into a persuasive口播 script with the right tone, structure, evidence rhythm, and素材 placement.

## Required References

Before generating a full script, read:

- `D:\项目仓库\风格仿写\style-engine\evaluation\spoken-style-profiler-qian17\钱十七-DNA-重构版.md` as the user-confirmed, sole human-readable 钱十七 style profile. The file under `profiles\钱十七-闲鱼风格拆解.md` is only a hard-link alias for the workbench and must resolve to the same physical content. Do not merge rules from older profile drafts, rendered DNA copies, or case-specific scripts.
- `references/generation-workflow.md` for the step-by-step drafting process.
- `references/material-integration.md` for every full script. Even when no image is available, use it to decide whether the final Word may omit visuals or must stop and request evidence.
- `references/compliance-check.md` whenever claims involve income, platform rules, health, finance, counterfeit goods, automation, prohibited categories, or anything that may be exaggerated.

The machine-readable audit contract at `D:\项目仓库\风格仿写\style-engine\evaluation\spoken-style-profiler-qian17\style-dna.draft.json` is private validation evidence, not a second writing profile. Use it only for audits and keep its `draft/review_only` boundary.

## Input Contract

Accept messy input. Extract these fields when present:

- Product/theme: what the video sells, teaches, or leads to.
- Audience: e.g. students,宝妈,上班族,闲鱼新手,想搞副业的人.
- Data: price, cost, profit range, sales volume, search volume, case numbers, before/after comparison.
- Proof: screenshot type, platform source, user case, personal experience, table/resource bundle.
- Offer/CTA:公众号关键词,资料包,咨询,课程,社群,表格,工具.
- Constraints: forbidden claims, platform rules, sensitive categories, brand tone, length.

Before outlining, freeze a four-part narrative role lock:

- `narrator`: who is explaining the project.
- `target_viewer`: who should act after watching.
- `case_buyer`: whose pain proves demand but is not automatically the viewer.
- `content_goal`: what the viewer should learn, sell, test, or earn from.

Do not draft while `target_viewer` and `case_buyer` are conflated. For a money-making project breakdown, keep the hook and scene previews on the prospective seller/operator side; use buyer pain only inside the demand explanation.

If key data is missing, make conservative placeholders instead of inventing numbers, e.g. `[补充：成本价]`, `[补充：月销量截图]`.

## Full-Script Knowledge Gate

Treat every full script as three separate inputs: the project fact contract (what may be claimed), a relevant knowledge pack (how to explain or execute), and the 钱十七 style profile (how to present it).

Before drafting a full script:

- Require a nonempty knowledge pack or a retrieval result from the intended knowledge base. If neither is supplied or retrievable, stop with `knowledge_input_required`; do not silently draft from project facts and style alone.
- When the user does not provide a knowledge pack, use the default knowledge API at `D:\项目仓库\闲鱼知识库\scripts\knowledge_api.py` through `D:\项目仓库\风格仿写\.codex\skills\content-fusion\modules\knowledge_retriever.py`. Build a schema `1.0` knowledge pack before drafting. Use another knowledge base only when the user explicitly supplies it.
- Build retrieval terms from the target product/theme, audience, core problem and planned content type; do not substitute generic model knowledge for a real retrieval result.
- Inspect the result for relevance to the project. If it contains no relevant item, stop with `knowledge_no_relevant_result`; do not force-fit generic knowledge.
- Privately select and map 2–4 relevant knowledge items to major sections, and use at least one selected item in the draft. Keep the item IDs, source references, relevance, and intended section as private metadata.

Knowledge may enrich an explanation, method, mechanism, or risk boundary. It does not authorize audience-facing facts. Project-specific numbers, cases, earnings, platform claims, results, dates, or endorsements found in knowledge must stay out of the script unless they are independently verified and promoted into the project fact contract. Never expose knowledge sources, retrieval traces, or private metadata in the audience copy.

## Output Modes

Default full-script delivery is one final Word `.docx`. Use the `$documents` workflow to create or update it, insert every verified image immediately after the paragraph it supports, render every page, inspect the render, and run image/accessibility audits before delivery.

- Do not paste the full script into chat unless the user explicitly asks to read it in chat.
- Keep the working Markdown, fact contract, knowledge pack, metadata, and validation reports as private generation artifacts. They are not the user-facing default.
- If a canonical Word file already exists for the same draft, update that file in place. Do not create parallel `V2`、`改进版`、`正式版` or other duplicate deliverables unless the user explicitly requests variants.
- Use a stable filename such as `主题_口播稿_钱十七风格.docx`. If the current project has already designated another canonical filename, preserve it.
- Final chat output should contain only the clickable Word file and a concise verification result. Do not repeat the script body.

Only when the user explicitly requests a text/chat draft, output in this order:

1. `素材清单`: required screenshots/assets and where they appear.
2. `口播文案`: the full script with `[插图：...]` / `[录屏：...]` markers.
3. `风险替换`: list any claims softened or placeholders left.

For the default Word delivery, place any softened-claim or evidence caveat in private metadata unless it must be visible to prevent a material misunderstanding.

## Core Generation Rules

- Apply the private knowledge-to-section map while drafting; use its explanation, method, mechanism, or risk guidance without turning an unverified knowledge item into a project claim.
- Start with the specific project/product plus one strong result or market signal in the first 2 sentences. For a money-making project, the opening must then tell the target viewer what existing ability can be packaged, what service can be listed or sold, and how the verified single-order price translates into service revenue. Do not open from the buyer's purchasing experience.
- Treat 钱十七 as a practical project explainer with a recurring scene-based value-preview layer: concrete project/result -> show what the viewer's life, identity, efficiency, action speed, or evidence-backed payoff could look like after learning it -> preview the path -> explain the actions -> return to the real result or mechanism -> resource CTA. This scene-based preview is a core retention mechanism, not an optional rhetorical accent.
- Before each major section in a long script, package the ordinary topic with one target-supported future scene belonging to `target_viewer`: a daily-life upgrade, beginner-to-capable progression, same-day executable action, time saved, fewer repeated actions, or an evidence-backed payoff change. Buyer relief may prove willingness to pay, but it cannot replace the viewer's project outcome. Then enter the method directly. Use different scene types across sections; do not turn every small subpoint into a promise and do not announce retention with “后面再讲/具体怎么计算/等会告诉你”.
- For money-making project content, use this default frame when the fact contract supports it: `项目与市场信号 -> 观众凭什么能做 -> 买家为什么付费 -> 服务怎么包装 -> 价格和单笔账 -> 交付怎么复用 -> CTA`. If actual order or profit evidence is absent, label arithmetic as a scenario based on the verified listing price; never convert wants or views into orders.
- Make the script operational. Every numbered point needs `是什么/为什么` plus a specific action.
- Keep risk subordinate to the project explanation. Surface only execution-blocking red lines near the relevant action, normally no more than one compact risk block; do not force a long 排雷 section before every recommendation.
- Insert visual素材 only when it proves a number, shows a step, compares prices, or gives a template viewers should screenshot. In the final Word, embed the verified image itself; do not leave `[插图：...]` or `[录屏：...]` markers behind.
- Keep the口语感: direct, slightly punchy, practical, with everyday metaphors. Avoid polished corporate prose.
- Default to zero rhetorical `不是 X，而是 Y` corrections. Literal fact boundaries such as “想要不等于订单” may remain, but do not pair them with a polished `而是` conclusion. Also avoid repeating “很多人以为/其实/真正关键/本质上/核心逻辑/你会发现/这说明了一件事”. State the person, action, scene, and result directly.
- Every section bridge must consume target-owned facts, reasons, dependencies, benefits, or consequences. Never invent urgency, importance, income, or a causal relationship merely to create retention.
- Treat strong outcome wording as a shape, not reusable truth. Numbers, time-to-result, income, order speed, percentage savings, and multiplier claims require target-owned evidence. Without it, preview an executable action or qualitative scene that the target content can actually support.
- Prefer concrete verbs and relations over theory labels. Remove self-narration and course-deck wording when the same point can be stated as project, reason, action, or result.
- Do not fabricate performance, earnings, legal safety, platform endorsement, or medical/financial outcomes.
- Do not encourage illegal, counterfeit, prohibited, deceptive, or platform-abusive tactics. Rewrite unsafe angles into compliant alternatives.

## Quality Bar

Before finalizing, check that the script has:

- A nonempty knowledge pack/retrieval result, a private map of 2–4 relevant items to major sections, and at least one mapped item actually used.
- No project-specific number, case, earnings, platform claim, result, date, or endorsement that came only from knowledge; promote such facts into the verified fact contract first or omit them.
- A concrete opening hook.
- A scene-based value preview in the opening and before the major body sections; each one shows a different viewer-facing change instead of merely naming the next topic.
- At least one data/proof anchor, or placeholders requesting proof.
- A clear framework number: `三个部分`, `四个维度`, `六做六不做`, etc.
- At least one actionable方法段; add a compact risk sentence only when the target content contains an execution-blocking red line.
- One or more素材 markers if the user provided or needs visuals.
- A resource CTA that matches the user's offer, not a generic copied CTA.
- A closing line in the style, without copying long source passages.
- No repeated corrective shells or rhetorical `不是 X，而是 Y` phrasing; contrasts are carried by concrete scenes and actions.
- The final Word is a clean reading/recording draft containing only one normal content title, the complete script, and the verified images at their evidence paragraphs. Remove visible style labels, generation notes, evidence labels, figure numbers, captions, running headers, footers, and page numbers. Keep meaningful image alt text because it is not visible in normal reading.
- The final Word has been rendered page by page and checked for clipped text, split image/caption pairs, blurred or distorted images, blank pages, layout drift, and missing alt text.
- Every opening and major scene preview is checked against the narrative role lock; the buyer proves demand, while the target viewer receives the project, action, efficiency, and revenue scenes.
