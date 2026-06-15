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
    id: "agent-exec",
    name: "�ֲ�",
    department: "Executive",
    title: "ִ���ܹ� Agent",
    managerId: null,
    model: "deepseek-v4-pro",
    prompt: "����Ŀ���⡢������ɡ����ȼ��жϺ͹ؼ��������ѡ�",
    toolPermissions: ["openai", "supabase", "n8n", "email"],
    status: "online",
    agentRole: "leader",
    skills: ["goal_breakdown", "task_routing", "risk_review"],
    preferredModelPolicy: "strong_reasoning",
    preferredProvider: "deepseek",
    preferredModel: "deepseek-v4-pro",
    fallbackProvider: "qwen",
    fallbackModel: "qwen-max",
    maxCostPerRun: 0.5,
    temperature: 0.2,
    maxTokens: 2800,
    workload: 72,
currentFocus: "�ƽ�Ա��ϵͳ������ϵͳ���������ջ���",
    successRate: 94
  },
  {
    id: "agent-market",
    name: "��Զ",
    department: "Marketing",
    title: "����Ӫ�� Agent",
    managerId: "agent-exec",
    model: "qwen-plus",
    prompt: "��������ѡ�⡢����ʵ�顢�����ַ���ת��������ơ�",
    toolPermissions: ["openai", "browser", "n8n"],
    status: "busy",
    agentRole: "worker",
    skills: ["content", "social", "campaigns", "positioning"],
    preferredModelPolicy: "creative_content",
    preferredProvider: "qwen",
    preferredModel: "qwen-plus",
    fallbackProvider: "gemini",
    fallbackModel: "gemini-3.1-flash",
    maxCostPerRun: 0.25,
    temperature: 0.7,
    maxTokens: 2200,
    workload: 81,
    currentFocus: "���һ�˹�˾ AI ����Ա������̨�����ݾ���",
    successRate: 88
  },
  {
    id: "agent-ops",
    name: "���",
    department: "Operations",
    title: "������Ӫ Agent",
    managerId: "agent-exec",
    model: "openai/gpt-5.5",
    prompt: "���� SOP��������·���Զ�����ƺ������嵥��",
    toolPermissions: ["openai", "supabase", "n8n", "browser", "email"],
    status: "online",
    agentRole: "worker",
    skills: ["delivery", "sop", "automation", "playbook"],
    preferredModelPolicy: "coding",
    preferredProvider: "codex_local",
    preferredModel: "openai/gpt-5.5",
    fallbackProvider: "deepseek",
    fallbackModel: "deepseek-v4-flash",
    maxCostPerRun: 0.35,
    temperature: 0.2,
    maxTokens: 2600,
    workload: 64,
    currentFocus: "������ؽ������Զ������̡�",
    successRate: 91
  },
  {
    id: "agent-finance",
    name: "����",
    department: "Finance",
    title: "������� Agent",
    managerId: "agent-exec",
    model: "deepseek-v4-pro",
    prompt: "����Ԥ�㡢��ͬ������ڵ�͸߷���������顣",
    toolPermissions: ["openai", "supabase"],
    status: "idle",
    agentRole: "reviewer",
    skills: ["finance", "approval", "review", "compliance"],
    preferredModelPolicy: "review_policy",
    preferredProvider: "deepseek",
    preferredModel: "deepseek-v4-pro",
    fallbackProvider: "qwen",
    fallbackModel: "qwen-max",
    maxCostPerRun: 0.3,
    temperature: 0.1,
    maxTokens: 2000,
    workload: 31,
    currentFocus: "��ס�������ر߽硣",
    successRate: 86
  },
  {
    id: "agent-product",
    name: "½��",
    department: "Product",
    title: "��Ʒ��� Agent",
    managerId: "agent-exec",
    model: "deepseek-v4-flash",
    prompt: "���������⡢ʵ�ּƻ����������պͷ�����顣",
    toolPermissions: ["openai", "supabase", "browser", "n8n"],
    status: "online",
    agentRole: "worker",
    skills: ["spec_breakdown", "ui_testing", "release_tracking", "implementation", "qa"],
    preferredModelPolicy: "coding",
    preferredProvider: "deepseek",
    preferredModel: "deepseek-v4-flash",
    fallbackProvider: "codex_local",
    fallbackModel: "openai/gpt-5.5",
    maxCostPerRun: 0.35,
    temperature: 0.2,
    maxTokens: 2600,
    workload: 58,
    currentFocus: "��Ա��ϵͳ�Ӹ����ƽ�����Ʒ����",
    successRate: 90
  }
];

