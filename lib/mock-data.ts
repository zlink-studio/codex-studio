import type {
  Agent,
  AgentSkill,
  DailyReport,
  KnowledgeSource,
  Memory,
  MemoryAccessLog,
  MemoryCategory,
  MemoryRelation,
  Meeting,
  Project,
  Skill,
  SkillReview,
  SkillRun,
  Task
} from "@/lib/types";

export const agents: Agent[] = [
  {
    id: "agent-chief",
    name: "中枢",
    department: "Executive",
    title: "Chief Agent / 总管家",
    managerId: null,
    model: "deepseek-v4-pro",
    prompt: "理解老板目标，调用公司记忆，拆解项目，分派员工，并持续推进到可交付结果。",
    toolPermissions: ["openai", "supabase", "n8n", "browser"],
    status: "online",
    agentRole: "leader",
    skills: ["goal-breakdown", "task-routing", "risk-review", "memory-recall"],
    preferredModelPolicy: "strong_reasoning",
    preferredProvider: "deepseek",
    preferredModel: "deepseek-v4-pro",
    fallbackProvider: "qwen",
    fallbackModel: "qwen-plus",
    maxCostPerRun: 0.5,
    temperature: 0.2,
    maxTokens: 3200,
    workload: 20,
    currentFocus: "把老板目标转成可执行项目，并维护公司级上下文。",
    successRate: 94
  },
  {
    id: "agent-product",
    name: "产品经理",
    department: "Product",
    title: "产品规划 Agent",
    managerId: "agent-chief",
    model: "deepseek-v4-flash",
    prompt: "把业务目标变成产品范围、页面结构、验收标准和迭代计划。",
    toolPermissions: ["openai", "browser", "supabase"],
    status: "online",
    agentRole: "worker",
    skills: ["product-brief", "implementation-planning", "ui-testing"],
    preferredModelPolicy: "product_planning",
    preferredProvider: "deepseek",
    preferredModel: "deepseek-v4-flash",
    fallbackProvider: "qwen",
    fallbackModel: "qwen-plus",
    maxCostPerRun: 0.35,
    temperature: 0.25,
    maxTokens: 2800,
    workload: 25,
    currentFocus: "把项目需求拆成可执行范围。",
    successRate: 90
  },
  {
    id: "agent-market",
    name: "增长营销",
    department: "Marketing",
    title: "增长内容 Agent",
    managerId: "agent-chief",
    model: "qwen-plus",
    prompt: "负责定位、内容选题、获客路径、转化素材和短周期增长实验。",
    toolPermissions: ["openai", "browser"],
    status: "online",
    agentRole: "worker",
    skills: ["positioning", "content-planning", "seo-brief", "outbound-sales"],
    preferredModelPolicy: "creative_content",
    preferredProvider: "qwen",
    preferredModel: "qwen-plus",
    fallbackProvider: "deepseek",
    fallbackModel: "deepseek-v4-flash",
    maxCostPerRun: 0.25,
    temperature: 0.65,
    maxTokens: 2400,
    workload: 18,
    currentFocus: "把产品产物转成可获客内容。",
    successRate: 88
  },
  {
    id: "agent-ops",
    name: "交付运营",
    department: "Operations",
    title: "交付执行 Agent",
    managerId: "agent-chief",
    model: "deepseek-v4-flash",
    prompt: "负责 SOP、自动化方案、交付清单、发布前检查和执行日志。",
    toolPermissions: ["openai", "supabase", "n8n", "browser"],
    status: "online",
    agentRole: "worker",
    skills: ["delivery-sop", "automation-plan", "quality-checklist"],
    preferredModelPolicy: "operations",
    preferredProvider: "deepseek",
    preferredModel: "deepseek-v4-flash",
    fallbackProvider: "qwen",
    fallbackModel: "qwen-plus",
    maxCostPerRun: 0.3,
    temperature: 0.2,
    maxTokens: 2600,
    workload: 16,
    currentFocus: "把任务结果沉淀成稳定交付流程。",
    successRate: 91
  },
  {
    id: "agent-reviewer",
    name: "质检经理",
    department: "Finance",
    title: "风险与质量 Review Agent",
    managerId: "agent-chief",
    model: "deepseek-v4-pro",
    prompt: "检查高风险事项、事实一致性、交付质量、外部动作边界和复核建议。",
    toolPermissions: ["openai", "supabase"],
    status: "idle",
    agentRole: "reviewer",
    skills: ["review-gate", "risk-review", "decision-log"],
    preferredModelPolicy: "review_policy",
    preferredProvider: "deepseek",
    preferredModel: "deepseek-v4-pro",
    fallbackProvider: "qwen",
    fallbackModel: "qwen-plus",
    maxCostPerRun: 0.3,
    temperature: 0.1,
    maxTokens: 2200,
    workload: 10,
    currentFocus: "保证系统不自动执行高风险外部动作。",
    successRate: 86
  }
];

