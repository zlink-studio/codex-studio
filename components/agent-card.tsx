import { StatusBadge } from "@/components/status-badge";
import type { Agent } from "@/lib/types";

export function AgentCard({ agent }: { agent: Agent }) {
  return (
    <article className="rounded-lg border border-line bg-[#fbfcf8] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-ink">{agent.name}</h3>
          <p className="mt-1 text-sm text-moss">{agent.title}</p>
        </div>
        <StatusBadge value={agent.status} />
      </div>
      <div className="mt-4 space-y-2 text-sm text-moss">
        <p>部门：{agent.department}</p>
        <p>角色：{agent.agentRole ?? "worker"}</p>
        <p>默认模型：{agent.model}</p>
        <p>策略：{agent.preferredModelPolicy ?? "自动路由"}</p>
        <p>
          首选：{agent.preferredProvider ?? "policy"} / {agent.preferredModel ?? agent.model}
        </p>
        <p>
          备用：{agent.fallbackProvider ?? "openai"} / {agent.fallbackModel ?? "gpt-4o-mini"}
        </p>
        <p>成本上限：{agent.maxCostPerRun ? `$${agent.maxCostPerRun}` : "未设置"}</p>
        <p>负载：{agent.workload ?? 0}%</p>
        <p>成功率：{agent.successRate}%</p>
        <p className="line-clamp-2">焦点：{agent.currentFocus}</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {[...agent.toolPermissions, ...(agent.skills ?? [])].map((label) => (
          <span key={label} className="rounded-md bg-[#e8efe4] px-2 py-1 text-xs font-medium text-moss">
            {label}
          </span>
        ))}
      </div>
    </article>
  );
}