export const projects: Project[] = [
  {
    id: "project-zlink-workbench",
    name: "ZLink AI ����Ա������̨",
    clientName: "�ڲ���Ŀ",
    objective: "����һ��һ�˹�˾��ֱ��ʹ�õ� AI Ա��ϵͳ����������Ա�������ܡ�ģ�ͺ������ջ���",
    clientProfile: "һ�˹�˾��ʼ�ˣ�ϣ�����ظ��Եľ�Ӫ���������ɿص� AI Ա����",
    progress: 78,
    stage: "employee-system",
    agentIds: ["agent-exec", "agent-product", "agent-ops", "agent-market", "agent-finance"],
    dueDate: "2026-06-28"
  },
  {
    id: "project-aurora",
    name: "Aurora �Զ�������",
    clientName: "Aurora Studio",
    objective: "�ؽ��ͻ��������̡�������·���Զ���֪ͨ��",
    clientProfile: "�������˾�����ӽ���͸���������ս��ࡣ",
    progress: 62,
    stage: "automation",
    agentIds: ["agent-exec", "agent-ops", "agent-finance"],
    dueDate: "2026-06-24"
  }
];

export const tasks: Task[] = [
  {
    id: "task-001",
    title: "���Ա��ϵͳ���ıջ�",
    description: "��ɼ��ܰ�װ״̬��Ա�����䡢ִ�м�¼���������ͱ��س־û���",
    taskType: "code",
    suggestedSkills: ["implementation-planning", "review-gate"],
    projectId: "project-zlink-workbench",
    assignedAgentId: "agent-product",
    priority: "urgent",
    riskLevel: "high",
    dueAt: "2026-06-14T18:00:00+08:00",
    status: "in_progress",
    boardStatus: "in_progress",
    approvalStatus: "pending",
    reviewStatus: "not_required",
    outputs: [
      {
        agentId: "agent-product",
        content: "����ɼ��ܿ⡢Ա�����ܾ���ͱ��س־û�������ơ�",
        createdAt: "2026-06-13T18:20:00+08:00"
      }
    ]
  },
  {
    id: "task-002",
    title: "�����������ݾ���",
    description: "Χ��һ�˹�˾ AI Ա��ϵͳ����һ������ѡ���������ַ����顣",
    taskType: "content",
    suggestedSkills: ["content-planning"],
    projectId: "project-zlink-workbench",
    assignedAgentId: "agent-market",
    priority: "high",
    riskLevel: "medium",
    dueAt: "2026-06-15T12:00:00+08:00",
    status: "todo",
    boardStatus: "todo",
    approvalStatus: "not_required",
    reviewStatus: "not_required",
    outputs: []
  },
  {
    id: "task-003",
    title: "��� Aurora ��ͬ����ڵ�",
    description: "�˶Կͻ���ͬ������������������Ͷ�������",
    taskType: "review",
    suggestedSkills: ["review-gate"],
    projectId: "project-aurora",
    assignedAgentId: "agent-finance",
    priority: "high",
    riskLevel: "critical",
    dueAt: "2026-06-16T17:00:00+08:00",
    status: "blocked",
    boardStatus: "blocked",
    approvalStatus: "pending",
    reviewStatus: "not_required",
    outputs: []
  },
  {
    id: "task-004",
    title: "��� Aurora �Զ�������",
    description: "�ѿͻ������������ webhook��֪ͨ����������д�Ķ����̡�",
    taskType: "automation",
    suggestedSkills: ["automation-dispatch", "goal-breakdown"],
    projectId: "project-aurora",
    assignedAgentId: "agent-ops",
    priority: "urgent",
    riskLevel: "high",
    dueAt: "2026-06-15T18:30:00+08:00",
    status: "review",
    boardStatus: "review",
    approvalStatus: "pending",
    reviewStatus: "pending",
    outputs: []
  }
];

