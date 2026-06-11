import type { Agent, DailyReport, KnowledgeSource, Memory, MemoryAccessLog, MemoryCategory, MemoryRelation, Meeting, Project, Task } from "@/lib/types";

export const agents: Agent[] = [
  {
    id: "agent-exec",
    name: "林澈",
    department: "Executive",
    title: "执行经理 Agent",
    managerId: null,
    model: "gpt-4o",
    prompt: "你是一人公司的执行经理，负责目标拆解、任务编排、风险识别和会议主持。",
    toolPermissions: ["openai", "supabase", "n8n", "email"],
    status: "online",
    agentRole: "leader",
    skills: ["goal_breakdown", "task_routing", "risk_review"],
    preferredModelPolicy: "strong_reasoning",
    fallbackModel: "gpt-4o-mini",
    workload: 72,
    currentFocus: "拆解老板今日增长目标",
    successRate: 94
  },
  {
    id: "agent-market",
    name: "岑远",
    department: "Marketing",
    title: "增长营销 Agent",
    managerId: "agent-exec",
    model: "gpt-4o-mini",
    prompt: "你负责用户洞察、渠道策略、内容日历和广告创意。",
    toolPermissions: ["openai", "browser", "n8n"],
    status: "busy",
    agentRole: "worker",
    skills: ["content", "social", "campaigns", "market_research"],
    preferredModelPolicy: "creative_content",
    fallbackModel: "gpt-4o-mini",
    workload: 81,
    currentFocus: "设计获客内容矩阵",
    successRate: 88
  },
  {
    id: "agent-ops",
    name: "许栩",
    department: "Operations",
    title: "运营交付 Agent",
    managerId: "agent-exec",
    model: "gpt-4o-mini",
    prompt: "你负责 SOP、项目推进、客户交付和复盘。",
    toolPermissions: ["openai", "supabase", "email"],
    status: "online",
    agentRole: "worker",
    skills: ["delivery", "sop", "automation", "customer_success"],
    preferredModelPolicy: "automation_policy",
    fallbackModel: "gpt-4o-mini",
    workload: 64,
    currentFocus: "整理客户交付 SOP",
    successRate: 91
  },
  {
    id: "agent-finance",
    name: "周砚",
    department: "Finance",
    title: "财务风控 Agent",
    managerId: "agent-exec",
    model: "gpt-4o-mini",
    prompt: "你负责预算、现金流、合同风险和高风险任务审查。",
    toolPermissions: ["openai", "supabase"],
    status: "idle",
    agentRole: "reviewer",
    skills: ["finance", "contract_risk", "approval", "review"],
    preferredModelPolicy: "review_policy",
    fallbackModel: "gpt-4o-mini",
    workload: 31,
    currentFocus: "等待审批任务",
    successRate: 86
  }
];

export const projects: Project[] = [
  {
    id: "project-aurora",
    name: "Aurora 咨询交付",
    clientName: "Aurora Studio",
    objective: "30 天内完成 AI 工作流诊断、SOP 重建与自动化上线。",
    clientProfile: "创意服务公司，团队 12 人，主要痛点是交付不稳定、销售线索沉淀不足。",
    progress: 62,
    stage: "自动化搭建",
    agentIds: ["agent-exec", "agent-ops", "agent-market"],
    dueDate: "2026-06-28"
  },
  {
    id: "project-solo",
    name: "个人品牌增长系统",
    clientName: "内部项目",
    objective: "建立可复用的内容生产、私域转化和日报复盘系统。",
    clientProfile: "一人公司自营增长项目，目标是降低老板日常运营负担。",
    progress: 38,
    stage: "策略验证",
    agentIds: ["agent-exec", "agent-market", "agent-finance"],
    dueDate: "2026-07-12"
  }
];

export const tasks: Task[] = [
  {
    id: "task-001",
    title: "拆解 Aurora 自动化上线计划",
    description: "将客户现有交付流程拆成 n8n 自动化节点、负责人和验收标准。",
    taskType: "automation",
    projectId: "project-aurora",
    assignedAgentId: "agent-exec",
    priority: "urgent",
    riskLevel: "high",
    dueAt: "2026-06-10T18:00:00+08:00",
    status: "in_progress",
    boardStatus: "in_progress",
    approvalStatus: "pending",
    reviewStatus: "not_required",
    outputs: [
      {
        agentId: "agent-exec",
        content: "已识别 4 条关键链路：线索进入、需求澄清、交付排期、日报通知。",
        createdAt: "2026-06-09T09:30:00+08:00"
      }
    ]
  },
  {
    id: "task-002",
    title: "生成本周内容选题池",
    description: "围绕一人公司 AI 员工主题生成 20 个短内容选题。",
    taskType: "content",
    projectId: "project-solo",
    assignedAgentId: "agent-market",
    priority: "high",
    riskLevel: "medium",
    dueAt: "2026-06-11T12:00:00+08:00",
    status: "todo",
    boardStatus: "todo",
    approvalStatus: "not_required",
    reviewStatus: "not_required",
    outputs: []
  },
  {
    id: "task-003",
    title: "复核客户合同付款节点",
    description: "检查 Aurora 合同付款、延期、变更范围条款。",
    taskType: "review",
    projectId: "project-aurora",
    assignedAgentId: "agent-finance",
    priority: "medium",
    riskLevel: "critical",
    dueAt: "2026-06-12T17:00:00+08:00",
    status: "blocked",
    boardStatus: "blocked",
    approvalStatus: "pending",
    reviewStatus: "not_required",
    outputs: []
  }
];

