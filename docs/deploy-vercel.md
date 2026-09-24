# 部署到 Vercel（开发阶段）

## 1. Supabase

在 Supabase SQL Editor 依次执行 `supabase/schema.sql` 和 `supabase/migrations/001` … `012`（已执行过的跳过）。
在 Auth 创建你的账号，把它的 id 写进 `public.users`（见 `docs/real-use-checklist.md` 第 3 节），这个 id 就是 `DEMO_OWNER_ID`。

## 2. Vercel 项目

1. vercel.com 用 GitHub 登录 → Add New → Project → 导入 `zlink-studio/codex-studio`。
2. Framework 自动识别为 Next.js，其余保持默认。
3. Settings → Git → Production Branch 设为当前开发分支（例如 `codex/phase-a-foundation`）。
4. Environment Variables 至少填：

| 变量 | 说明 |
|---|---|
| `WORKBENCH_PASSWORD` | 工作台登录密码。**不填则线上直接返回 503，不会裸奔** |
| `WORKBENCH_SESSION_SECRET` | ≥32 位随机串，`openssl rand -hex 32` |
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase 项目设置 → API |
| `DEMO_OWNER_ID` | 第 1 步的 owner id |
| 模型 Key | 用哪家填哪家，如 `QWEN_API_KEY`、`DEEPSEEK_API_KEY` |

不要设置 `USE_LOCAL_STORE`。

## 3. 在 Vercel 上受限的功能

- 本地文件（生成的网站草稿、交付物文件）写在 `/tmp`，函数实例回收后就没了；交付物正文同时存在数据库，查看不受影响。
- `OBSIDIAN_VAULT_DIR`、`codex-local`/OpenClaw CLI 需要本机目录或命令，在 Vercel 上不可用，留空即可。
- 大模型相关接口单次最长 60 秒；「整轮执行」容易超时，优先用「执行下一步」。
- 免费版 Hobby 仅限个人非商业用途，正式投入日常经营后迁到付费方案或 VPS。

## 4. 机器回调

以下接口不走登录，而是自带签名/令牌校验，n8n 等外部服务可直接调用：
`/api/n8n/callback`、`/api/content-items/callback`（`x-zlink-signature`，`N8N_CALLBACK_SECRET`），
`/api/content-items/dispatch-due`（`Bearer CONTENT_SCHEDULER_TOKEN`）。
