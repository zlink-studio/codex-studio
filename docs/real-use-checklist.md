# ZLink AI 数字员工工作台真实落地清单

当前项目默认进入真实模式并只读写 Supabase。只有显式设置 `USE_LOCAL_STORE=true` 时，才会使用本地演示数据；两种存储不会双写或自动合并。

## 1. 必填环境变量

在 `.env.local`、Codespaces secrets 或部署平台环境变量中配置：

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DEMO_OWNER_ID=
CREDENTIAL_ENCRYPTION_KEY=
CREDENTIAL_ENCRYPTION_KEY_VERSION=v1
CREDENTIAL_ADMIN_TOKEN=
OBSIDIAN_VAULT_DIR=/你的绝对路径/ObsidianVault
N8N_TOOL_CONNECTION_ID=
N8N_CALLBACK_SECRET=
CONTENT_SCHEDULER_TOKEN=
CONTENT_ADMIN_TOKEN=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
USE_LOCAL_STORE=false
```

说明：

- `SUPABASE_SERVICE_ROLE_KEY` 只能服务端使用，不能暴露到前端。
- `DEMO_OWNER_ID` 必须是 `public.users.id` 中真实存在的 owner 用户 id。
- `CREDENTIAL_ENCRYPTION_KEY` 必须是 32 字节随机值的 Base64 或 64 位十六进制编码；不要与数据库放在同一处。
- `CREDENTIAL_ADMIN_TOKEN` 保护凭据管理 API，只通过服务端 Secret 注入。
- `OBSIDIAN_VAULT_DIR` 必须是实际 Obsidian Vault 的绝对路径，不能配置为磁盘根目录或用户主目录。
- `N8N_TOOL_CONNECTION_ID` 指向凭据保险箱中的 n8n 连接；`N8N_CALLBACK_SECRET`、`CONTENT_SCHEDULER_TOKEN` 和 `CONTENT_ADMIN_TOKEN` 使用三个独立随机值。
- 没配 Supabase 时，核心 API 会返回配置错误或 `setup_required`，不会伪装保存成功。

## 2. Supabase 初始化

在 Supabase SQL Editor 中按顺序执行：

1. `supabase/schema.sql`
2. `supabase/migrations/001_agent_board_upgrade.sql`
3. `supabase/migrations/002_memory_model_router.sql`
4. `supabase/migrations/003_memory_library_upgrade.sql`
5. `supabase/migrations/004_models_center_upgrade.sql`
6. `supabase/migrations/005_api_role_grants.sql`
7. `supabase/migrations/006_codex_local_manual_bridge.sql`
8. `supabase/migrations/007_gemini_provider.sql`
9. `supabase/migrations/008_company_os_workflow_tables.sql`
10. `supabase/migrations/009_approval_levels.sql`
11. `supabase/migrations/010_credentials_vault.sql`
12. `supabase/migrations/011_obsidian_review_sync.sql`
13. `supabase/migrations/012_social_content_pipeline.sql`

如果之前已经执行过旧版 schema，可以只补执行还没有执行过的 migration。

## 3. 创建 Owner 用户

先在 Supabase Auth 中创建你的账号，然后在 SQL Editor 中确认或补充：

```sql
insert into public.users (id, email, display_name, role)
values ('你的 auth.users.id', '你的邮箱', 'Owner', 'owner')
on conflict (id) do update
set email = excluded.email,
    display_name = excluded.display_name,
    role = 'owner';
```

把这个 id 写入：

```bash
DEMO_OWNER_ID=你的 auth.users.id
```

## 4. 验证真实环境

启动项目后打开：

- `http://localhost:3000/api/system/health`
- `http://localhost:3000/setup`
- `http://localhost:3000`
- `http://localhost:3000/models`
- `http://localhost:3000/tasks`

`/api/system/health` 中应满足：

- `mode` 为 `database`
- `readyForRealUse` 为 `true`
- `missing` 为空数组

