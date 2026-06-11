# GitHub 工作流

这个项目建议用 GitHub 管代码、PR、issues、CI 和后续部署协作。

## 1. 推荐仓库设置

- 默认分支：`main`
- 分支命名：`codex/<short-task-name>`
- PR 合并前检查：
  - `npm run typecheck`
  - `npm run build`
- 不提交密钥文件：
  - `.env`
  - `.env.local`
  - `.env.*.local`

## 2. 本地推送方式

当前电脑没有可用的 `git` 命令。你可以二选一：

### 方式 A：安装 Git

安装 Git for Windows 后，在项目目录运行：

```bash
git init
git branch -M main
git add .
git commit -m "Initial ZLink AI workbench MVP"
git remote add origin https://github.com/<owner>/<repo>.git
git push -u origin main
```

项目当前目录：

```text
D:\Codex\2026-06-09\ai-next-js-typescript-tailwind-css
```

### 方式 B：GitHub Desktop

1. 打开 GitHub Desktop。
2. 选择 `File` -> `Add local repository`。
3. 选择项目目录。
4. 如果提示不是 Git 仓库，点击创建仓库。
5. Publish repository 到 GitHub。

## 3. CI

`.github/workflows/next-ci.yml` 会在 push / PR 时执行：

- `npm install`
- `npm run typecheck`
- `npm run build`

## 4. GitHub Pages 静态 MVP

`.github/workflows/pages-static.yml` 可以发布 `outputs/oneco-ai-workbench.html`。

注意：这是静态演示版，只适合展示产品形态，不支持 Next.js API Routes、Supabase 服务端调用、OpenAI API 或 n8n Webhook。

完整生产部署建议走 Cloudflare Workers / Vercel / Node server。

## 5. Issues 规划

建议用 labels：

- `area:memory`
- `area:agents`
- `area:tasks`
- `area:dashboard`
- `area:integrations`
- `type:bug`
- `type:feature`
- `type:ops`
- `priority:p0`
- `priority:p1`
- `priority:p2`