export const memories: Memory[] = [
  {
    id: "memory-approval-rule",
    title: "�߷���������������",
    type: "sop",
    scope: "global",
    categoryId: "cat-sop",
    content: "�����漰�ⲿ��ŵ����ͬ�����Ԥ�㡢���ⷢ��������������������񣬱����Ƚ�����������",
    summary: "�߷���������������ִ�С�",
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
    id: "memory-skill-policy",
    title: "���ܰ�װ��������",
    type: "company",
    scope: "global",
    categoryId: "cat-company",
content: "���ܷ�Ϊ��ֱ�����á���������顢���������������߷��ռ��ܼ�ʹ��װҲ�����Զ�ִ���ⲿ������",
    summary: "�����ȷּ����پ����Ƿ񿪷Ÿ�Ա����",
    tags: ["skills", "policy"],
    importance: 4,
    confidence: 0.92,
    status: "approved",
    visibility: "owner",
    sourceType: "manual",
    createdAt: "2026-06-10T10:00:00+08:00",
    updatedAt: "2026-06-10T10:00:00+08:00"
  }
];

export const memoryCategories: MemoryCategory[] = [
  {
    id: "cat-sop",
    name: "SOP",
    type: "sop",
    description: "���̡��ƶȺͲ�������",
    sortOrder: 1,
    createdAt: "2026-06-09T08:00:00+08:00",
    updatedAt: "2026-06-09T08:00:00+08:00"
  },
  {
    id: "cat-company",
    name: "Company Policy",
    type: "company",
    description: "��˾���ԡ�ԭ��͹�ʶ��",
    sortOrder: 2,
    createdAt: "2026-06-09T08:00:00+08:00",
    updatedAt: "2026-06-09T08:00:00+08:00"
  }
];

export const memoryRelations: MemoryRelation[] = [
  {
    id: "memory-relation-001",
    memoryId: "memory-approval-rule",
    relatedType: "task",
    relatedId: "task-003",
    relationType: "supports",
    createdAt: "2026-06-13T09:00:00+08:00"
  }
];

export const memoryAccessLogs: MemoryAccessLog[] = [
  {
    id: "memory-log-001",
    memoryId: "memory-approval-rule",
    agentId: "agent-finance",
    taskId: "task-003",
    accessType: "retrieve",
    createdAt: "2026-06-13T17:05:00+08:00",
    memoryTitle: "�߷���������������",
    agentName: "����",
    taskTitle: "��� Aurora ��ͬ����ڵ�"
  }
];

export const knowledgeSources: KnowledgeSource[] = [
  {
    id: "source-github-skills",
    name: "GitHub Skill Sources",
    type: "url",
    sourceUrl: "https://github.com/openai/skills",
    syncMode: "manual",
    status: "active",
    lastSyncedAt: "2026-06-13T11:20:00+08:00",
    metadata: {
      purpose: "�ο��ⲿ���ܽṹ�밲װ��Դ"
    },
    createdAt: "2026-06-11T09:00:00+08:00",
    updatedAt: "2026-06-13T11:20:00+08:00"
  }
];

