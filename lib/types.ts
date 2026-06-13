export type AgentStatus = "online" | "busy" | "idle" | "offline";
export type AgentDepartment =
  | "Executive"
  | "Marketing"
  | "Sales"
  | "Product"
  | "Operations"
  | "Finance"
  | "Legal"
  | "Support";

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type ApprovalStatus = "not_required" | "pending" | "approved" | "rejected";
export type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "blocked" | "done" | "cancelled";
export type BoardStatus = "backlog" | "todo" | "in_progress" | "review" | "done" | "blocked";
export type ReviewStatus = "not_required" | "pending" | "approved" | "rejected";
export type AgentRole = "leader" | "worker" | "reviewer";
export type TaskLogType = "thinking" | "action" | "tool_call" | "result" | "error" | "review" | "approval";
export type RunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type MemoryType = "company" | "client" | "project" | "agent" | "sop" | "review";
export type MemoryCategoryType = MemoryType | "source";
export type MemoryScope = "global" | "client" | "project" | "agent";
export type MemoryStatus = "draft" | "pending_review" | "approved" | "rejected" | "archived";
export type MemorySourceType = "manual" | "upload" | "task" | "meeting" | "file" | "email" | "agent_run" | "wps" | "kdocs" | "notion" | "google_drive";
export type MemoryAccessType = "retrieve" | "create" | "update" | "approve" | "reject" | "archive";
export type MemoryReviewStatus = "pending" | "approved" | "rejected";
export type MemoryRelationType = "created_from" | "used_by" | "belongs_to" | "supports" | "conflicts_with";
export type MemoryRelatedType = "task" | "project" | "agent" | "meeting" | "file" | "source";
export type KnowledgeSourceType = "manual" | "upload" | "wps" | "kdocs" | "notion" | "google_drive" | "feishu" | "url";
export type KnowledgeSourceSyncMode = "manual" | "scheduled" | "webhook";
export type KnowledgeSourceStatus = "active" | "paused" | "error";
export type ToolConnectionType = "openai" | "supabase" | "n8n" | "browser" | "email" | "crm";
export type ModelProviderName =
  | "openai"
  | "codex_local"
  | "manual_bridge"
  | "openrouter"
  | "litellm"
  | "anthropic"
  | "gemini"
  | "deepseek"
  | "qwen"
  | "kimi";
export type ModelProviderStatus = "configured" | "missing_key" | "disabled" | "error";
export type ModelCatalogCapability = "chat" | "json" | "tools" | "vision" | "embedding" | "long_context";
export type ModelRunStatus = "success" | "error" | "fallback" | "succeeded" | "failed";

export type Agent = {
  id: string;
  name: string;
  department: AgentDepartment;
  title: string;
  managerId?: string | null;
  model: string;
  prompt: string;
  toolPermissions: ToolConnectionType[];
  status: AgentStatus;
  agentRole?: AgentRole;
  skills?: string[];
  workload?: number;
  modelPolicyId?: string | null;
  preferredModelPolicy?: string | null;
  preferredProvider?: ModelProviderName | null;
  preferredModel?: string | null;
  fallbackProvider?: ModelProviderName | null;
  fallbackModel?: string | null;
  maxCostPerRun?: number | null;
  temperature?: number | null;
  maxTokens?: number | null;
  currentFocus?: string;
  successRate: number;
};

export type Project = {
  id: string;
  name: string;
  clientName: string;
  objective: string;
  clientProfile: string;
  progress: number;
  stage: string;
  agentIds: string[];
  dueDate?: string;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  taskType?: string;
  clientName?: string | null;
  projectId?: string | null;
  assignedAgentId?: string | null;
  priority: TaskPriority;
  riskLevel: RiskLevel;
  dueAt?: string | null;
  status: TaskStatus;
  boardStatus?: BoardStatus;
  approvalStatus: ApprovalStatus;
  reviewStatus?: ReviewStatus;
  estimatedCost?: number;
  actualCost?: number;
  parentTaskId?: string | null;
  sortOrder?: number;
  usedMemoryIds?: string[];
  modelRun?: ModelRunSummary | null;
  outputs: TaskOutput[];
};

export type TaskOutput = {
  agentId: string;
  content: string;
  createdAt: string;
};

