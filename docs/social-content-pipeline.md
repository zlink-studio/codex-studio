# 自有社媒内容生产与发布闭环

Phase B 的第一条生产链路以小红书为平台适配器。Codex Studio 只负责内容状态、审批、审计和派发；素材生成与实际平台发布由 n8n 执行。

## 状态流转

```text
draft
  → asset_generating → review
  → 质检通过
      ├─ owned 账号：L1 自动进入 approved/scheduled
      └─ client 账号：L2 pending_approval → 主理人批准
  → pg_cron 每小时标记 publish_queued
  → n8n 调用 dispatch-due
  → publishing
  → published / publish_failed
```

发布硬条件：`quality_status=approved`、`approval_status=approved`、素材 URL 非空、重试次数少于 5。任一条件不满足都会在服务端拒绝发布。

## 环境变量

推荐把 n8n webhook 与签名密钥存入 `tool_connections`，并配置：

```bash
N8N_TOOL_CONNECTION_ID=对应连接UUID
N8N_CALLBACK_SECRET=独立随机密钥
CONTENT_SCHEDULER_TOKEN=独立随机令牌
CONTENT_ADMIN_TOKEN=独立随机令牌
CONTENT_TIMEZONE=Asia/Shanghai
```

连接的 `credentials` 应包含：

```json
{
  "webhookUrl": "https://n8n.example.com/webhook/zlink-social",
  "signingSecret": "outbound-hmac-secret"
}
```

也可以使用兼容环境变量：

```bash
N8N_SOCIAL_WEBHOOK_URL=https://n8n.example.com/webhook/zlink-social
N8N_OUTBOUND_SECRET=
```

生产环境只允许 HTTPS。回调必须把原始 JSON 使用 `N8N_CALLBACK_SECRET` 做 HMAC-SHA256，并把十六进制签名放入 `X-ZLink-Signature`。

内容创建、修改、质检、审批和手动发布 API 必须携带 `Authorization: Bearer $CONTENT_ADMIN_TOKEN`。调度派发使用单独的 `CONTENT_SCHEDULER_TOKEN`，两者不得复用。

## n8n 工作流一：素材生成

收到 `workflow=social.asset.generate` 后：

1. 根据 `provider` 调用即梦或可灵。
2. 等待图片/视频生成完成。
3. 上传到 Supabase Storage 的 `social-assets` bucket。
4. 调用 `/api/content-items/callback`：

```json
{
  "event_id": "n8n-event-unique-id",
  "content_item_id": "content-uuid",
  "job_type": "asset_generation",
  "status": "succeeded",
  "execution_id": "n8n-execution-id",
  "assets": [{ "url": "https://storage.example/social-assets/file.png", "type": "image" }],
  "cover_url": "https://storage.example/social-assets/file.png"
}
```

## n8n 工作流二：排期发布

Supabase `pg_cron` 每小时运行 `queue_due_content_items(100)`，只把到期且已通过所有门禁的内容标记为 `publish_queued`。n8n 定时调用：

```bash
curl -X POST https://app.example.com/api/content-items/dispatch-due \
  -H "Authorization: Bearer $CONTENT_SCHEDULER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

收到 `workflow=social.publish` 后，通过已授权的平台官方接口或合规连接器发布，再回调：

```json
{
  "event_id": "publish-event-unique-id",
  "content_item_id": "content-uuid",
  "job_type": "publish",
  "status": "succeeded",
  "execution_id": "n8n-execution-id",
  "publication_id": "platform-post-id",
  "publication_url": "https://platform.example/post/id",
  "performance_metrics": {}
}
```

不要通过浏览器 Cookie、抓取登录态或未授权自动化绕过平台接口。

## 运营验收

`GET /api/content-items/metrics?days=28` 返回日更天数、连续日更、失败数、待审批数和人工分钟数：

- `fourWeekDailyTargetMet=true`：连续四周每天至少发布一次。
- `interventionTargetMet=true`：28 天日均人工介入少于 30 分钟。

四周指标属于真实运行观察项，代码上线当天只能验证状态机、审批门、回调和指标计算，不能伪造真实运营天数。