export const skills: Skill[] = [
  {
    id: "skill-goal-breakdown",
    name: "Goal Breakdown",
    slug: "goal-breakdown",
    category: "management",
description: "������Ŀ����ִ�н׶Ρ�������ϵ�ͼ��㡣",
    instructions: "����׶Ρ����ȼ���������ͽ����жϱ�׼��",
    inputSchema: { goal: "string", constraints: "string?" },
    outputSchema: { plan: "object" },
    riskLevel: "low",
    skillType: "knowledge",
    requiredTools: ["openai"],
    requiredMemoryTypes: ["company", "project"],
    approvalRequired: false,
    source: "custom",
    sourceUrl: null,
    license: "Internal",
    version: "0.1.0",
    enabled: true
  },
  {
    id: "skill-memory-capture",
    name: "Memory Capture",
    slug: "memory-capture",
    category: "memory",
    description: "�������еĹؼ����ۡ�����ͷ�������ɿɸ��ü��䡣",
    instructions: "��ȡ��ѡ���䣬����ע��Դ�����ŶȺ����÷�Χ��",
    inputSchema: { transcript: "string", task_context: "string?" },
    outputSchema: { memory_candidates: "MemoryDraft[]" },
    riskLevel: "medium",
    skillType: "knowledge",
    requiredTools: ["openai", "supabase"],
    requiredMemoryTypes: ["client", "project", "review"],
    approvalRequired: false,
    source: "custom",
    sourceUrl: null,
    license: "Internal",
    version: "0.1.0",
    enabled: true
  },
  {
    id: "skill-content-planning",
    name: "Content Planning",
    slug: "content-planning",
    category: "content",
    description: "Χ�Ʋ�Ʒ���ͻ��ͽ׶�Ŀ����������ѡ����ַ����顣",
    instructions: "���ѡ�⡢���ڡ�������ת��������ע�����",
    inputSchema: { topic: "string", audience: "string?" },
    outputSchema: { content_plan: "object" },
    riskLevel: "low",
    skillType: "knowledge",
    requiredTools: ["openai", "browser"],
    requiredMemoryTypes: ["client", "project"],
    approvalRequired: false,
    source: "github",
    sourceUrl: "https://github.com/openai/skills/tree/main/skills/.curated/notion-research-documentation",
    license: "See source repository",
    version: "import-draft",
    enabled: true
  },
  {
    id: "skill-seo-brief",
    name: "SEO Brief",
    slug: "seo-brief",
    category: "seo",
    description: "���� SEO ���� brief���ؼ��ʽṹ��ҳ�淽��",
    instructions: "����ؼ��ʴء�������ͼ��ҳ��ṹ���ڲ����ӽ��顣",
    inputSchema: { keyword: "string", market: "string?" },
    outputSchema: { seo_brief: "object" },
    riskLevel: "medium",
    skillType: "knowledge",
    requiredTools: ["openai", "browser"],
    requiredMemoryTypes: ["project"],
    approvalRequired: false,
    source: "imported",
    sourceUrl: "https://github.com/openai/skills/tree/main/skills/.curated/openai-docs",
    license: "license_review_required",
    version: "draft",
    enabled: false
  },
  {
    id: "skill-outbound-sales",
    name: "Outbound Sales Drafting",
    slug: "outbound-sales-drafting",
    category: "sales",
    description: "���������ݸ塢��������������жϽ��顣",
    instructions: "ֻ�����ݸ���жϽ��飬��ֱ�ӷ��͡�",
    inputSchema: { lead_profile: "string", offer: "string" },
    outputSchema: { drafts: "string[]" },
    riskLevel: "medium",
    skillType: "knowledge",
    requiredTools: ["openai", "email"],
    requiredMemoryTypes: ["client", "company"],
    approvalRequired: false,
    source: "custom",
    sourceUrl: null,
    license: "Internal",
    version: "0.1.0",
    enabled: true
  },
  {
    id: "skill-ads-analysis",
    name: "Ads Analysis",
    slug: "ads-analysis",
    category: "ads",
    description: "���������ֲ�����زġ��İ���Ԥ��۲�㡣",
    instructions: "������졢������򡢲��Ա�����Ԥ�����ѡ�",
    inputSchema: { metrics: "object", channel: "string" },
    outputSchema: { diagnosis: "object" },
    riskLevel: "medium",
    skillType: "knowledge",
    requiredTools: ["openai"],
    requiredMemoryTypes: ["project", "review"],
    approvalRequired: false,
    source: "custom",
    sourceUrl: null,
    license: "Internal",
    version: "0.1.0",
    enabled: true
  },
  {
    id: "skill-data-cleanup",
    name: "Data Cleanup",
    slug: "data-cleanup",
    category: "data",
    description: "�������ֶΡ��쳣ֵ�ͻ��������ھ���",
    instructions: "��ͳһ�ֶΣ���˵���쳣��ȱʧ�Ϳ�ִ�н��ۡ�",
    inputSchema: { dataset: "table", objective: "string" },
    outputSchema: { cleaned_summary: "object" },
    riskLevel: "low",
    skillType: "knowledge",
    requiredTools: ["openai", "supabase"],
    requiredMemoryTypes: ["project"],
    approvalRequired: false,
    source: "custom",
    sourceUrl: null,
    license: "Internal",
    version: "0.1.0",
    enabled: true
  },
  {
    id: "skill-implementation-planning",
    name: "Implementation Planning",
    slug: "implementation-planning",
    category: "code",
    description: "�ѹ����ʵ��������֤��ͷ�������",
    instructions: "���ʵ�ֲ��衢��֤��ʽ��������ع����ǡ�",
    inputSchema: { spec: "string", codebase_context: "string?" },
    outputSchema: { implementation_plan: "object" },
    riskLevel: "medium",
    skillType: "knowledge",
    requiredTools: ["openai", "browser"],
    requiredMemoryTypes: ["project", "sop"],
    approvalRequired: false,
    source: "github",
    sourceUrl: "https://github.com/openai/skills/tree/main/skills/.curated/playwright",
    license: "See source repository",
    version: "import-draft",
    enabled: true
  },
  {
    id: "skill-automation-dispatch",
    name: "Automation Dispatch",
    slug: "automation-dispatch",
    category: "automation",
    description: "Ϊ�����Զ������ɽڵ���ơ�������ϵ������������",
    instructions: "ֻ����Զ��������������������ֱ��ִ���ⲿ������",
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
    version: "0.1.0",
    enabled: false
  },
  {
    id: "skill-review-gate",
    name: "Review Gate",
    slug: "review-gate",
    category: "review",
    description: "�Ը߷��������ⲿ���ܺ͹ؼ��������ṹ����顣",
    instructions: "����Ƿ�ͨ�����ؼ����ݡ�ȱʧ�����ͽ��鶯����",
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
    version: "0.1.0",
    enabled: true
  }
];