export type TaskLog = {
  id: string;
  taskId: string;
  agentId?: string | null;
  runId?: string | null;
  type: TaskLogType;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type AgentRun = {
  id: string;
  taskId?: string | null;
  agentId?: string | null;
  status: RunStatus;
  model?: string | null;
  promptTokens: number;
  completionTokens: number;
  cost: number;
  error?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
};

export type QualityReview = {
  id: string;
  taskId: string;
  reviewerAgentId?: string | null;
  status: ReviewStatus;
  score?: number | null;
  checklist: Array<{ label: string; passed: boolean }>;
  notes?: string | null;
  createdAt: string;
  decidedAt?: string | null;
};

export type Memory = {
  id: string;
  title: string;
  type: MemoryType;
  scope?: MemoryScope;
  categoryId?: string | null;
  content: string;
  summary?: string | null;
  tags: string[];
  relatedClient?: string | null;
  clientName?: string | null;
  projectId?: string | null;
  agentId?: string | null;
  importance?: number;
  confidence?: number;
  status?: MemoryStatus;
  visibility?: string;
  sourceType?: MemorySourceType;
  sourceId?: string | null;
  sourceUrl?: string | null;
  createdBy?: string | null;
  approvedBy?: string | null;
  lastAccessedAt?: string | null;
  createdAt?: string;
  updatedAt: string;
};

export type MemoryCategory = {
  id: string;
  name: string;
  type: MemoryCategoryType;
  parentId?: string | null;
  description?: string | null;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

export type MemoryRelation = {
  id: string;
  memoryId: string;
  relatedType: MemoryRelatedType;
  relatedId: string;
  relationType: MemoryRelationType;
  createdAt: string;
};

export type MemoryAccessLog = {
  id: string;
  memoryId?: string | null;
  agentId?: string | null;
  taskId?: string | null;
  accessType: MemoryAccessType;
  createdAt: string;
  memoryTitle?: string | null;
  agentName?: string | null;
  taskTitle?: string | null;
};

export type KnowledgeSource = {
  id: string;
  name: string;
  type: KnowledgeSourceType;
  sourceUrl?: string | null;
  syncMode: KnowledgeSourceSyncMode;
  status: KnowledgeSourceStatus;
  lastSyncedAt?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export type MemoryReviewQueueItem = {
  id: string;
  memoryId: string;
  proposedByAgentId?: string | null;
  reason: string;
  riskLevel: RiskLevel;
  reviewStatus: MemoryReviewStatus;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  memory?: Memory;
};

export type ModelPolicy = {
  id?: string;
  name: string;
  description?: string | null;
  agentRole?: AgentRole | null;
  taskType?: string | null;
  riskLevel?: RiskLevel | null;
  primaryProvider: ModelProviderName;
  primaryModel: string;
  fallbackProvider?: ModelProviderName | null;
  fallbackModel?: string | null;
  temperature: number;
  maxTokens: number;
  costLevel: "low" | "medium" | "high";
  enabled: boolean;
};

export type ModelProvider = {
  id?: string;
  name: ModelProviderName;
  displayName: string;
  baseUrl?: string | null;
  apiKeyEnv: string;
  enabled: boolean;
  status: ModelProviderStatus;
  notes?: string | null;
  lastCheckedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ModelCatalogItem = {
  id?: string;
  provider: ModelProviderName;
  model: string;
  displayName: string;
  contextWindow?: number | null;
  inputCostPer1m?: number | null;
  outputCostPer1m?: number | null;
  capabilities: ModelCatalogCapability[];
  recommendedUse: string[];
  enabled: boolean;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ModelRunSummary = {
  id?: string;
  provider: string;
  model: string;
  agentRunId?: string | null;
  taskId?: string | null;
  agentId?: string | null;
  policyName?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost?: number;
  latencyMs?: number;
  status?: ModelRunStatus | string;
  error?: string | null;
  createdAt?: string;
};

export type Meeting = {
  id: string;
  topic: string;
  hostAgentId: string;
  participantAgentIds: string[];
  conclusion: string;
  actionItems: string[];
  createdAt: string;
};

export type DailyReport = {
  id: string;
  reportDate: string;
  summary: string;
  wins: string[];
  risks: string[];
  nextActions: string[];
};
