"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { ProgressBar } from "@/components/progress-bar";
import { normalizeAgent, normalizeProject, readApiData } from "@/lib/client-normalizers";
import { agents as fallbackAgents, projects as fallbackProjects } from "@/lib/mock-data";
import type { Agent, Project } from "@/lib/types";

const initialForm = {
  name: "",
  client_name: "",
  objective: "",
  client_profile: "",
  progress: "0",
  stage: "planning",
  due_date: ""
};

export function ProjectsWorkspace() {
  const [items, setItems] = useState<Project[]>(fallbackProjects);
  const [agents, setAgents] = useState<Agent[]>(fallbackAgents);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("已加载本地示例数据");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetch("/api/projects").then((response) => readApiData<any[]>(response)), fetch("/api/agents").then((response) => readApiData<any[]>(response))])
      .then(([projectRows, agentRows]) => {
        setItems(projectRows.map(normalizeProject));
        setAgents(agentRows.map(normalizeAgent));
        setMessage("已连接 Projects API");
      })
      .catch((error: Error) => setMessage(error.message));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("正在保存项目...");

    try {
      const data = await readApiData<any>(
        await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, progress: Number(form.progress), due_date: form.due_date || null })
        })
      );
      setItems((current) => [normalizeProject(data), ...current]);
      setForm(initialForm);
      setMessage("项目已保存");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Projects" title="项目中心" description="创建客户项目，记录目标、客户资料、项目进度和参与 Agent。" action={<StatusPill text={message} />} />

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="客户项目表单" description="保存后会调用 /api/projects；参与 Agent 后续可通过 project_agents 关系表管理。">
          <form className="grid gap-4" onSubmit={submit}>
            <input className="rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-moss" placeholder="项目名称" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            <input className="rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-moss" placeholder="客户名称" value={form.client_name} onChange={(event) => setForm({ ...form, client_name: event.target.value })} required />
            <textarea className="min-h-24 rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-moss" placeholder="项目目标" value={form.objective} onChange={(event) => setForm({ ...form, objective: event.target.value })} required />
            <textarea className="min-h-24 rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-moss" placeholder="客户资料" value={form.client_profile} onChange={(event) => setForm({ ...form, client_profile: event.target.value })} />
            <div className="grid gap-4 md:grid-cols-3">
              <input className="rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-moss" placeholder="阶段" value={form.stage} onChange={(event) => setForm({ ...form, stage: event.target.value })} />
              <input type="number" min={0} max={100} className="rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-moss" placeholder="进度 %" value={form.progress} onChange={(event) => setForm({ ...form, progress: event.target.value })} />
              <input type="date" className="rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-moss" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} />
            </div>
            <button className="w-fit rounded-md bg-moss px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60" disabled={isSaving}>
              {isSaving ? "保存中..." : "保存项目"}
            </button>
          </form>
        </Panel>

        <div className="space-y-4">
          {items.map((project) => (
            <Panel key={project.id}>
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                <div>
                  <h3 className="text-lg font-semibold text-ink">{project.name}</h3>
                  <p className="mt-1 text-sm text-moss">{project.clientName} · {project.stage}</p>
                </div>
                {project.dueDate && <span className="rounded-md bg-mint px-2 py-1 text-xs font-semibold text-ink">Due {project.dueDate}</span>}
              </div>
              <p className="mt-4 text-sm leading-6 text-moss">{project.objective}</p>
              <p className="mt-3 text-sm leading-6 text-moss">{project.clientProfile}</p>
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-ink">项目进度</span>
                  <span className="font-semibold text-moss">{project.progress}%</span>
                </div>
                <ProgressBar value={project.progress} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(project.agentIds.length ? project.agentIds : agents.slice(0, 2).map((agent) => agent.id)).map((agentId) => {
                  const agent = agents.find((item) => item.id === agentId);
                  return (
                    <span key={agentId} className="rounded-md bg-[#e8efe4] px-2 py-1 text-xs font-medium text-moss">
                      {agent?.name ?? agentId}
                    </span>
                  );
                })}
              </div>
            </Panel>
          ))}
        </div>
      </section>
    </>
  );
}

function StatusPill({ text }: { text: string }) {
  return <span className="rounded-md border border-line bg-[#fbfcf8] px-3 py-2 text-sm text-moss">{text}</span>;
}
