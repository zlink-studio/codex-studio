"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileOutput, FolderOpen, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { ProgressBar } from "@/components/progress-bar";
import { normalizeAgent, normalizeProject, readApiData } from "@/lib/client-normalizers";
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

const stageLabels: Record<string, string> = {
  planning: "方案规划",
  execution: "执行中",
  review: "待验收",
  publishing: "待发布",
  delivered: "已交付",
  pilot: "试运行"
};

type DraftStatus = {
  exists: boolean;
  outputDir: string | null;
  generatedAt?: string | null;
  files: string[];
};

export function ProjectsWorkspace() {
  const [items, setItems] = useState<Project[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [draftStatuses, setDraftStatuses] = useState<Record<string, DraftStatus>>({});
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("正在加载项目数据...");
  const [isSaving, setIsSaving] = useState(false);
  const [busyProjectId, setBusyProjectId] = useState<string | null>(null);

  const connectedCount = useMemo(
    () => Object.values(draftStatuses).filter((item) => item?.exists).length,
    [draftStatuses]
  );

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    try {
      const [projectRows, agentRows] = await Promise.all([
        fetch("/api/projects").then((response) => readApiData<any[]>(response)),
        fetch("/api/agents").then((response) => readApiData<any[]>(response))
      ]);

      const normalizedProjects = projectRows.map(normalizeProject);
      setItems(normalizedProjects);
      setAgents(agentRows.map(normalizeAgent));

      const statusRows = await Promise.all(
        normalizedProjects.map(async (project) => {
          const status = await readApiData<DraftStatus>(
            await fetch(`/api/projects/${project.id}/generate-site`)
          );
          return [project.id, status] as const;
        })
      );

      setDraftStatuses(Object.fromEntries(statusRows));
      setMessage(
        normalizedProjects.length
          ? `已连接 ${normalizedProjects.length} 个项目，${statusRows.filter(([, status]) => status?.exists).length} 个项目已有真实输出`
          : "当前还没有项目，先创建一个真实客户项目。"
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载失败");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("正在保存项目...");

    try {
      const data = await readApiData<any>(
        await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            progress: Number(form.progress),
            due_date: form.due_date || null
          })
        })
      );

      setItems((current) => [normalizeProject(data), ...current]);
      setForm(initialForm);
      setMessage("项目已保存。");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  }

  async function generateDraft(project: Project) {
    setBusyProjectId(project.id);
    setMessage(`正在为 ${project.name} 生成建站初稿...`);

    try {
      const result = await readApiData<{
        generatedAt: string;
        outputDir: string;
        files: string[];
      }>(await fetch(`/api/projects/${project.id}/generate-site`, { method: "POST" }));

      setDraftStatuses((current) => ({
        ...current,
        [project.id]: {
          exists: true,
          outputDir: result.outputDir,
          generatedAt: result.generatedAt,
          files: result.files
        }
      }));
      setMessage(`已为 ${project.name} 生成 ${result.files.length} 个本地输出文件。`);
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "生成失败");
    } finally {
      setBusyProjectId(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Projects"
        title="项目中心"
        description="这里不只是录入项目名，而是把真实客户项目、任务推进和建站产物连到一起。"
        action={<StatusPill text={message} />}
      />

      <section className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
        <Panel
          title="创建客户项目"
          description="保存后会写入本地项目库，后续任务、员工分工和输出文件都会挂在这个项目下面。"
        >
          <form className="grid gap-4" onSubmit={submit}>
            <input
              className="rounded-2xl border border-line/70 bg-paper/70 px-4 py-3 text-sm outline-none focus:border-moss"
              placeholder="项目名称"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
            <input
              className="rounded-2xl border border-line/70 bg-paper/70 px-4 py-3 text-sm outline-none focus:border-moss"
              placeholder="客户名称"
              value={form.client_name}
              onChange={(event) => setForm({ ...form, client_name: event.target.value })}
              required
            />
            <textarea
              className="min-h-28 rounded-[24px] border border-line/70 bg-paper/70 px-4 py-3 text-sm outline-none focus:border-moss"
              placeholder="项目目标"
              value={form.objective}
              onChange={(event) => setForm({ ...form, objective: event.target.value })}
              required
            />
            <textarea
              className="min-h-28 rounded-[24px] border border-line/70 bg-paper/70 px-4 py-3 text-sm outline-none focus:border-moss"
              placeholder="客户背景"
              value={form.client_profile}
              onChange={(event) => setForm({ ...form, client_profile: event.target.value })}
            />
            <div className="grid gap-4 md:grid-cols-3">
              <input
                className="rounded-2xl border border-line/70 bg-paper/70 px-4 py-3 text-sm outline-none focus:border-moss"
                placeholder="当前阶段"
                value={form.stage}
                onChange={(event) => setForm({ ...form, stage: event.target.value })}
              />
              <input
                type="number"
                min={0}
                max={100}
                className="rounded-2xl border border-line/70 bg-paper/70 px-4 py-3 text-sm outline-none focus:border-moss"
                placeholder="进度 %"
                value={form.progress}
                onChange={(event) => setForm({ ...form, progress: event.target.value })}
              />
              <input
                type="date"
                className="rounded-2xl border border-line/70 bg-paper/70 px-4 py-3 text-sm outline-none focus:border-moss"
                value={form.due_date}
                onChange={(event) => setForm({ ...form, due_date: event.target.value })}
              />
            </div>
            <button
              className="w-fit rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-paper disabled:opacity-60"
              disabled={isSaving}
            >
              {isSaving ? "保存中..." : "保存项目"}
            </button>
          </form>
        </Panel>

        <div className="space-y-4">
          <Panel
            title="当前项目概况"
            description={`共 ${items.length} 个项目，${connectedCount} 个项目已经生成真实本地输出。`}
          >
            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard label="项目总数" value={String(items.length)} helper="本地项目库" />
              <MetricCard label="已生成产物" value={String(connectedCount)} helper="已落盘到 outputs" />
              <MetricCard
                label="活跃阶段"
                value={items[0] ? (stageLabels[items[0].stage] ?? items[0].stage) : "-"}
                helper={items[0] ? items[0].name : "暂无"}
              />
            </div>
          </Panel>

          {items.length === 0 ? (
            <Panel>
              <div className="rounded-[24px] border border-dashed border-line/70 bg-paper/35 p-8 text-center text-sm text-moss">
                还没有真实项目。先创建一个客户项目，再让员工和任务挂上去。
              </div>
            </Panel>
          ) : (
            items.map((project) => {
              const status = draftStatuses[project.id];
              return (
                <Panel key={project.id}>
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-2xl font-semibold tracking-tight text-ink">{project.name}</h3>
                        <span className="rounded-full bg-[#e9efe7] px-3 py-1 text-xs font-semibold text-moss">
                          {stageLabels[project.stage] ?? project.stage}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-moss">{project.clientName}</p>
                    </div>
                    {project.dueDate ? (
                      <span className="rounded-full bg-mint px-3 py-1.5 text-xs font-semibold text-ink">
                        截止 {project.dueDate}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-4 text-sm leading-7 text-moss">{project.objective}</p>
                  <p className="mt-3 text-sm leading-7 text-moss">{project.clientProfile}</p>

                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-medium text-ink">项目进度</span>
                      <span className="font-semibold text-moss">{project.progress}%</span>
                    </div>
                    <ProgressBar value={project.progress} />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {project.agentIds.map((agentId) => {
                      const agent = agents.find((item) => item.id === agentId);
                      return (
                        <span
                          key={agentId}
                          className="rounded-full bg-[#e8efe4] px-3 py-1.5 text-xs font-medium text-moss"
                        >
                          {agent?.name ?? agentId}
                        </span>
                      );
                    })}
                  </div>

                  <div className="mt-5 rounded-[22px] border border-line/70 bg-paper/45 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-ink">建站产物</p>
                        <p className="mt-1 text-sm text-moss">
                          {status?.exists
                            ? `已经生成 ${status.files.length} 个本地文件，可继续用于预览、交付或发布前检查。`
                            : "还没有生成建站初稿。"}
                        </p>
                        {status?.generatedAt ? (
                          <p className="mt-1 text-xs text-moss">
                            最近生成时间：{new Date(status.generatedAt).toLocaleString("zh-CN")}
                          </p>
                        ) : null}
                        {status?.outputDir ? (
                          <div className="mt-2 flex items-start gap-2 text-xs text-moss">
                            <FolderOpen size={14} className="mt-0.5 shrink-0" />
                            <span className="break-all">{status.outputDir}</span>
                          </div>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={() => void generateDraft(project)}
                        disabled={busyProjectId === project.id}
                        className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-paper disabled:opacity-60"
                      >
                        <Sparkles size={16} />
                        {busyProjectId === project.id ? "生成中..." : "生成建站初稿"}
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-3">
                      <Link
                        href={`/projects/${project.id}`}
                        className="inline-flex items-center rounded-full border border-line/70 bg-paper px-4 py-2 text-sm font-semibold text-moss"
                      >
                        查看项目详情与执行进度
                      </Link>
                    </div>

                    {status?.files?.length ? (
                      <div className="mt-4">
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-moss">
                          <FileOutput size={14} />
                          输出文件
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {status.files.map((file) => (
                            <span
                              key={file}
                              className="rounded-full border border-line/70 bg-paper px-3 py-1 text-xs text-moss"
                            >
                              {file}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </Panel>
              );
            })
          )}
        </div>
      </section>
    </>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-[24px] border border-line/70 bg-paper/50 p-4">
      <p className="text-sm text-moss">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-2 text-xs text-moss">{helper}</p>
    </div>
  );
}

function StatusPill({ text }: { text: string }) {
  return (
    <span className="rounded-full border border-line/70 bg-paper/55 px-4 py-2 text-sm text-moss backdrop-blur-xl">
      {text}
    </span>
  );
}
