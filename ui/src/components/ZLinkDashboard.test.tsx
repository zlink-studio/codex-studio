// @vitest-environment jsdom
import { render, screen, within, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import type { DashboardSummary, Issue } from "@paperclipai/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ZLinkDashboard } from "./ZLinkDashboard";

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { artifacts: [] }, isLoading: false, error: null }),
  useQueries: () => [],
}));
vi.mock("@/lib/router", () => ({ Link: ({ to, children, className }: { to: string; children: ReactNode; className?: string }) => <a href={to} className={className}>{children}</a> }));
afterEach(cleanup);

describe("ZLink discussion and execution sections", () => {
  it("lists a daily discussion separately and excludes it from task counts and review attention", () => {
    const record = { status: "in_review", updatedAt: new Date(), identifier: "ZLI-1" };
    const issues = [
      { ...record, id: "discussion", title: "项目日常沟通", workMode: "discussion" },
      { ...record, id: "execution", identifier: "ZLI-2", title: "交付执行成果", workMode: "standard" },
    ] as Issue[];
    const summary = { tasks: { inProgress: 0, open: 1, done: 0 }, agents: { running: 0 },
      costs: { monthSpendCents: 0 }, pendingApprovals: 0, budgets: { pendingApprovals: 0 } } as DashboardSummary;
    render(<ZLinkDashboard companyId="company" companyName="ZLink" issues={issues} agents={[]} summary={summary}
      notices={null} activity={null} runs={null} charts={null} plugins={null} onNewTask={vi.fn()} />);
    const discussion = screen.getByRole("region", { name: "日常沟通" });
    expect(within(discussion).getByText("项目日常沟通")).toBeTruthy();
    expect(within(discussion).getByText("等待留言")).toBeTruthy();
    const attention = screen.getByRole("region", { name: "需要关注的事项" });
    expect(within(attention).queryByText("项目日常沟通")).toBeNull();
    expect(within(attention).getByText("交付执行成果")).toBeTruthy();
    expect(screen.getByText("共 1 项任务")).toBeTruthy();
    expect(screen.getByText("1 待审阅 · 0 受阻 · 0 待批准")).toBeTruthy();
  });
});
