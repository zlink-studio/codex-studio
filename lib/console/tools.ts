import type Anthropic from "@anthropic-ai/sdk";
import { isAnthropicConfigured } from "@/lib/llm/anthropic-client";
import { isCodexLocalConfigured } from "@/lib/llm/providers/codex-local";
import { readCollection } from "@/lib/local-store";
import { getRuntimeMode } from "@/lib/runtime";
import {
  createProjectFromGoal,
  createTasksForProject,
  getOwnerInbox,
  getProjectDetail,
  runNextTaskForProject
} from "@/lib/workflow-engine";

// Tools the console's Claude can call. They wrap the same workflow functions the
// UI uses, so approval gates (L0–L3) and logging apply unchanged. Nothing here
// touches the filesystem or the outside world directly.

type Row = Record<string, any>;
type ToolInput = Record<string, unknown>;

type ConsoleTool = {
  definition: Anthropic.Beta.BetaTool;
  // Returns a validation error message, or null when the input is usable.
  validate: (input: ToolInput) => string | null;
  run: (input: ToolInput) => Promise<unknown>;
};

const MAX_RESULT_CHARS = 12000;

function str(input: ToolInput, key: string) {
  const value = input[key];
  return typeof value === "string" ? value.trim() : "";
}

function limitOf(input: ToolInput, fallback: number, max: number) {
  const value = Number(input.limit);
  return Number.isFinite(value) && value > 0 ? Math.min(Math.floor(value), max) : fallback;
}

function requireString(key: string) {
  return (input: ToolInput) => (str(input, key) ? null : `${key} is required and must be a non-empty string`);
}

function summarizeTask(task: Row) {
  return {
    id: task.id,
    project_id: task.project_id ?? task.projectId ?? null,
    title: task.title,
    status: task.status ?? task.board_status,
    priority: task.priority,
    risk_level: task.risk_level ?? task.riskLevel,
    approval_level: task.approval_level ?? null,
    approval_status: task.approval_status ?? task.approvalStatus ?? null,
    assigned_agent_role: task.assigned_agent_role ?? null,
    model_policy: task.model_policy ?? null,
    updated_at: task.updated_at ?? task.updatedAt ?? null
  };
}

function summarizeProject(project: Row) {
  return {
    id: project.id,
    name: project.name,
    client_name: project.client_name,
    objective: project.objective,
    stage: project.stage,
    progress: project.progress,
    risk_level: project.risk_level,
    due_date: project.due_date ?? null,
    updated_at: project.updated_at ?? null
  };
}

