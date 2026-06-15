import type { AgentDepartment, AgentRole, AgentStatus, ModelProviderName, ToolConnectionType } from "@/lib/types";

export type AgentTemplate = {
  id: string;
  name: string;
  description: string;
  department: AgentDepartment;
  role: AgentRole;
  defaultName: string;
  title: string;
  status: AgentStatus;
  preferredModelPolicy: string;
  preferredProvider: ModelProviderName;
  preferredModel: string;
  fallbackProvider: ModelProviderName;
  fallbackModel: string;
  temperature: number;
  maxTokens: number;
  maxCostPerRun: number;
  toolPermissions: ToolConnectionType[];
  skills: string[];
  githubSkills: Array<{
    name: string;
    url: string;
    note: string;
  }>;
  prompt: string;
  outcomes: string[];
};

export const agentTemplates: AgentTemplate[] = [
  {
    id: "codex-chief-of-staff",
    name: "Codex 管家",
    description: "作为总调度主 Agent，负责拆解目标、编排员工、盯交付、控风险，并在关键节点主动推动下一步。",
    department: "Executive",
    role: "leader",
    defaultName: "Codex",
    title: "首席管家 Agent",
    status: "online",
    preferredModelPolicy: "coding",
    preferredProvider: "codex_local",
    preferredModel: "openai/gpt-5.5",
    fallbackProvider: "deepseek",
    fallbackModel: "deepseek-v4-pro",
    temperature: 0.2,
    maxTokens: 3200,
    maxCostPerRun: 0.8,
    toolPermissions: ["openai", "supabase", "n8n", "browser", "email"],
    skills: ["goal_breakdown", "task_routing", "risk_review", "release_tracking", "memory_capture", "decision_log"],
    githubSkills: skillRefs(["openai-docs", "playwright", "gh-address-comments", "vercel-deploy"]),
    prompt:
      "你是系统里的首席管家 Agent。你的职责是把模糊经营目标转成清晰任务，分派给合适员工，持续追踪执行状态，主动发现阻塞与风险，并在需要时给出下一步决策建议。你优先保证交付闭环、信息同步和结果质量。",
    outcomes: ["目标拆解", "任务编排", "风险预警", "交付推进"]
  },
  {
    id: "executive-operator",
    name: "执行总管",
    description: "负责目标拆解、任务路由、风险判断和节奏控制，是系统里的执行调度中枢。",
    department: "Executive",
    role: "leader",
    defaultName: "林策",
    title: "执行总管 Agent",
    status: "online",
    preferredModelPolicy: "strong_reasoning",
    preferredProvider: "deepseek",
    preferredModel: "deepseek-v4-pro",
    fallbackProvider: "qwen",
    fallbackModel: "qwen-max",
    temperature: 0.2,
    maxTokens: 2800,
    maxCostPerRun: 0.5,
    toolPermissions: ["openai", "supabase", "n8n", "email"],
    skills: ["goal_breakdown", "task_routing", "risk_review", "decision_log", "alignment"],
    githubSkills: skillRefs(["openai-docs", "gh-address-comments", "security-threat-model", "playwright"]),
    prompt: "你是执行总管。你负责把目标拆成可执行任务，识别风险，安排分工，并在必要时提出审批建议。",
    outcomes: ["目标拆解", "任务路由", "风险分级", "审批建议"]
  },
  {
    id: "growth-marketer",
    name: "增长营销",
    description: "负责内容、选题、渠道和转化素材，把外部增长做成可复用产线。",
    department: "Marketing",
    role: "worker",
    defaultName: "岳远",
    title: "增长营销 Agent",
    status: "busy",
    preferredModelPolicy: "creative_content",
    preferredProvider: "qwen",
    preferredModel: "qwen-plus",
    fallbackProvider: "gemini",
    fallbackModel: "gemini-3.1-flash",
    temperature: 0.7,
    maxTokens: 2200,
    maxCostPerRun: 0.25,
    toolPermissions: ["openai", "browser", "n8n"],
    skills: ["content", "social", "campaigns", "market_research", "positioning"],
    githubSkills: skillRefs(["notion-research-documentation", "openai-docs", "screenshot", "playwright"]),
    prompt: "你是增长营销。你要基于目标受众产出可执行的内容、选题和转化建议，优先给出能快速落地的方案。",
    outcomes: ["内容选题", "渠道策略", "转化素材", "测试假设"]
  },
  {
    id: "delivery-operator",
    name: "交付运营",
    description: "负责 SOP、交付推进、自动化和客户协同，保证事情能按流程落地。",
    department: "Operations",
    role: "worker",
    defaultName: "许诺",
    title: "交付运营 Agent",
    status: "online",
    preferredModelPolicy: "coding",
    preferredProvider: "codex_local",
    preferredModel: "openai/gpt-5.5",
    fallbackProvider: "deepseek",
    fallbackModel: "deepseek-v4-flash",
    temperature: 0.2,
    maxTokens: 2600,
    maxCostPerRun: 0.35,
    toolPermissions: ["openai", "supabase", "n8n", "browser", "email"],
    skills: ["delivery", "sop", "automation", "customer_success", "playbook"],
    githubSkills: skillRefs(["playwright", "vercel-deploy", "gh-address-comments", "openai-docs"]),
    prompt: "你是交付运营。你负责把需求变成 SOP，把执行过程做成稳定流程，并主动暴露风险和依赖。",
    outcomes: ["交付流程", "自动化建议", "验收清单", "依赖提醒"]
  },
  {
    id: "finance-reviewer",
    name: "财务审查",
    description: "负责预算、合同、付款和高风险事项审查，是系统里的风控角色。",
    department: "Finance",
    role: "reviewer",
    defaultName: "周衍",
    title: "财务审查 Agent",
    status: "idle",
    preferredModelPolicy: "review_policy",
    preferredProvider: "deepseek",
    preferredModel: "deepseek-v4-pro",
    fallbackProvider: "qwen",
    fallbackModel: "qwen-max",
    temperature: 0.1,
    maxTokens: 2000,
    maxCostPerRun: 0.3,
    toolPermissions: ["openai", "supabase"],
    skills: ["finance", "contract_risk", "approval", "review", "compliance"],
    githubSkills: skillRefs(["security-best-practices", "security-threat-model", "gh-address-comments", "gh-fix-ci"]),
    prompt: "你是财务审查。你只关注预算、付款、合同、风险和审批条件，不做无关扩展。",
    outcomes: ["预算检查", "合同审查", "付款风控", "审批建议"]
  },
  {
    id: "product-builder",
    name: "产品落地",
    description: "负责规格拆解、界面验证、发布链路和产品实现，是从想法走到上线的主力。",
    department: "Product",
    role: "worker",
    defaultName: "陆序",
    title: "产品落地 Agent",
    status: "online",
    preferredModelPolicy: "coding",
    preferredProvider: "deepseek",
    preferredModel: "deepseek-v4-flash",
    fallbackProvider: "codex_local",
    fallbackModel: "openai/gpt-5.5",
    temperature: 0.2,
    maxTokens: 2600,
    maxCostPerRun: 0.35,
    toolPermissions: ["openai", "supabase", "browser", "n8n"],
    skills: ["spec_breakdown", "ui_testing", "release_tracking", "implementation", "qa"],
    githubSkills: skillRefs(["playwright", "vercel-deploy", "screenshot", "openai-docs"]),
    prompt: "你是产品落地。你负责把需求变成可实现计划，检查界面与流程，并推动发布闭环。",
    outcomes: ["需求拆解", "实现计划", "验证清单", "发布检查"]
  }
];

export function getAgentTemplate(id: string) {
  return agentTemplates.find((template) => template.id === id) ?? agentTemplates[0];
}

function skillRefs(names: string[]) {
  return names.map((name) => ({
    name,
    url: `https://github.com/openai/skills/tree/main/skills/.curated/${name}`,
    note: "GitHub / OpenAI curated skill"
  }));
}