export const agentSkills: AgentSkill[] = [
  { id: "agent-skill-1", agentId: "agent-exec", skillId: "skill-goal-breakdown", priority: "primary", enabled: true },
  { id: "agent-skill-2", agentId: "agent-exec", skillId: "skill-review-gate", priority: "primary", enabled: true },
  { id: "agent-skill-3", agentId: "agent-exec", skillId: "skill-memory-capture", priority: "secondary", enabled: true },
  { id: "agent-skill-4", agentId: "agent-market", skillId: "skill-content-planning", priority: "primary", enabled: true },
  { id: "agent-skill-5", agentId: "agent-market", skillId: "skill-ads-analysis", priority: "secondary", enabled: true },
  { id: "agent-skill-6", agentId: "agent-market", skillId: "skill-seo-brief", priority: "optional", enabled: false },
  { id: "agent-skill-7", agentId: "agent-ops", skillId: "skill-implementation-planning", priority: "primary", enabled: true },
  { id: "agent-skill-8", agentId: "agent-ops", skillId: "skill-automation-dispatch", priority: "secondary", enabled: false },
  { id: "agent-skill-9", agentId: "agent-ops", skillId: "skill-memory-capture", priority: "optional", enabled: true },
  { id: "agent-skill-10", agentId: "agent-finance", skillId: "skill-review-gate", priority: "primary", enabled: true },
  { id: "agent-skill-11", agentId: "agent-finance", skillId: "skill-outbound-sales", priority: "optional", enabled: false },
  { id: "agent-skill-12", agentId: "agent-product", skillId: "skill-implementation-planning", priority: "primary", enabled: true },
  { id: "agent-skill-13", agentId: "agent-product", skillId: "skill-data-cleanup", priority: "secondary", enabled: true },
  { id: "agent-skill-14", agentId: "agent-product", skillId: "skill-review-gate", priority: "optional", enabled: true }
];