const tools: Record<string, ConsoleTool> = {
  get_system_status: {
    definition: {
      name: "get_system_status",
      description:
        "Report the workbench's runtime mode (database / demo / setup_required) and which model providers are configured. Call this first when the user asks why something does not work.",
      input_schema: { type: "object", properties: {}, additionalProperties: false }
    },
    validate: () => null,
    run: async () => ({
      runtime_mode: getRuntimeMode(),
      providers: {
        anthropic: isAnthropicConfigured(),
        openai: Boolean(process.env.OPENAI_API_KEY),
        codex_local: isCodexLocalConfigured(),
        gemini: Boolean(process.env.GEMINI_API_KEY),
        deepseek: Boolean(process.env.DEEPSEEK_API_KEY),
        qwen: Boolean(process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY),
        manual_bridge: process.env.LLM_NO_KEY_MODE === "manual_bridge"
      },
      supabase_configured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
    })
  },

  list_projects: {
    definition: {
      name: "list_projects",
      description: "List projects in the workbench, most recently updated first.",
      input_schema: {
        type: "object",
        properties: { limit: { type: "integer", description: "Max projects to return (default 20, max 50)." } },
        additionalProperties: false
      }
    },
    validate: () => null,
    run: async (input) => {
      const projects = await readCollection<Row>("projects");
      return projects
        .sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")))
        .slice(0, limitOf(input, 20, 50))
        .map(summarizeProject);
    }
  },

  get_project: {
    definition: {
      name: "get_project",
      description: "Get one project's detail: brief, tasks, recent logs and deliverables.",
      input_schema: {
        type: "object",
        properties: { project_id: { type: "string", description: "Project id from list_projects." } },
        required: ["project_id"],
        additionalProperties: false
      }
    },
    validate: requireString("project_id"),
    run: async (input) => getProjectDetail(str(input, "project_id"))
  },

  list_tasks: {
    definition: {
      name: "list_tasks",
      description: "List tasks, optionally filtered by project and/or status.",
      input_schema: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "Only tasks of this project." },
          status: {
            type: "string",
            description: "Only tasks in this status, e.g. todo, in_progress, review, done, blocked, waiting_boss_approval."
          },
          limit: { type: "integer", description: "Max tasks to return (default 30, max 100)." }
        },
        additionalProperties: false
      }
    },
    validate: () => null,
    run: async (input) => {
      const projectId = str(input, "project_id");
      const status = str(input, "status");
      const tasks = await readCollection<Row>("tasks");
      return tasks
        .filter((task) => !projectId || (task.project_id ?? task.projectId) === projectId)
        .filter((task) => !status || (task.status ?? task.board_status) === status)
        .sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")))
        .slice(0, limitOf(input, 30, 100))
        .map(summarizeTask);
    }
  },

  get_owner_inbox: {
    definition: {
      name: "get_owner_inbox",
      description: "Get what needs the owner's attention: pending approvals, blocked tasks, high-risk items, today's completed work and recent deliverables.",
      input_schema: { type: "object", properties: {}, additionalProperties: false }
    },
    validate: () => null,
    run: async () => {
      const inbox = await getOwnerInbox();
      return {
        pending_approvals: inbox.pendingApprovals.map(summarizeTask),
        blocked_tasks: inbox.blockedTasks.map(summarizeTask),
        high_risk_items: inbox.highRiskItems.map(summarizeTask),
        today_done: inbox.todayDone.map(summarizeTask),
        recent_deliverables: inbox.recentDeliverables.map((item) => ({
          id: item.id,
          title: item.title,
          project: item.projectName,
          created_at: item.createdAt
        }))
      };
    }
  },

  create_project_from_goal: {
    definition: {
      name: "create_project_from_goal",
      description:
        "Turn an owner goal into a project: writes a brief and decomposes it into tasks assigned to agent roles. High-risk tasks automatically go to the owner's approval queue. Does not execute any task. Only call this when the user clearly asks to create a project or plan.",
      input_schema: {
        type: "object",
        properties: {
          goal: { type: "string", description: "The owner's goal, in their words plus any clarified details." },
          project_id: { type: "string", description: "Existing project to re-plan instead of creating a new one." }
        },
        required: ["goal"],
        additionalProperties: false
      }
    },
    validate: requireString("goal"),
    run: async (input) => {
      const goal = str(input, "goal");
      const { project, brief } = await createProjectFromGoal({ goal, projectId: str(input, "project_id") || null });
      const { createdTasks, risks } = await createTasksForProject({ project, goal });
      return {
        project: summarizeProject(project),
        brief,
        tasks: createdTasks.map(summarizeTask),
        risks
      };
    }
  },

  run_next_task: {
    definition: {
      name: "run_next_task",
      description:
        "Execute the highest-priority runnable (status todo) task of a project with its assigned agent and model policy. Tasks waiting for owner approval are never run. Takes up to a minute. Only call when the user asks to run or advance work.",
      input_schema: {
        type: "object",
        properties: { project_id: { type: "string", description: "Project id." } },
        required: ["project_id"],
        additionalProperties: false
      }
    },
    validate: requireString("project_id"),
    run: async (input) => runNextTaskForProject(str(input, "project_id"))
  }
};

export const consoleToolDefinitions: Anthropic.Beta.BetaTool[] = Object.values(tools).map((tool) => ({
  ...tool.definition,
  eager_input_streaming: true
}));

export async function runConsoleTool(name: string, rawInput: unknown) {
  const tool = tools[name];
  if (!tool) return { isError: true, content: `Unknown tool: ${name}` };
  const input = rawInput && typeof rawInput === "object" && !Array.isArray(rawInput) ? (rawInput as ToolInput) : null;
  const invalid = input ? tool.validate(input) : "input must be a JSON object";
  if (invalid || !input) return { isError: true, content: `INVALID_INPUT: ${invalid}` };

  try {
    const result = await tool.run(input);
    const text = JSON.stringify(result ?? null, null, 1);
    return {
      isError: false,
      content: text.length > MAX_RESULT_CHARS ? `${text.slice(0, MAX_RESULT_CHARS)}\n…(truncated, ${text.length} chars total)` : text
    };
  } catch (error) {
    return { isError: true, content: error instanceof Error ? error.message : "tool failed" };
  }
}
