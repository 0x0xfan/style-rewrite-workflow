# Clean State Checklist

结束一次工作前检查：

- [ ] `CURRENT.md` 写明当前阶段、WIP、阻塞、证据和下一步最小动作。
- [ ] `HANDOFF.md` 写明恢复时先读什么、接下来做什么、不要做什么。
- [ ] `feature_list.json` 的状态与证据一致，WIP 不超过 1。
- [ ] 运行相关的 `node --check` 或接口/浏览器验证已记录到 `docs/verification.md`。
- [ ] 生成目录和 `.env.local` 没有被提交或复制进公开产物。
- [ ] 未把未验证的模型、TTS、飞书或浏览器行为写成已完成。
- [ ] 若出现同一阻塞第二次失败，停止硬试并更新 `HANDOFF.md`。