export const skillRuns: SkillRun[] = [
  {
    id: "skill-run-001",
    skillId: "skill-goal-breakdown",
    agentId: "agent-exec",
    taskId: "task-001",
    agentRunId: "agent-run-demo-001",
    modelRunId: "model-run-demo-001",
    status: "success",
    input: { goal: "���Ա��ϵͳ���ıջ�" },
    output: { summary: "�Ѳ�ɼ��ܡ�Ա����ִ�С������Ķ����·����" },
    latencyMs: 912,
    createdAt: "2026-06-13T19:32:00+08:00"
  },
  {
    id: "skill-run-002",
    skillId: "skill-review-gate",
    agentId: "agent-finance",
    taskId: "task-003",
    agentRunId: "agent-run-demo-002",
    modelRunId: "model-run-demo-002",
    status: "pending_approval",
    input: { artifact: "Aurora ��ͬ����ڵ�" },
    output: null,
    error: "High-risk review requires owner approval.",
    latencyMs: 640,
    createdAt: "2026-06-13T17:08:00+08:00"
  }
];

export const skillReviews: SkillReview[] = [
  {
    id: "skill-review-001",
    skillId: "skill-seo-brief",
    reviewStatus: "pending",
    riskNotes: "Imported SEO skill still needs license confirmation.",
    createdAt: "2026-06-13T10:00:00+08:00"
  },
  {
    id: "skill-review-002",
    skillId: "skill-automation-dispatch",
    reviewStatus: "approved",
    riskNotes: "Must remain approval-gated and cannot execute external actions automatically.",
    reviewedBy: "owner",
    reviewedAt: "2026-06-13T11:20:00+08:00",
    createdAt: "2026-06-13T09:40:00+08:00"
  }
];

export const meetings: Meeting[] = [
  {
    id: "meeting-001",
    topic: "Ա��ϵͳ��������",
    hostAgentId: "agent-exec",
    participantAgentIds: ["agent-product", "agent-ops", "agent-finance"],
conclusion: "�Ȳ��뱾�ؿ��ñջ����ٴ������ӽ�ѹ�����񡢼��ܺ�����·����",
    actionItems: ["��Ʒ Agent ���Ա�����ܾ���", "��Ӫ Agent ���ֱ��س־û�", "���� Agent ��˸߷��ռ��ܲ���"],
    createdAt: "2026-06-13T11:00:00+08:00"
  }
];

export const dailyReport: DailyReport = {
  id: "report-2026-06-13",
  reportDate: "2026-06-13",
  summary: "�����ص��ƽ�Ա��ϵͳ��Ʒ��������Ŀ�����ü��ܡ�Ա��������������γ���ʵ�ջ���",
  wins: ["���ܿ���Ա�������ѳ���", "�����˼��ܵ��뱨��������ĵ�", "ģ�ͽ���߱� DeepSeek �� Qwen ͨ��"],
  risks: ["��ʷ��������Ӱ�첿��ҳ����ʾ", "���ھɵı�������������Ҫ����"],
nextActions: ["ͳһ D ������Ŀ", "��ɱ��س־û�", "�������ӽ���ͨ��������"]
};
