import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ZLinkDashboard } from "@/components/ZLinkDashboard";
import { queryKeys } from "@/lib/queryKeys";
import { createIssue, storybookAgents, storybookDashboardSummary } from "../../fixtures/paperclipData";

function WorkbenchStory({ empty = false, failed = false }: { empty?: boolean; failed?: boolean }) {
  const companyId = storybookDashboardSummary.companyId;
  const issues = empty ? [] : [
    createIssue({ id: "zlink-review", identifier: "PAP-201", title: "审阅下周的客户内容方案并确认交付范围", status: "in_review", assigneeAgentId: storybookAgents[0].id }),
    createIssue({ id: "zlink-active", identifier: "PAP-202", title: "整理新客户的资料与本周业务执行清单", status: "in_progress", assigneeAgentId: storybookAgents[0].id }),
    createIssue({ id: "zlink-done", identifier: "PAP-203", title: "完成市场调研与下一步行动建议", status: "done" }),
  ];
  const [client] = useState(() => {
    const cache = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    cache.setQueryData([...queryKeys.artifacts.list(companyId), "dashboard", { limit: 3 }], { artifacts: [] });
    cache.setQueryData(queryKeys.issues.documents("zlink-done"), []);
    return cache;
  });
  const summary = { ...storybookDashboardSummary, agents: { ...storybookDashboardSummary.agents, running: 0 }, tasks: { open: issues.length ? 2 : 0, inProgress: issues.length ? 1 : 0, blocked: 0, done: issues.length ? 1 : 0 }, pendingApprovals: 0, budgets: { ...storybookDashboardSummary.budgets, pendingApprovals: 0 } };
  return <QueryClientProvider client={client}><main className="bg-background p-6 text-foreground">
    <ZLinkDashboard companyId={companyId} companyName="ZLink 演示公司" summary={summary} issues={failed ? undefined : issues} agents={storybookAgents} issuesError={failed ? new Error("任务暂时无法读取，请稍后重试。") : null} notices={null} plugins={null} runs={null} activity={<p>活动记录沿用现有组件。</p>} charts={<p>执行图表沿用现有组件。</p>} onNewTask={() => {}} />
  </main></QueryClientProvider>;
}

const meta = {
  id: "design-zlink-workbench",
  title: "Design proposals/Pages/ZLink workbench",
  component: WorkbenchStory,
  parameters: {
    layout: "fullscreen", initialEntries: ["/PAP/dashboard"], designProposalTheme: false,
    paperclip: { capabilities: ["activity/overview"], status: "proposed", implementation: "production", boundary: "fixtures", home: "design-proposals", exception: "Local user-directed ZLink trial customization, not an upstream dashboard rollout.", notes: "Production component with offline task fixtures; does not execute agents or validate live permissions. Browser acceptance uses the isolated real-data trial." },
  },
} satisfies Meta<typeof WorkbenchStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Workbench: Story = {};
export const Empty: Story = { args: { empty: true } };
export const ReadError: Story = { args: { failed: true } };