export const projects: Project[] = [];
export const tasks: Task[] = [];

export const memoryCategories: MemoryCategory[] = [
  {
    id: "cat-company",
    name: "公司规则",
    type: "company",
    description: "长期有效的经营原则、权限边界和工作方式。",
    sortOrder: 1,
    createdAt: "2026-06-27T08:00:00+08:00",
    updatedAt: "2026-06-27T08:00:00+08:00"
  },
  {
    id: "cat-sop",
    name: "SOP 流程库",
    type: "sop",
    description: "可复用的交付流程和检查清单。",
    sortOrder: 2,
    createdAt: "2026-06-27T08:00:00+08:00",
    updatedAt: "2026-06-27T08:00:00+08:00"
  },
  {
    id: "cat-project",
    name: "项目经验",
    type: "project",
    description: "项目执行后沉淀的方法、风险和结果。",
    sortOrder: 3,
    createdAt: "2026-06-27T08:00:00+08:00",
    updatedAt: "2026-06-27T08:00:00+08:00"
  }
];

export const memories: Memory[] = [
  {
    id: "memory-risk-boundary",
    title: "高风险外部动作必须确认",
    type: "company",
    scope: "global",
    categoryId: "cat-company",
    content: "涉及发邮件、发布网站、改广告预算、改数据库、合同承诺、第三方系统写入等动作时，Agent 只能生成建议和待确认事项，不能直接执行。",
    summary: "高风险 action skill 不自动执行外部动作。",
    tags: ["risk", "approval", "action-skill"],
    importance: 5,
    confidence: 1,
    status: "approved",
    visibility: "owner",
    sourceType: "manual",
    sourceUrl: null,
    createdAt: "2026-06-27T08:00:00+08:00",
    updatedAt: "2026-06-27T08:00:00+08:00"
  },
  {
    id: "memory-company-os-direction",
    title: "产品方向：一人公司操作系统",
    type: "company",
    scope: "global",
    categoryId: "cat-company",
    content: "产品应学习 Marvis 类工作平台的中枢思路：老板只下达目标，中枢负责理解、拆解、分配、执行、复核和沉淀记忆。普通用户不应该先理解复杂模块。",
    summary: "首页应是公司中枢，而不是模块导航页。",
    tags: ["product", "marvis", "chief-agent"],
    importance: 5,
    confidence: 0.95,
    status: "approved",
    visibility: "owner",
    sourceType: "manual",
    sourceUrl: null,
    createdAt: "2026-06-27T08:10:00+08:00",
    updatedAt: "2026-06-27T08:10:00+08:00"
  }
];

export const memoryRelations: MemoryRelation[] = [];
export const memoryAccessLogs: MemoryAccessLog[] = [];

export const knowledgeSources: KnowledgeSource[] = [
  {
    id: "source-agentmemory",
    name: "agentmemory 方案研究",
    type: "url",
    sourceUrl: "https://github.com/",
    syncMode: "manual",
    status: "active",
    lastSyncedAt: "2026-06-27T08:20:00+08:00",
    metadata: {
      purpose: "未来用于把长期经验、项目复盘和员工上下文与 Supabase 事实库结合。"
    },
    createdAt: "2026-06-27T08:20:00+08:00",
    updatedAt: "2026-06-27T08:20:00+08:00"
  }
];

