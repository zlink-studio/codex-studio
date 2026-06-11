# 插件与连接器配置规划

## 总体原则

- Supabase 是主记忆库，Google Drive 只是外部资料入口。
- 不在代码里写死任何 API Key。
- OpenAI、Supabase service role、GitHub token、Slack token 都必须使用平台 Secret 或环境变量。
- 第一阶段优先保障 GitHub、Google Drive、Supabase Memory 三条链路清晰。

## 第一优先级

### GitHub

用途：

- 管理当前项目仓库。
- 提交 PR。
- 做代码审查。
- 管理 issues。
- 后续配合 Codespaces、Cloudflare 或 Vercel 部署。

推荐工作流：

1. 所有需求先建 issue。
2. Codex 按 issue 创建分支。
3. PR 必须通过 `typecheck` 和 `build`。
4. 合并到 `main` 后触发部署。

### Google Drive / Docs / Sheets

用途：

- 存放客户资料、SOP、社媒排期表、会议资料。
- 作为 `knowledge_sources` 的外部来源。
- 资料整理后导入 Supabase `memories`。

不做：

- 不把 Google Drive 当主记忆库。
- 不让 Agent 直接无审核地把 Drive 内容塞进 prompt。

导入流程：

1. Drive 文件登记到 `knowledge_sources`。
2. 人工或 Agent 提取摘要。
3. 写入 `memories`，状态为 `draft` 或 `pending_review`。
4. 老板审核后变为 `approved`。
5. 只有 approved 记忆进入 Agent prompt。

### Data Analytics

当前没有精确同名插件。第一阶段用以下方式替代：

- Supabase SQL views。
- Google Sheets 汇总。
- 本地脚本分析。

核心指标：

- Agent workload。
- 任务状态分布。
- 审批积压。
- Memory 使用次数。
- Model token 和成本。
- 每日任务完成率。

## 第二优先级

### Slack

用途：

- 任务提醒。
- 审批提醒。
- 日报推送。
- 数字员工工作群。

第一阶段只预留，不深度接入。

### Product Design

当前没有精确同名插件。可用 Figma / Canva 作为后续替代：

- Dashboard 信息架构优化。
- Memory 三栏布局优化。
- Kanban 卡片状态优化。
- Agent 卡片和任务详情 UI 优化。

## 建议数据流

```text
GitHub -> 代码、PR、issues、CI
Google Drive -> 客户资料、SOP、表格、文件
Supabase -> Memory 主库、任务、Agent、审批、日志
Data Analytics -> 指标、报表、成本分析
Slack -> 通知、日报、审批提醒
```
