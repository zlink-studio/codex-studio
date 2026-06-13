# ZLink AI 数字员工工作台真实落地清单

当前项目默认进入真实模式。只有显式设置 `NEXT_PUBLIC_ALLOW_DEMO_DATA=true` 时，才会使用本地演示数据。

## 1. 必填环境变量

在 `.env.local`、Codespaces secrets 或部署平台环境变量中配置：

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DEMO_OWNER_ID=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
NEXT_PUBLIC_ALLOW_DEMO_DATA=false
```

说明：

- `SUPABASE_SERVICE_ROLE_KEY` 只能服务端使用，不能暴露到前端。
- `DEMO_OWNER_ID` 必须是 `public.users.id` 中真实存在的 owner 用户 id。
- 没配 Supabase 时，核心 API 会返回空数据或 `setup_required`，不会伪装保存成功。

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

## 5. 初始化默认数据

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

## 6. 第一个真实闭环

建议按这个顺序录入真实数据：

1. Agents：创建执行经理 Agent、内容 Agent、运营 Agent、审核 Agent。
2. Projects：创建一个真实客户项目。
3. Memory：录入公司原则、客户资料、SOP，并审核为 `approved`。
4. Command Center：输入老板目标，让执行经理拆任务。
5. Tasks：执行 Agent，检查输出、模型成本、日志和 Review Gate。
6. Dashboard：生成今日日报。

## 7. Demo 数据开关

如果需要临时展示样例：

```bash
NEXT_PUBLIC_ALLOW_DEMO_DATA=true
ALLOW_DEMO_DATA=true
```

真实使用时必须保持：

```bash
NEXT_PUBLIC_ALLOW_DEMO_DATA=false
```
