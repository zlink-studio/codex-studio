# Claude bridge（用 VPS 上的 Claude Code 代替 API Key）

工作台的 Claude 能力（目标拆解、质量复核、`/console` 控制台）可以不用 Anthropic API Key，
而是调用主理人 VPS 上已登录的 Claude Code（claude.ai 会员）。仅限个人使用。

```
浏览器 → Vercel 工作台 ──HTTPS(自签名证书, 固定信任)+令牌──► VPS bridge(:18443) → claude -p
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
(crontab -l; echo "@reboot $HOME/claude-bridge/start.sh"; echo "* * * * * $HOME/claude-bridge/start.sh") | crontab -
./start.sh
```

## Vercel 环境变量

| 变量 | 值 |
|---|---|
| `CLAUDE_BRIDGE_URL` | `https://<VPS 公网 IP>:18443` |
| `CLAUDE_BRIDGE_TOKEN` | `bridge.env` 里的 `BRIDGE_TOKEN` |
| `CLAUDE_BRIDGE_CA` | `base64 -w0 tls/cert.pem` 的输出 |
| `ZLINK_MCP_TOKEN` | `bridge.env` 里的 `ZLINK_MCP_TOKEN` |

VPS 防火墙需放行 TCP 18443。
