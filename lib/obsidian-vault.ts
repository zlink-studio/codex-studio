import { promises as fs } from "fs";
import path from "path";

const vaultDir = path.join(process.cwd(), "work", "obsidian-vault");

export type ObsidianNote = {
  id: string;
  title: string;
  type: string;
  tags: string[];
  path: string;
  content: string;
  preview: string;
  links: string[];
  backlinks: string[];
  wordCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ObsidianGraphNode = {
  id: string;
  title: string;
  type: string;
  tags: string[];
  size: number;
};

export type ObsidianGraphEdge = {
  source: string;
  target: string;
};

export type ObsidianVault = {
  notes: ObsidianNote[];
  graph: {
    nodes: ObsidianGraphNode[];
    edges: ObsidianGraphEdge[];
  };
  stats: {
    notes: number;
    links: number;
    tags: number;
    orphanNotes: number;
  };
};

type Frontmatter = Record<string, string | string[] | undefined>;

const seedNotes = [
  {
    id: "公司中枢",
    title: "公司中枢",
    type: "company",
    tags: ["公司大脑", "原则"],
    content:
      "这是 ZLink AI 的长期记忆入口。\n\n核心关系：\n- [[项目执行闭环]]\n- [[执行总管 Agent]]\n- [[AI外贸B2B建站项目]]\n\n原则：系统运行数据放在 Supabase，长期知识、SOP、复盘和客户背景沉淀在这个 Markdown vault。"
  },
  {
    id: "SOP/项目执行闭环",
    title: "项目执行闭环",
    type: "sop",
    tags: ["SOP", "执行"],
    content:
      "老板提出目标后，系统应形成闭环：\n\n1. 生成 Project Brief\n2. 拆解任务\n3. 分配 Agent、Skill、Model Policy\n4. 执行任务并写入日志\n5. 生成交付物\n6. 进入 Review Gate\n7. 通过后更新项目进度\n\n关联：[[执行总管 Agent]]、[[公司中枢]]。"
  },
  {
    id: "Agent/执行总管 Agent",
    title: "执行总管 Agent",
    type: "agent",
    tags: ["Agent", "管理"],
    content:
      "执行总管负责把老板目标拆成项目、任务和交付物。\n\n工作重点：\n- 先判断目标是否清楚\n- 自动拆任务\n- 控制风险动作\n- 汇总最终结果\n\n常用知识：[[项目执行闭环]]。"
  },
  {
    id: "项目/AI外贸B2B建站项目",
    title: "AI外贸B2B建站项目",
    type: "project",
    tags: ["项目", "外贸", "建站"],
    content:
      "用于验证一人公司 AI 数字员工工作台能否承接真实项目。\n\n目标：跑通项目创建、任务拆解、Agent 执行、交付物生成和复盘。\n\n相关 SOP：[[项目执行闭环]]。\n\n复盘入口：[[首轮测试复盘]]。"
  },
  {
    id: "复盘/首轮测试复盘",
    title: "首轮测试复盘",
    type: "review",
    tags: ["复盘", "测试"],
    content:
      "第一轮测试暴露的问题：\n\n- 用户需要看到项目详情里的执行过程\n- 任务不应该长期卡在需要审批\n- 交付物必须真实落地\n- 记忆系统需要更像 Obsidian，方便人维护长期知识\n\n回到：[[AI外贸B2B建站项目]]。"
  }
];

export async function readObsidianVault(): Promise<ObsidianVault> {
  await ensureVault();
  const files = await listMarkdownFiles(vaultDir);
  const notes = await Promise.all(files.map(readNoteFile));
  const byTitle = new Map(notes.map((note) => [normalizeTitle(note.title), note.id]));

  const edges: ObsidianGraphEdge[] = [];
  for (const note of notes) {
    for (const link of note.links) {
      const target = byTitle.get(normalizeTitle(link));
      if (target) {
        edges.push({ source: note.id, target });
      }
    }
  }

  const backlinks = new Map<string, string[]>();
  for (const edge of edges) {
    backlinks.set(edge.target, [...(backlinks.get(edge.target) ?? []), edge.source]);
  }

  const notesWithBacklinks = notes
    .map((note) => ({
      ...note,
      backlinks: backlinks.get(note.id) ?? []
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const tagSet = new Set(notes.flatMap((note) => note.tags));
  const connected = new Set(edges.flatMap((edge) => [edge.source, edge.target]));

  return {
    notes: notesWithBacklinks,
    graph: {
      nodes: notesWithBacklinks.map((note) => ({
        id: note.id,
        title: note.title,
        type: note.type,
        tags: note.tags,
        size: Math.max(8, Math.min(24, 10 + note.links.length * 2 + note.backlinks.length * 2))
      })),
      edges
    },
    stats: {
      notes: notes.length,
      links: edges.length,
      tags: tagSet.size,
      orphanNotes: notes.filter((note) => !connected.has(note.id)).length
    }
  };
}

export async function upsertObsidianNote(input: {
  id?: string;
  title: string;
  type?: string;
  tags?: string[];
  content: string;
}) {
  await fs.mkdir(vaultDir, { recursive: true });
  const now = new Date().toISOString();
  const id = normalizeNoteId(input.id || input.title);
  const target = notePath(id);
  await fs.mkdir(path.dirname(target), { recursive: true });

  let createdAt = now;
  try {
    const existing = await readNoteFile(target);
    createdAt = existing.createdAt;
  } catch {
    // New note.
  }

  const body = serializeFrontmatter(
    {
      title: input.title.trim(),
      type: input.type || "company",
      tags: input.tags ?? [],
      createdAt,
      updatedAt: now
    },
    input.content
  );

  await fs.writeFile(target, body, "utf8");
  return readNoteFile(target);
}

async function ensureVault() {
  await fs.mkdir(vaultDir, { recursive: true });
  const files = await listMarkdownFiles(vaultDir);
  if (files.length > 0) return;

  await Promise.all(
    seedNotes.map((note) =>
      upsertObsidianNote({
        id: note.id,
        title: note.title,
        type: note.type,
        tags: note.tags,
        content: note.content
      })
    )
  );
}

async function listMarkdownFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  const result: string[] = [];
  for (const entry of entries) {
    const current = path.join(root, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await listMarkdownFiles(current)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      result.push(current);
    }
  }
  return result;
}

async function readNoteFile(file: string): Promise<ObsidianNote> {
  const raw = await fs.readFile(file, "utf8");
  const stat = await fs.stat(file);
  const relative = path.relative(vaultDir, file).replace(/\\/g, "/");
  const id = relative.replace(/\.md$/i, "");
  const { frontmatter, content } = parseFrontmatter(raw);
  const title = String(frontmatter.title || path.basename(id));
  const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
  const links = extractLinks(content);

  return {
    id,
    title,
    type: String(frontmatter.type || "company"),
    tags,
    path: relative,
    content,
    preview: content.replace(/[#*_`>\-\[\]]/g, "").trim().slice(0, 180),
    links,
    backlinks: [],
    wordCount: countWords(content),
    createdAt: String(frontmatter.createdAt || stat.birthtime.toISOString()),
    updatedAt: String(frontmatter.updatedAt || stat.mtime.toISOString())
  };
}

function parseFrontmatter(raw: string): { frontmatter: Frontmatter; content: string } {
  if (!raw.startsWith("---\n")) {
    return { frontmatter: {}, content: raw.trim() };
  }

  const end = raw.indexOf("\n---", 4);
  if (end === -1) {
    return { frontmatter: {}, content: raw.trim() };
  }

  const block = raw.slice(4, end).trim();
  const content = raw.slice(end + 4).trim();
  const frontmatter: Frontmatter = {};

  for (const line of block.split(/\r?\n/)) {
    const index = line.indexOf(":");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      frontmatter[key] = value
        .slice(1, -1)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    } else {
      frontmatter[key] = value.replace(/^"|"$/g, "");
    }
  }

  return { frontmatter, content };
}

function serializeFrontmatter(frontmatter: Frontmatter, content: string) {
  const lines = Object.entries(frontmatter).map(([key, value]) => {
    if (Array.isArray(value)) {
      return `${key}: [${value.join(", ")}]`;
    }
    return `${key}: ${String(value ?? "")}`;
  });
  return `---\n${lines.join("\n")}\n---\n\n${content.trim()}\n`;
}

function extractLinks(content: string) {
  const links = new Set<string>();
  const pattern = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
  let match = pattern.exec(content);
  while (match) {
    links.add(match[1].trim());
    match = pattern.exec(content);
  }
  return Array.from(links);
}

function countWords(content: string) {
  const chineseChars = content.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const latinWords = content.match(/[A-Za-z0-9_]+/g)?.length ?? 0;
  return chineseChars + latinWords;
}

function normalizeTitle(value: string) {
  return value.trim().toLowerCase();
}

function normalizeNoteId(value: string) {
  const clean = value
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.replace(/[<>:"|?*]/g, "").trim())
    .filter(Boolean)
    .join("/");
  if (!clean || clean.startsWith("../") || path.isAbsolute(clean)) {
    throw new Error("Invalid note id.");
  }
  return clean.replace(/\.md$/i, "");
}

function notePath(id: string) {
  const target = path.join(vaultDir, `${normalizeNoteId(id)}.md`);
  const resolved = path.resolve(target);
  const root = path.resolve(vaultDir);
  if (!resolved.startsWith(root)) {
    throw new Error("Invalid note path.");
  }
  return resolved;
}
