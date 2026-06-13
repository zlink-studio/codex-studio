# Multi-device development

This project uses GitHub for source code, Supabase for shared data, and an encrypted env bundle for local secrets.

## Current machine

Create an encrypted copy of `.env.local`:

```powershell
.\tools\export-env.ps1
```

Commit these files:

```powershell
git add .env.local.enc tools/export-env.ps1 tools/import-env.ps1 docs/multi-device-development.md
git commit -m "Add encrypted env sync for multi-device development"
git push
```

Do not commit `.env.local`.

## New machine

Clone the repo and restore the env file:

```powershell
git clone https://github.com/zlink-studio/codex-studio.git
cd codex-studio
.\tools\import-env.ps1
npm install
npm run dev
```

If `.env.local` already exists:

```powershell
.\tools\import-env.ps1 -Force
```

## Daily workflow

Before coding:

```powershell
git pull
```

After coding:

```powershell
git status
git add .
git commit -m "Describe the change"
git push
```

On the other machine:

```powershell
git pull
```

## Rules

- Keep `.env.local` out of Git.
- Commit `.env.local.enc` only after encrypting it with a strong password.
- Keep the encryption password outside GitHub.
- Do not sync `node_modules`, `.next`, `tools/node`, or `tools/openclaw-prefix`.
- OpenClaw OAuth login is per machine. Run the OpenClaw login again on the new machine if you want Codex OAuth there.