export const memories: Memory[] = [
  {
    id: "memory-001",
    title: "高风险任务审批规则",
    type: "sop",
    scope: "global",
    categoryId: "cat-sop",
    content: "risk_level 为 high 或 critical 的任务必须创建 approvals 记录，并等待老板审批后再执行外部动作。",
    summary: "高风险任务必须进入老板审批。",
    tags: ["approval", "risk", "sop"],
    importance: 5,
    confidence: 1,
    status: "approved",
    visibility: "owner",
    sourceType: "manual",
    sourceUrl: null,
    createdAt: "2026-06-09T08:00:00+08:00",
    updatedAt: "2026-06-09T08:00:00+08:00"
  },
  {
    id: "memory-002",
    title: "Aurora Studio 客户档案",
    type: "client",
    scope: "client",
    categoryId: "cat-client-aurora",
    content: "客户重视交付透明度和每周成果展示，沟通偏好是简短结论加明确待办。",
    summary: "Aurora Studio 偏好简短结论和透明交付。",
    tags: ["client", "aurora"],
    relatedClient: "Aurora Studio",
    clientName: "Aurora Studio",
    importance: 4,
    confidence: 0.9,
    status: "approved",
    visibility: "owner",
    sourceType: "manual",
    sourceUrl: null,
    createdAt: "2026-06-08T16:00:00+08:00",
    updatedAt: "2026-06-08T16:00:00+08:00"
  }
];

export const memoryCategories: MemoryCategory[] = [
  { id: "cat-company", name: "公司级记忆", type: "company", parentId: null, description: "公司原则、长期策略和经营背景", sortOrder: 1 },
  { id: "cat-client", name: "客户级记忆", type: "client", parentId: null, description: "客户档案、偏好和品牌风格", sortOrder: 2 },
  { id: "cat-client-aurora", name: "Aurora Studio", type: "client", parentId: "cat-client", description: "Aurora 客户资料和交付偏好", sortOrder: 1 },
  { id: "cat-project", name: "项目级记忆", type: "project", parentId: null, description: "项目目标、里程碑和上下文", sortOrder: 3 },
  { id: "cat-agent", name: "Agent 记忆", type: "agent", parentId: null, description: "员工偏好、能力和历史表现", sortOrder: 4 },
  { id: "cat-sop", name: "SOP 流程库", type: "sop", parentId: null, description: "标准流程、审核规则和交付模板", sortOrder: 5 },
  { id: "cat-review", name: "复盘经验库", type: "review", parentId: null, description: "复盘、踩坑和改进建议", sortOrder: 6 },
  { id: "cat-source", name: "外部知识源", type: "source", parentId: null, description: "上传文件、WPS、Notion 等来源", sortOrder: 7 }
];

export const memoryRelations: MemoryRelation[] = [
  {
    id: "rel-memory-001",
    memoryId: "memory-001",
    relatedType: "task",
    relatedId: "task-003",
    relationType: "supports",
    createdAt: "2026-06-09T09:00:00+08:00"
  }
];

export const memoryAccessLogs: MemoryAccessLog[] = [
  {
    id: "access-001",
    memoryId: "memory-001",
    agentId: "agent-exec",
    taskId: "task-001",
    accessType: "retrieve",
    createdAt: "2026-06-09T09:20:00+08:00",
    memoryTitle: "高风险任务审批规则",
    agentName: "林澈",
    taskTitle: "拆解 Aurora 自动化上线计划"
  }
];

export const knowledgeSources: KnowledgeSource[] = [
  {
    id: "source-manual",
    name: "手动录入",
    type: "manual",
    sourceUrl: null,
    syncMode: "manual",
    status: "active",
    lastSyncedAt: "2026-06-09T08:00:00+08:00",
    metadata: { note: "MVP 默认来源" }
  },
  {
    id: "source-upload",
    name: "上传文件",
    type: "upload",
    sourceUrl: null,
    syncMode: "manual",
    status: "active",
    lastSyncedAt: null,
    metadata: { enabled: true }
  }
];

export const meetings: Meeting[] = [
  {
    id: "meeting-001",
    topic: "Aurora 自动化上线风险会",
    hostAgentId: "agent-exec",
    participantAgentIds: ["agent-ops", "agent-finance"],
    conclusion: "先冻结合同范围，再上线交付日报自动化，避免范围蔓延。",
    actionItems: ["财务 Agent 复核付款条款", "运营 Agent 输出日报模板", "执行经理更新项目里程碑"],
    createdAt: "2026-06-09T11:00:00+08:00"
  }
];

export const dailyReport: DailyReport = {
  id: "report-2026-06-09",
  reportDate: "2026-06-09",
  summary: "今日重点推进 Aurora 自动化交付和个人品牌增长系统。高风险事项集中在合同条款与上线范围控制。",
  wins: ["完成 4 条核心自动化链路梳理", "新增 20 个内容选题候选方向", "识别 2 个需要老板审批的风险任务"],
  risks: ["Aurora 合同变更范围尚未确认", "执行经理 Agent 今日负载偏高"],
  nextActions: ["审批高风险任务", "确认 n8n Webhook 节点", "启动会议室复盘"]
};
