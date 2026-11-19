# ZLink Agent 工作台

本分支保存基于 Paperclip 的 ZLink 工作台定制版本。

- 上游：<https://github.com/paperclipai/paperclip>
- 基线：`v2026.1106.0`，提交 `d69631b01b9c658f80bf8bed389863dce82643e1`
- 分支目标：`zlink-studio/codex-studio` → `codex/zlink-paperclip-workbench`
- 保留上游 [MIT 许可证](LICENSE) 和原始项目说明。

## 当前定制

项目日常沟通使用明确的 `discussion` 模式，首页单列“日常沟通”，收到留言才唤醒，回复后自动待命。日常沟通不计入执行任务数量或待审阅工作，也不触发空闲心跳、缺少评论重试或任务状态修复。具体工作使用独立 `standard` 执行任务，沿用预算、审批和失败恢复机制。模式通过输入框的“＋ → 日常沟通”选择；现有线程转换会保留项目、历史和链接。

自动重试入口调用原生 `scheduled-retry/retry-now`；真实定时监控调用 `monitor/check-now`。无正文的 ACP 结束状态不作为回复发布，历史 Agent `end_turn` 评论在聊天中隐藏，原始日志继续保留。

中文主导航、任务优先的首页、四张业务指标卡片、任务筛选与搜索、最近成果预览、团队状态、深浅色和移动端布局，以及 ZLink Logo/浏览器图标。预算告警、运行状态、原有审批入口、公司隔离和任务执行逻辑沿用 Paperclip。

成果面板最多展示三项。成果库为空时，仅回读最近更新的三项已完成任务的文档。这是轻量入口，不是完整文档索引。费用展示平台已上报金额，不代表模型订阅的剩余额度。

主要定制代码：

- `ui/src/components/ZLinkDashboard.tsx`
- `ui/src/pages/Dashboard.tsx`
- `ui/src/components/Sidebar*.tsx` 与 `MobileBottomNav.tsx`
- `ui/src/index.css` 中的 `--zlink-*` 设计 token
- `ui/public/brands/zlink/` 中的品牌素材

## 开发与构建

需要 Node.js 24.11 或更新版本，以及项目固定的 pnpm 9.15.4。按上游 [开发文档](doc/DEVELOPING.md) 安装依赖和启动应用：

```sh
pnpm install
pnpm dev
```

构建 UI：

```sh
pnpm --filter @paperclipai/ui build
```

若使用独立的现有后端，可运行 UI 预览；其 `/api` 和 WebSocket 请求沿用上游代理配置，默认转发至本机 3100 端口：

```sh
pnpm --filter @paperclipai/ui preview --host 127.0.0.1 --port 3101
```

上述为仓库标准工作流。本次实际验证使用 Node 24.13.0、独立 UI 依赖及同版本已发布的 Paperclip 工作区包；未声称全新设备已完成全仓安装验证。

## 品牌配置与数据

浏览器图标和首页标识来自本分支自带的 ZLink 素材。侧栏公司图标通过 Paperclip 原生公司设置上传 `ui/public/brands/zlink/mark.png`，按公司保存。新环境需要在所选公司的设置中完成这一步，不依赖本机数据库中的资产 ID。

本分支只保存应用源码、品牌资源与实现说明。业务任务、客户资料、数据库、模型登录凭据、运行日志和站内会员原始提示词不属于代码交付。

## 已执行的验证

- UI 生产构建与完整 UI TypeScript 检查。
- Sidebar、SidebarAgents、SidebarRecentTasks、Dashboard 四个测试文件，共 73 项通过。
- 设计 token 门禁与 Git 空白检查。
- 浏览器验证任务搜索/清除、原有新建任务弹窗、真实文档打开、深浅色和 390/1024/1440 宽度布局，以及 Logo 和图标加载。

没有执行全仓后端测试、全量 Storybook 浏览器回归或上线部署。更详细的数据范围与设计说明见 [实现记录](doc/plans/2026-11-18-zlink-workbench-ui.md)。
