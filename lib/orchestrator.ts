import { defaultModel, createOpenAIClient } from "@/lib/openai";
import { agents } from "@/lib/mock-data";
import type { RiskLevel, TaskPriority } from "@/lib/types";

export type TaskDraft = {
  title: string;
  description: string;
  taskType: string;
  assignedAgentId: string;
  priority: TaskPriority;
  riskLevel: RiskLevel;
  approvalStatus: "not_required" | "pending";
};

export async function decomposeGoal(goal: string): Promise<TaskDraft[]> {
  const client = createOpenAIClient();

  if (!client) {
    return fallbackDecomposition(goal);
  }

  const response = await client.chat.completions.create({
    model: defaultModel,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "你是一人公司执行经理 Agent。把老板目标拆成 3-6 个任务，按岗位分配 Agent。高风险任务 riskLevel 必须是 high 或 critical，approvalStatus 必须 pending。只输出 JSON 数组。"
      },
      {
        role: "user",
        content: JSON.stringify({
          goal,
          agents: agents.map((agent) => ({
            id: agent.id,
            name: agent.name,
            department: agent.department,
            title: agent.title
          })),
          schema: {
            title: "string",
            description: "string",
            taskType: "general | marketing | operations | finance | product | sales",
            assignedAgentId: "agent id",
            priority: "low | medium | high | urgent",
            riskLevel: "low | medium | high | critical",
            approvalStatus: "not_required | pending"
          }
        })
      }
    ]
  });

  const content = response.choices[0]?.message.content ?? "[]";
  try {
    const parsed = JSON.parse(content) as TaskDraft[];
    return parsed.map(enforceApprovalRule);
  } catch {
    return fallbackDecomposition(goal);
  }
}

export function enforceApprovalRule(task: TaskDraft): TaskDraft {
  const needsApproval = task.riskLevel === "high" || task.riskLevel === "critical";
  return {
    ...task,
    approvalStatus: needsApproval ? "pending" : task.approvalStatus
  };
}

function fallbackDecomposition(goal: string): TaskDraft[] {
  return [
    {
      title: "澄清目标与验收标准",
      description: `围绕“${goal}”确认业务结果、完成标准、时间线和不可触碰边界。`,
      taskType: "general",
      assignedAgentId: "agent-exec",
      priority: "urgent",
      riskLevel: "medium",
      approvalStatus: "not_required"
    },
    {
      title: "制定执行路径与岗位分工",
      description: "执行经理将目标拆成项目里程碑、任务依赖、负责人和日报检查点。",
      taskType: "operations",
      assignedAgentId: "agent-ops",
      priority: "high",
      riskLevel: "medium",
      approvalStatus: "not_required"
    },
    {
      title: "识别外部动作与审批风险",
      description: "检查是否涉及客户承诺、合同条款、预算支出或外部自动化触发。",
      taskType: "finance",
      assignedAgentId: "agent-finance",
      priority: "high",
      riskLevel: "high",
      approvalStatus: "pending"
    },
    {
      title: "生成对外沟通与增长素材",
      description: "根据目标输出客户沟通稿、内容方向或推广素材草案。",
      taskType: "marketing",
      assignedAgentId: "agent-market",
      priority: "medium",
      riskLevel: "low",
      approvalStatus: "not_required"
    }
  ];
}

export async function runMeeting(topic: string, participantAgentIds: string[]) {
  const participantNames = participantAgentIds
    .map((id) => agents.find((agent) => agent.id === id))
    .filter(Boolean)
    .map((agent) => `${agent!.name}（${agent!.title}）`);

  return {
    topic,
    messages: participantNames.map((name) => ({
      speaker: name,
      content: `我从岗位视角建议：围绕“${topic}”先明确风险边界，再拆成可验收任务。`
    })),
    conclusion: `围绕“${topic}”，优先推进低风险可执行事项；涉及客户承诺、预算或自动化外部动作的部分进入审批。`,
    actionItems: ["执行经理整理任务清单", "相关 Agent 补充岗位建议", "老板审批高风险事项"]
  };
}