## 5. 凭据保险箱

生成两个独立随机值：

```bash
openssl rand -base64 32  # CREDENTIAL_ENCRYPTION_KEY
openssl rand -hex 32     # CREDENTIAL_ADMIN_TOKEN
```

连接的公开参数写入 `config`，API Key、Token、密码等只写入 `credentials`。管理 API 必须携带 `Authorization: Bearer $CREDENTIAL_ADMIN_TOKEN`，响应只返回连接元数据，永远不返回密文或明文凭据。

```bash
curl -X POST http://localhost:3000/api/tool-connections \
  -H "Authorization: Bearer $CREDENTIAL_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"n8n","name":"Main n8n","config":{"baseUrl":"https://example.invalid"},"credentials":{"apiKey":"replace-me"}}'
```

每次服务端取用凭据必须调用 `accessToolCredentials`，成功日志落入 `credential_access_logs` 后才会返回内存中的明文。可通过 `/api/credential-access-logs` 查看审计记录。

旧 `tool_connections.config` 如果曾保存常见敏感字段，迁移会标记为 `needs_rotation`。请通过 `PATCH /api/tool-connections` 提交新的 `credentials` 和清理后的公开 `config`；不要直接复制旧明文。

## 6. Obsidian 复盘回流

在 `.env.local` 配置真实 Vault：

```bash
OBSIDIAN_VAULT_DIR=/绝对路径/你的Vault
```

系统通过下面的 API 创建复盘草稿，文件会出现在 Vault 的 `复盘/` 目录：

```bash
curl -X POST http://localhost:3000/api/obsidian-vault/retrospectives \
  -H "Content-Type: application/json" \
  -d '{"title":"本周运营复盘","content":"系统生成的初始复盘内容"}'
```

在 Obsidian 中人工修改正文并保存，再点击 Memory 页的“同步人工复盘”，或调用：

```bash
curl -X POST http://localhost:3000/api/obsidian-vault/sync \
  -H "Content-Type: application/json" \
  -d '{}'
```

只有标题、标签或正文相对系统基线发生变化的草稿才会回流。回流内容以 `pending_review` 写入 `memories`，同时进入 `memory_review_queue`，批准前不会注入 Agent prompt；重复同步不会重复创建 Memory。

## 7. 社媒内容生产闭环

Migration 012 会创建 `content_items`、`content_item_events`、`social-assets` Storage bucket、每小时排期扫描函数和 pg_cron 任务。

完整状态机、n8n 入参、签名回调和发布验收见：

```text
docs/social-content-pipeline.md
```

工程验收可以立即完成；“连续四周日更、日人工介入少于 30 分钟”必须通过 `/api/content-items/metrics?days=28` 使用真实发布数据观察，不能用测试数据替代生产验收。

## 8. 初始化默认数据

环境就绪后打开：

```bash
http://localhost:3000/setup
```

点击初始化默认数据。系统会创建：

- 执行经理 Agent
- 内容 Agent
- 运营交付 Agent
- 财务风控 Agent
- Memory 根分类
- 手动录入 / 上传文件知识源
- 模型 Provider / Catalog / Policy 默认配置

对应 API：

```bash
POST /api/system/bootstrap
```

## 9. 第一个真实闭环

建议按这个顺序录入真实数据：

1. Agents：创建执行经理 Agent、内容 Agent、运营 Agent、审核 Agent。
2. Projects：创建一个真实客户项目。
3. Memory：录入公司原则、客户资料、SOP，并审核为 `approved`。
4. Command Center：输入老板目标，让执行经理拆任务。
5. Tasks：执行 Agent，检查输出、模型成本、日志和 Review Gate。
6. Dashboard：生成今日日报。

## 10. 离线本地存储开关

如果需要离线开发或临时展示样例：

```bash
USE_LOCAL_STORE=true
```

真实使用时必须保持：

```bash
USE_LOCAL_STORE=false
```
