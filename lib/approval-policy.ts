import type { ApprovalLevel } from "@/lib/types";

type PolicySubject = Record<string, unknown>;

export type ApprovalDecision = {
  level: ApprovalLevel;
  reasons: string[];
};

const LEVEL_WEIGHT: Record<ApprovalLevel, number> = { L0: 0, L1: 1, L2: 2, L3: 3 };
const L3_PATTERN =
  /(退款|refund|转账|transfer\s+(funds?|money)|账户授权|账号授权|权限变更|authorization\s+change|credential|密钥|密码|修改.{0,8}熔断|预算熔断|budget\s+fuse|超.{0,8}(预算|限额)|exceed.{0,12}(budget|limit)|删除.{0,6}(账户|账号)|delete\s+account)/i;
const L2_PATTERN =
  /(发布|发帖|上线|publish|post\s+(content|video|article)|send\s+(email|message)|发邮件|发送邮件|外联|outreach|广告.{0,8}(创建|新建|投放|上线|加预算)|create.{0,8}(ad|campaign)|launch.{0,8}(ad|campaign)|increase.{0,8}budget|加预算|放量|scale.{0,8}(ad|campaign|budget)|调价|改价|change.{0,8}price|付款|支付|下单|place.{0,8}order|改进提案|improvement\s+proposal|客户.{0,8}(回复|消息|交付))/i;
const L1_PATTERN =
  /(评论回复|回复评论|comment\s+repl|暂停广告|pause.{0,8}(ad|campaign)|杀品|kill.{0,8}product|下架商品|降预算|decrease.{0,8}budget|规则内.{0,8}(调整|降预算))/i;
const OWN_ACCOUNT_PUBLISH_PATTERN =
  /((自有|自营|owned).{0,12}(账号|账户|account).{0,12}(发布|发帖|publish|post)|(发布|发帖|publish|post).{0,12}(自有|自营|owned).{0,12}(账号|账户|account))/i;
const PLANNING_PATTERN = /(草稿|初稿|计划|方案|策略|排期|建议|分析|报告|复盘|draft|plan|strategy|schedule|analysis|report|review)/i;
const EXECUTION_CUE_PATTERN = /(执行|直接|立即|正式|实际|自动|调用.{0,8}(api|接口)|execute|immediately|production|via\s+api)/i;
const NO_EXECUTION_PATTERN = /(不得|不可|不会|禁止|仅生成|只生成|不直接|不要执行|do\s+not|never)/i;

export function normalizeApprovalLevel(value: unknown): ApprovalLevel {
  const normalized = String(value ?? "").toUpperCase();
  return normalized === "L1" || normalized === "L2" || normalized === "L3" ? normalized : "L0";
}

export function maxApprovalLevel(...levels: ApprovalLevel[]): ApprovalLevel {
  return levels.reduce<ApprovalLevel>(
    (highest, level) => (LEVEL_WEIGHT[level] > LEVEL_WEIGHT[highest] ? level : highest),
    "L0"
  );
}

export function classifyApproval(subject: PolicySubject): ApprovalDecision {
  const reasons: string[] = [];
  let level = normalizeApprovalLevel(subject.approval_level ?? subject.approvalLevel);
  if (level !== "L0") reasons.push(`显式策略要求 ${level}`);

  const text = policyText(subject);
  const riskLevel = String(subject.risk_level ?? subject.riskLevel ?? "low").toLowerCase();
  const skillType = String(subject.skill_type ?? subject.skillType ?? "").toLowerCase();
  const approvalRequired = Boolean(subject.approval_required ?? subject.approvalRequired);
  const isSkillSubject = Boolean(subject.slug || subject.skill_type || subject.skillType);

  if (L3_PATTERN.test(text) || (!isSkillSubject && riskLevel === "critical")) {
    level = maxApprovalLevel(level, "L3");
    reasons.push(L3_PATTERN.test(text) ? "命中禁止自动执行的资金、授权或熔断动作" : "关键风险事项只能人工执行");
  }

  const planningOnly =
    PLANNING_PATTERN.test(text) && (!EXECUTION_CUE_PATTERN.test(text) || NO_EXECUTION_PATTERN.test(text));
  if (!planningOnly && OWN_ACCOUNT_PUBLISH_PATTERN.test(text)) {
    level = maxApprovalLevel(level, "L1");
    reasons.push("自有账号常规发布属于事后通知动作");
  } else if (!planningOnly && L2_PATTERN.test(text)) {
    level = maxApprovalLevel(level, "L2");
    reasons.push("命中发布、对外沟通、广告、付款或价格变更动作");
  }

  if (L1_PATTERN.test(text)) {
    level = maxApprovalLevel(level, "L1");
    reasons.push("命中可撤回或规则内调整动作");
  }
  if (skillType === "action") {
    level = maxApprovalLevel(level, "L1");
    reasons.push("动作型 Skill 至少需要事后通知");
  }
  if (!isSkillSubject && (approvalRequired || riskLevel === "high")) {
    level = maxApprovalLevel(level, "L2");
    reasons.push(approvalRequired ? "资产配置要求事前审批" : "高风险事项要求事前审批");
  }

  return { level, reasons: Array.from(new Set(reasons)) };
}

export function classifyTaskApproval(task: PolicySubject, skills: PolicySubject[] = []): ApprovalDecision {
  const decisions = [classifyApproval(task), ...skills.map(classifyApproval)];
  return {
    level: maxApprovalLevel(...decisions.map((decision) => decision.level)),
    reasons: Array.from(new Set(decisions.filter((decision) => decision.level !== "L0").flatMap((decision) => decision.reasons)))
  };
}

export function assertTaskExecutionAllowed(task: PolicySubject, skills: PolicySubject[] = []) {
  const decision = classifyTaskApproval(task, skills);
  const status = String(task.approval_status ?? task.approvalStatus ?? "not_required");
  if (decision.level === "L3") {
    throw new Error(`L3 action is manual-only and cannot be executed by an Agent. ${decision.reasons.join("；")}`);
  }
  if (decision.level === "L2" && status !== "approved") {
    throw new Error(`L2 action requires owner approval before execution. ${decision.reasons.join("；")}`);
  }
  return decision;
}

export function taskApprovalState(decision: ApprovalDecision) {
  if (decision.level === "L3") {
    return {
      approval_level: decision.level,
      approval_required: true,
      approval_status: "manual_only",
      status: "blocked",
      board_status: "blocked"
    } as const;
  }
  if (decision.level === "L2") {
    return {
      approval_level: decision.level,
      approval_required: true,
      approval_status: "pending",
      status: "waiting_boss_approval",
      board_status: "waiting_boss_approval"
    } as const;
  }
  return {
    approval_level: decision.level,
    approval_required: false,
    approval_status: "not_required",
    status: "todo",
    board_status: "todo"
  } as const;
}

function policyText(subject: PolicySubject) {
  return [
    subject.slug,
    subject.name,
    subject.title,
    subject.description,
    subject.instructions,
    subject.category,
    subject.task_type,
    subject.taskType,
    subject.action_type,
    subject.actionType,
    ...(Array.isArray(subject.required_tools) ? subject.required_tools : []),
    ...(Array.isArray(subject.requiredTools) ? subject.requiredTools : []),
    ...(Array.isArray(subject.suggested_skills) ? subject.suggested_skills : []),
    ...(Array.isArray(subject.suggestedSkills) ? subject.suggestedSkills : [])
  ]
    .filter(Boolean)
    .join(" ");
}
