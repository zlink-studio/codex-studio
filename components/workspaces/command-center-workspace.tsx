"use client";

import { FormEvent, useEffect, useState } from "react";
import { Bot, Send, Workflow } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { StatusBadge } from "@/components/status-badge";
import { normalizeAgent, normalizeTask, readApiData } from "@/lib/client-normalizers";
import { agents as fallbackAgents, tasks as fallbackTasks } from "@/lib/mock-data";
import type { Agent, Task } from "@/lib/types";

export function CommandCenterWorkspace() {
  const [agents, setAgents] = useState<Agent[]>(fallbackAgents);
  const [drafts, setDrafts] = useState<Task[]>(fallbackTasks);
  const [goal, setGoal] = useState("");
  const [message, setMessage] = useState("等待老板输入目标");
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    fetch("/api/agents")
      .then((response) => readApiData<any[]>(response))
      .then((data) => setAgents(data.map(normalizeAgent)))
      .catch(() => undefined);
  }, []);

  const executive = agents.find((agent) => agent.department === "Executive") ?? agents[0];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsRunning(true);
    setMessage("执行经理正在拆解任务...");

    try {
      const data = await readApiData<{ tasks: any[]; persisted: boolean }>(
        await fetch("/api/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ goal })
        })
      );
      setDrafts(data.tasks.map(normalizeTask));
      setMessage(data.persisted ? "任务已写入 Supabase" : "已生成任务草案");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "拆解失败");
    } finally {
      setIsRunning(false);
    }
  }

  async function triggerN8n() {
    setMessage("正在触发 n8n...");
    try {
      const data = await readApiData<{ triggered: boolean; reason?: string }>(
        await fetch("/api/n8n/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: goal || "manual-trigger", tasks: drafts })
        })
      );
      setMessage(data.triggered ? "n8n 已触发" : data.reason ?? "n8n 未配置");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "触发失败");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Command Center"
        title="老板指挥台"
        description="输入目标后，由执行经理 Agent 拆解任务、评估风险、分配岗位，并自动写入 Tasks。"
        action={<span className="rounded-md border border-line bg-[#fbfcf8] px-3 py-2 text-sm text-moss">{message}</span>}
      />

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Panel title="输入经营命令" description={`主持人：${executive?.name ?? "执行经理 Agent"} · 高风险任务会进入审批。`}>
          <form className="space-y-4" onSubmit={submit}>
            <textarea
              className="min-h-48 w-full rounded-md border border-line bg-paper px-4 py-3 text-sm leading-6 outline-none focus:border-moss"
              placeholder="例如：本周把 Aurora 项目的自动化交付流程上线，并产出一个可复用案例。"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              required
            />
            <div className="flex flex-wrap gap-3">
              <button className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60" disabled={isRunning}>
                <Send size={16} />
                {isRunning ? "拆解中..." : "提交给执行经理"}
              </button>
              <button type="button" onClick={triggerN8n} className="inline-flex items-center gap-2 rounded-md border border-line px-4 py-2 text-sm font-semibold text-moss">
                <Workflow size={16} />
                触发 n8n Webhook
              </button>
            </div>
          </form>
        </Panel>

        <Panel title="拆解结果" description="返回任务草案、分配 Agent、风险等级和审批状态。">
          <div className="space-y-4">
            {drafts.map((task) => {
              const agent = agents.find((item) => item.id === task.assignedAgentId);
              return (
                <div key={task.id} className="rounded-md border border-line bg-paper p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Bot size={16} className="text-moss" />
                      <p className="font-medium text-ink">{task.title}</p>
                    </div>
                    <StatusBadge value={task.riskLevel} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-moss">{task.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-md bg-[#e8efe4] px-2 py-1 text-xs font-medium text-moss">{agent?.name ?? "未分配"}</span>
                    <StatusBadge value={task.approvalStatus} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </section>
    </>
  );
}