export const skills: Skill[] = [
  {
    id: "skill-goal-breakdown",
    name: "Goal Breakdown",
    slug: "goal-breakdown",
    category: "management",
    description: "把老板目标拆成项目 brief、阶段、任务、验收标准和风险。",
    instructions: "输出清晰的项目目标、任务列表、优先级、风险等级和下一步动作。",
    inputSchema: { goal: "string", constraints: "string?" },
    outputSchema: { brief: "object", tasks: "array" },
    riskLevel: "low",
    skillType: "knowledge",
    requiredTools: ["openai"],
    requiredMemoryTypes: ["company", "project"],
    approvalRequired: false,
    source: "custom",
    sourceUrl: null,
    license: "Internal",
    version: "0.2.0",
    enabled: true
  },
  {
    id: "skill-memory-recall",
    name: "Memory Recall",
    slug: "memory-recall",
    category: "memory",
    description: "从公司大脑召回规则、客户上下文、项目经验和 SOP。",
    instructions: "只召回 approved 记忆，并在任务日志里记录引用来源。",
    inputSchema: { project_id: "string?", task_context: "string" },
    outputSchema: { memories: "array" },
    riskLevel: "low",
    skillType: "knowledge",
    requiredTools: ["supabase"],
    requiredMemoryTypes: ["company", "client", "project", "sop"],
    approvalRequired: false,
    source: "custom",
    sourceUrl: null,
    license: "Internal",
    version: "0.2.0",
    enabled: true
  },
  {
    id: "skill-content-planning",
    name: "Content Planning",
    slug: "content-planning",
    category: "content",
    description: "生成定位、内容选题、渠道计划和转化素材。",
    instructions: "输出可直接交付的内容计划，并标注目标用户、场景和 CTA。",
    inputSchema: { topic: "string", audience: "string?" },
    outputSchema: { content_plan: "object" },
    riskLevel: "low",
    skillType: "knowledge",
    requiredTools: ["openai", "browser"],
    requiredMemoryTypes: ["client", "project"],
    approvalRequired: false,
    source: "custom",
    sourceUrl: null,
    license: "Internal",
    version: "0.2.0",
    enabled: true
  },
  {
    id: "skill-implementation-planning",
    name: "Implementation Planning",
    slug: "implementation-planning",
    category: "code",
    description: "把产品需求转成可执行开发计划、页面结构和验收清单。",
    instructions: "输出范围、文件结构、关键流程、测试路径和交付物清单。",
    inputSchema: { spec: "string", codebase_context: "string?" },
    outputSchema: { implementation_plan: "object" },
    riskLevel: "medium",
    skillType: "knowledge",
    requiredTools: ["openai", "browser"],
    requiredMemoryTypes: ["project", "sop"],
    approvalRequired: false,
    source: "custom",
    sourceUrl: null,
    license: "Internal",
    version: "0.2.0",
    enabled: true
  },
  {
    id: "skill-review-gate",
    name: "Review Gate",
    slug: "review-gate",
    category: "review",
    description: "复核交付物质量、事实一致性、风险和是否可进入完成状态。",
    instructions: "给出 approve、request_changes、reject 或 require_boss_approval，并写入审核理由。",
    inputSchema: { artifact: "string", checklist: "string[]" },
    outputSchema: { decision: "object" },
    riskLevel: "high",
    skillType: "knowledge",
    requiredTools: ["openai", "supabase"],
    requiredMemoryTypes: ["review", "sop", "project"],
    approvalRequired: true,
    source: "custom",
    sourceUrl: null,
    license: "Internal",
    version: "0.2.0",
    enabled: true
  },
  {
    id: "skill-automation-plan",
    name: "Automation Plan",
    slug: "automation-plan",
    category: "automation",
    description: "为自动化流程生成方案和检查清单，但不直接执行外部动作。",
    instructions: "只生成建议、风险、所需权限和等待确认事项。不得直接发邮件、发布网站或改外部系统。",
    inputSchema: { workflow_goal: "string" },
    outputSchema: { automation_plan: "object" },
    riskLevel: "high",
    skillType: "action",
    requiredTools: ["n8n", "supabase"],
    requiredMemoryTypes: ["sop", "project"],
    approvalRequired: true,
    source: "custom",
    sourceUrl: null,
    license: "Internal",
    version: "0.2.0",
    enabled: true
  }
];

export const agentSkills: AgentSkill[] = [
  { id: "agent-skill-chief-1", agentId: "agent-chief", skillId: "skill-goal-breakdown", priority: "primary", enabled: true },
  { id: "agent-skill-chief-2", agentId: "agent-chief", skillId: "skill-memory-recall", priority: "primary", enabled: true },
  { id: "agent-skill-chief-3", agentId: "agent-chief", skillId: "skill-review-gate", priority: "secondary", enabled: true },
  { id: "agent-skill-product-1", agentId: "agent-product", skillId: "skill-implementation-planning", priority: "primary", enabled: true },
  { id: "agent-skill-market-1", agentId: "agent-market", skillId: "skill-content-planning", priority: "primary", enabled: true },
  { id: "agent-skill-ops-1", agentId: "agent-ops", skillId: "skill-automation-plan", priority: "secondary", enabled: true },
  { id: "agent-skill-review-1", agentId: "agent-reviewer", skillId: "skill-review-gate", priority: "primary", enabled: true }
];

export const skillRuns: SkillRun[] = [];

export const skillReviews: SkillReview[] = [
  {
    id: "skill-review-automation-plan",
    skillId: "skill-automation-plan",
    reviewStatus: "approved",
    riskNotes: "该技能只生成方案和待确认事项，不能直接执行外部动作。",
    reviewedBy: "owner",
    reviewedAt: "2026-06-27T08:30:00+08:00",
    createdAt: "2026-06-27T08:25:00+08:00"
  }
];

export const meetings: Meeting[] = [];

export const dailyReport: DailyReport = {
  id: "report-empty",
  reportDate: "2026-06-27",
  summary: "当前默认底座已清洗。下达第一个真实目标后，今日完成、风险和下一步会自动生成。",
  wins: ["公司中枢入口已准备好", "默认员工和技能已清洗", "高风险外部动作规则已写入公司记忆"],
  risks: ["真实业务闭环需要通过项目详情页继续观察任务日志和交付物"],
  nextActions: ["在公司中枢下达一个小项目目标", "进入项目详情查看执行现场", "确认交付物是否满足预期"]
};
