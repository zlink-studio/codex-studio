# ZLink AI 数字员工工作台

面向一人公司的 AI Agent 经营工作台。老板输入目标后，执行经理 Agent 负责拆解任务、分配岗位、识别风险；高风险任务进入老板审批；任务输出、会议发言、日报和公司记忆统一沉淀到 Supabase。

## 技术栈

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase
- OpenAI API / Gemini / OpenRouter 等模型 Provider
- n8n Webhook

## 核心页面

- Dashboard：首页经营驾驶舱
- Agents：数字员工中心
- Projects：客户项目中心
- Tasks：任务中心和 Kanban
- Command Center：老板指挥台
- Meeting Room：Agent 会议室
- Memory：统一知识库
- Models：模型中心
- Setup：初始化和系统检查

## Memory 架构

Supabase 是主记忆库。Google Drive、Docs、Sheets 等只作为外部资料来源，资料需要进入 `draft` 或 `pending_review`，经老板审核为 `approved` 后，才会被 Agent 自动检索并注入 prompt。

核心表：

- `memory_categories`
- `memories`
- `memory_embeddings`
- `memory_relations`
- `memory_review_queue`
- `memory_access_logs`
- `knowledge_sources`

## Model Router

项目已经加入 LLM Provider / Model Router 抽象层。当前支持或预留：

- OpenAI
- Gemini
- OpenRouter
- LiteLLM
- Anthropic
- DeepSeek
- Qwen
- Kimi
- Manual Bridge
- Codex Local

核心目录：

```text
lib/llm
lib/memory
```

## 环境变量

本地开发复制 `.env.example` 为 `.env.local`，或使用加密环境包：

```bash
npm run env:import -- .env.local.enc .env.local --force
```

常用变量：

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.1-flash-lite
N8N_WEBHOOK_URL=
DEMO_OWNER_ID=
NEXT_PUBLIC_ALLOW_DEMO_DATA=false
```

不要提交明文 `.env.local`。仓库只允许提交加密后的 `.env.local.enc`。

## 本地运行

```bash
npm install
npm run dev
```

## Codespaces 运行

打开仓库后选择 `Code -> Codespaces -> Create codespace on main`。

进入终端后运行：

```bash
npm run env:import -- .env.local.enc .env.local --force
npm run dev:codespaces
```

然后打开 GitHub 提示的 forwarded port。更多说明见 [docs/codespaces.md](docs/codespaces.md)。

## 验证

```bash
npm run typecheck
npm run lint
npm run build
```

## GitHub 工作流

详见 [GITHUB.md](GITHUB.md)。
