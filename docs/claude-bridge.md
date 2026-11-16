# Claude bridge（用 VPS 上的 Claude Code 代替 API Key）

工作台的 Claude 能力（目标拆解、质量复核、`/console` 控制台）可以不用 Anthropic API Key，
而是调用主理人 VPS 上已登录的 Claude Code（claude.ai 会员）。仅限个人使用。

```
浏览器 → Vercel 工作台 ──HTTPS+令牌──► Cloudflare 隧道 ──► VPS bridge(127.0.0.1:18443) → claude -p
                ▲                                                         │
                └──────────── /api/mcp (令牌) ◄── 控制台调用平台工具 ──────┘
```

- `claude` 以 `--tools ""` 运行：没有命令行、文件、网络工具，只能用 `/api/mcp` 暴露的平台工具。
- 控制台对话保存为 VPS 上的 Claude Code 会话，网页只保存会话 id。
- 用量计入主理人的 Claude 会员额度。

## VPS 部署

```bash
mkdir -p ~/claude-bridge/work ~/claude-bridge/tls && cp tools/claude-bridge/* ~/claude-bridge/
cd ~/claude-bridge
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -days 3650 -nodes \
  -subj "/CN=claude-bridge" -addext "subjectAltName=IP:<VPS 公网 IP>" -keyout tls/key.pem -out tls/cert.pem
cat > bridge.env <<ENV
BRIDGE_PORT=18443
BRIDGE_TOKEN=$(openssl rand -hex 32)
CLAUDE_BIN=$HOME/.local/bin/claude
ZLINK_MCP_URL=https://<工作台域名>/api/mcp
ZLINK_MCP_TOKEN=$(openssl rand -hex 32)
MAX_CONCURRENT=2
ENV
chmod 600 bridge.env tls/*.pem
# cloudflared 放在 ~/.local/bin；VPS 不需要开放任何入站端口
(crontab -l; echo "@reboot $HOME/claude-bridge/tunnel.sh"; echo "* * * * * $HOME/claude-bridge/tunnel.sh") | crontab -
./tunnel.sh
```

## Vercel 环境变量

| 变量 | 值 |
|---|---|
| `CLAUDE_BRIDGE_URL` | 隧道地址（`tunnel.sh` 自动写入并重新部署） |
| `CLAUDE_BRIDGE_TOKEN` | `bridge.env` 里的 `BRIDGE_TOKEN` |
| `CLAUDE_BRIDGE_CA` | 仅在不经隧道、直连 VPS 时设置：`base64 -w0 tls/cert.pem` |
| `ZLINK_MCP_TOKEN` | `bridge.env` 里的 `ZLINK_MCP_TOKEN` |

免费的 Cloudflare 快速隧道每次重启地址都会变；`tunnel.sh` 每分钟检查一次，地址变了就更新 Vercel 并重新部署（约 2 分钟）。
想要固定地址，可以把自己的域名接入 Cloudflare，改用命名隧道（named tunnel）。
