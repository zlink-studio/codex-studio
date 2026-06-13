# GitHub Codespaces

Use Codespaces when you want the project to run in GitHub's cloud and connect from any device.

## Start

1. Open `https://github.com/zlink-studio/codex-studio`.
2. Click `Code`.
3. Open the `Codespaces` tab.
4. Click `Create codespace on main`.
5. In the terminal, run:

```bash
npm run dev:codespaces
```

Open the forwarded `Next.js` port when GitHub prompts you.

## Environment

The dev container creates `.env.local` from `.env.example`. Values are filled from Codespaces secrets when they exist.

Add secrets in GitHub:

```txt
Repository Settings -> Secrets and variables -> Codespaces
```

Useful secret names match `.env.example`, for example:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
GEMINI_API_KEY
N8N_WEBHOOK_URL
DEMO_OWNER_ID
```

If you prefer the encrypted bundle, run:

```bash
npm run env:import -- .env.local.enc .env.local --force
```

Enter the encryption password you created on the first machine.

## Cost control

Use the 2-core machine for normal development. Stop the codespace when you finish, and keep only one active codespace unless you really need more.
