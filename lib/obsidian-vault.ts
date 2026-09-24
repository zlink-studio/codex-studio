import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSupabaseServerClient } from "@/lib/supabase";

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
  workflowStatus?: string;
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
  name: string;
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
    retrospectiveDrafts: number;
    awaitingSync: number;
  };
};

type Frontmatter = Record<string, string | string[] | undefined>;

type RetrospectiveDraftInput = {
  ownerId: string;
  title: string;
  content: string;
  projectId?: string | null;
  taskId?: string | null;
  agentId?: string | null;
  tags?: string[];
};

type ParsedNote = ObsidianNote & { frontmatter: Frontmatter; file: string };

const SYSTEM_RETROSPECTIVE = "system_retrospective";
const AWAITING_EDIT = "awaiting_human_edit";
const QUEUED = "queued_for_review";
const IGNORED_DIRECTORIES = new Set([".obsidian", ".trash", ".git", "node_modules"]);

export class ObsidianVaultConfigurationError extends Error {}

export function isObsidianVaultConfigured() {
  try {
    getVaultDirectory();
    return true;
  } catch {
    return false;
  }
}

export async function readObsidianVault(): Promise<ObsidianVault> {
  const vaultDir = await ensureVaultDirectory();
  const files = await listMarkdownFiles(vaultDir);
  const parsedNotes = await Promise.all(files.map((file) => readNoteFile(file, vaultDir)));
  const notes = parsedNotes.map(stripInternalNoteFields);
  const byTitle = new Map(notes.map((note) => [normalizeTitle(note.title), note.id]));

  const edges: ObsidianGraphEdge[] = [];
  for (const note of notes) {
    for (const link of note.links) {
      const target = byTitle.get(normalizeTitle(link));
      if (target) edges.push({ source: note.id, target });
    }
  }

  const backlinks = new Map<string, string[]>();
  for (const edge of edges) {
    backlinks.set(edge.target, [...(backlinks.get(edge.target) ?? []), edge.source]);
  }

  const notesWithBacklinks = notes
    .map((note) => ({ ...note, backlinks: backlinks.get(note.id) ?? [] }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const tagSet = new Set(notes.flatMap((note) => note.tags));
  const connected = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
  const retrospectives = parsedNotes.filter((note) => note.frontmatter.zlinkSource === SYSTEM_RETROSPECTIVE);

  return {
    name: path.basename(vaultDir),
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
      orphanNotes: notes.filter((note) => !connected.has(note.id)).length,
      retrospectiveDrafts: retrospectives.length,
      awaitingSync: retrospectives.filter(isHumanEditedDraft).length
    }
  };
}

export async function upsertObsidianNote(input: {
  id?: string;
  title: string;
  type?: string;
  tags?: string[];
  content: string;
  systemFrontmatter?: Frontmatter;
}) {
  const vaultDir = await ensureVaultDirectory();
  const now = new Date().toISOString();
  const id = normalizeNoteId(input.id || input.title);
  const target = getNotePath(vaultDir, id);
  await assertSafeWriteTarget(vaultDir, target);

  let existingFrontmatter: Frontmatter = {};
  try {
    existingFrontmatter = (await readNoteFile(target, vaultDir)).frontmatter;
  } catch (error) {
    if (!isMissingFileError(error)) throw error;
  }

  const frontmatter: Frontmatter = {
    ...existingFrontmatter,
    ...input.systemFrontmatter,
    title: input.title.trim(),
    type: input.type || String(existingFrontmatter.type || "company"),
    tags: input.tags ?? (Array.isArray(existingFrontmatter.tags) ? existingFrontmatter.tags : []),
    createdAt: String(existingFrontmatter.createdAt || now),
    updatedAt: now
  };

  await fs.writeFile(target, serializeFrontmatter(frontmatter, input.content), "utf8");
  return stripInternalNoteFields(await readNoteFile(target, vaultDir));
}

export async function writeRetrospectiveDraft(input: RetrospectiveDraftInput) {
  if (!input.ownerId.trim()) throw new Error("ownerId is required.");
  if (!input.title.trim() || !input.content.trim()) throw new Error("title and content are required.");

  const noteId = randomUUID();
  const date = new Date().toISOString().slice(0, 10);
  const slug = normalizeFilename(input.title).slice(0, 60) || "复盘";
  const tags = Array.from(new Set(["复盘", "系统草稿", ...(input.tags ?? [])]));
  return upsertObsidianNote({
    id: `复盘/${date}-${slug}-${noteId.slice(0, 8)}`,
    title: input.title,
    type: "review",
    tags,
    content: input.content,
    systemFrontmatter: {
      zlinkId: noteId,
      zlinkSource: SYSTEM_RETROSPECTIVE,
      zlinkStatus: "draft",
      zlinkSyncStatus: AWAITING_EDIT,
      zlinkOwnerId: input.ownerId,
      zlinkProjectId: input.projectId ?? undefined,
      zlinkTaskId: input.taskId ?? undefined,
      zlinkAgentId: input.agentId ?? undefined,
      zlinkBaselineHash: hashNote(input.title, tags, input.content)
    }
  });
}

export async function syncEditedRetrospectivesToReviewQueue(ownerId: string) {
  if (!ownerId.trim()) throw new Error("ownerId is required.");
  const db = createSupabaseServerClient();
  if (!db) throw new Error("Supabase is required to sync Obsidian retrospectives.");

  const vaultDir = await ensureVaultDirectory();
  const files = await listMarkdownFiles(vaultDir);
  const notes = await Promise.all(files.map((file) => readNoteFile(file, vaultDir)));
  const candidates = notes.filter(
    (note) => note.frontmatter.zlinkSource === SYSTEM_RETROSPECTIVE && note.frontmatter.zlinkOwnerId === ownerId
  );
  const result = { scanned: candidates.length, awaitingHumanEdit: 0, queued: 0, alreadyQueued: 0, errors: [] as string[] };

  for (const note of candidates) {
    if (note.frontmatter.zlinkSyncStatus === QUEUED) {
      result.alreadyQueued += 1;
      continue;
    }
    if (!isHumanEditedDraft(note)) {
      result.awaitingHumanEdit += 1;
      continue;
    }

    const sourceId = String(note.frontmatter.zlinkId || note.id);
    try {
      const { data: existing, error: existingError } = await db
        .from("memories")
        .select("id")
        .eq("owner_id", ownerId)
        .eq("source_type", "obsidian")
        .eq("source_id", sourceId)
        .maybeSingle();
      if (existingError) throw new Error(existingError.message);

      if (existing) {
        await markNoteQueued(note, existing.id, undefined);
        result.alreadyQueued += 1;
        continue;
      }

      const { data: memory, error: memoryError } = await db
        .from("memories")
        .insert({
          owner_id: ownerId,
          type: "review",
          scope: note.frontmatter.zlinkProjectId ? "project" : "global",
          project_id: emptyToNull(note.frontmatter.zlinkProjectId),
          agent_id: emptyToNull(note.frontmatter.zlinkAgentId),
          title: note.title,
          content: note.content,
          summary: note.preview,
          tags: Array.from(new Set([...note.tags, "Obsidian", "待审核"])),
          importance: 4,
          confidence: 0.8,
          status: "pending_review",
          visibility: "owner",
          source_type: "obsidian",
          source_id: sourceId,
          source_url: `obsidian://${encodeURIComponent(note.path)}`,
          created_by: "obsidian_sync"
        })
        .select("id")
        .single();
      if (memoryError) throw new Error(memoryError.message);

      const { data: queue, error: queueError } = await db
        .from("memory_review_queue")
        .insert({
          owner_id: ownerId,
          memory_id: memory.id,
          proposed_by_agent_id: emptyToNull(note.frontmatter.zlinkAgentId),
          reason: "Obsidian 中的系统复盘草稿已由人工编辑，等待主理人审核后进入长期记忆。",
          risk_level: "medium",
          review_status: "pending"
        })
        .select("id")
        .single();
      if (queueError) {
        await db.from("memories").delete().eq("id", memory.id).eq("owner_id", ownerId);
        throw new Error(queueError.message);
      }

      await db.from("memory_access_logs").insert({ owner_id: ownerId, memory_id: memory.id, access_type: "create" });
      await markNoteQueued(note, memory.id, queue.id);
      result.queued += 1;
    } catch (error) {
      result.errors.push(`${note.path}: ${error instanceof Error ? error.message : "sync failed"}`);
    }
  }

  return result;
}

async function markNoteQueued(note: ParsedNote, memoryId: string, queueId?: string) {
  const frontmatter: Frontmatter = {
    ...note.frontmatter,
    zlinkSyncStatus: QUEUED,
    zlinkMemoryId: memoryId,
    zlinkReviewQueueId: queueId ?? note.frontmatter.zlinkReviewQueueId,
    zlinkSyncedHash: hashNote(note.title, note.tags, note.content),
    zlinkSyncedAt: new Date().toISOString()
  };
  await fs.writeFile(note.file, serializeFrontmatter(frontmatter, note.content), "utf8");
}

async function ensureVaultDirectory() {
  const vaultDir = getVaultDirectory();
  await fs.mkdir(vaultDir, { recursive: true });
  const stat = await fs.stat(vaultDir);
  if (!stat.isDirectory()) throw new ObsidianVaultConfigurationError("OBSIDIAN_VAULT_DIR is not a directory.");
  return vaultDir;
}

function getVaultDirectory() {
  const configured = process.env.OBSIDIAN_VAULT_DIR?.trim();
  if (!configured) throw new ObsidianVaultConfigurationError("OBSIDIAN_VAULT_DIR is not configured.");
  if (!path.isAbsolute(configured)) {
    throw new ObsidianVaultConfigurationError("OBSIDIAN_VAULT_DIR must be an absolute path.");
  }
  const resolved = path.resolve(configured);
  if (resolved === path.parse(resolved).root || resolved === path.resolve(os.homedir())) {
    throw new ObsidianVaultConfigurationError("OBSIDIAN_VAULT_DIR cannot be a filesystem root or home directory.");
  }
  return resolved;
}

async function listMarkdownFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const result: string[] = [];
  for (const entry of entries) {
    if (IGNORED_DIRECTORIES.has(entry.name)) continue;
    const current = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...(await listMarkdownFiles(current)));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) result.push(current);
  }
  return result;
}

async function readNoteFile(file: string, vaultDir: string): Promise<ParsedNote> {
  const raw = await fs.readFile(file, "utf8");
  const stat = await fs.stat(file);
  const relative = path.relative(vaultDir, file).replace(/\\/g, "/");
  const id = relative.replace(/\.md$/i, "");
  const { frontmatter, content } = parseFrontmatter(raw);
  const title = String(frontmatter.title || path.basename(id));
  const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];

  return {
    id,
    title,
    type: String(frontmatter.type || "company"),
    tags,
    path: relative,
    content,
    preview: content.replace(/[#*_`>\-\[\]]/g, "").trim().slice(0, 180),
    links: extractLinks(content),
    backlinks: [],
    wordCount: countWords(content),
    createdAt: String(frontmatter.createdAt || stat.birthtime.toISOString()),
    updatedAt: latestTimestamp(frontmatter.updatedAt, stat.mtime.toISOString()),
    workflowStatus: typeof frontmatter.zlinkSyncStatus === "string" ? frontmatter.zlinkSyncStatus : undefined,
    frontmatter,
    file
  };
}

function parseFrontmatter(raw: string): { frontmatter: Frontmatter; content: string } {
  const normalized = raw.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return { frontmatter: {}, content: normalized.trim() };
  const end = normalized.indexOf("\n---", 4);
  if (end === -1) return { frontmatter: {}, content: normalized.trim() };

  const block = normalized.slice(4, end).trim();
  const content = normalized.slice(end + 4).trim();
  const frontmatter: Frontmatter = {};
  for (const line of block.split("\n")) {
    const index = line.indexOf(":");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      frontmatter[key] = value
        .slice(1, -1)
        .split(",")
        .map((item) => unquote(item.trim()))
        .filter(Boolean);
    } else {
      frontmatter[key] = unquote(value);
    }
  }
  return { frontmatter, content };
}

function serializeFrontmatter(frontmatter: Frontmatter, content: string) {
  const lines = Object.entries(frontmatter)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => {
      if (Array.isArray(value)) return `${key}: [${value.map(quoteScalar).join(", ")}]`;
      return `${key}: ${quoteScalar(String(value))}`;
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

function isHumanEditedDraft(note: ParsedNote) {
  return (
    note.frontmatter.zlinkSource === SYSTEM_RETROSPECTIVE &&
    note.frontmatter.zlinkStatus === "draft" &&
    note.frontmatter.zlinkSyncStatus === AWAITING_EDIT &&
    typeof note.frontmatter.zlinkBaselineHash === "string" &&
    hashNote(note.title, note.tags, note.content) !== note.frontmatter.zlinkBaselineHash
  );
}

function stripInternalNoteFields(note: ParsedNote): ObsidianNote {
  const { frontmatter: _frontmatter, file: _file, ...publicNote } = note;
  return publicNote;
}

function hashNote(title: string, tags: string[], content: string) {
  const canonical = JSON.stringify({
    title: title.trim(),
    tags: [...tags].map((tag) => tag.trim()).filter(Boolean).sort(),
    content: content.replace(/\r\n/g, "\n").trim()
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

function countWords(content: string) {
  const chineseChars = content.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const latinWords = content.match(/[A-Za-z0-9_]+/g)?.length ?? 0;
  return chineseChars + latinWords;
}

function normalizeTitle(value: string) {
  return value.trim().toLowerCase();
}

function normalizeFilename(value: string) {
  return value.replace(/[<>:"/\\|?*]/g, "").replace(/\s+/g, "-").trim();
}

function normalizeNoteId(value: string) {
  const clean = value
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.replace(/[<>:"|?*]/g, "").trim())
    .filter(Boolean)
    .join("/");
  if (!clean || clean.startsWith("../") || path.isAbsolute(clean)) throw new Error("Invalid note id.");
  return clean.replace(/\.md$/i, "");
}

function getNotePath(vaultDir: string, id: string) {
  const target = path.resolve(vaultDir, `${normalizeNoteId(id)}.md`);
  if (!isWithinDirectory(vaultDir, target)) throw new Error("Invalid note path.");
  return target;
}

async function assertSafeWriteTarget(vaultDir: string, target: string) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  const [realRoot, realParent] = await Promise.all([fs.realpath(vaultDir), fs.realpath(path.dirname(target))]);
  if (!isWithinDirectory(realRoot, realParent)) throw new Error("Note path escapes the configured vault.");
  try {
    const stat = await fs.lstat(target);
    if (stat.isSymbolicLink()) throw new Error("Refusing to write through a symbolic link.");
  } catch (error) {
    if (!isMissingFileError(error)) throw error;
  }
}

function isWithinDirectory(root: string, candidate: string) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function quoteScalar(value: string) {
  return JSON.stringify(value);
}

function unquote(value: string) {
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value) as string;
    } catch {
      return value.slice(1, -1);
    }
  }
  return value.replace(/^'|'$/g, "");
}

function emptyToNull(value: string | string[] | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function latestTimestamp(frontmatterValue: string | string[] | undefined, fileModifiedAt: string) {
  if (typeof frontmatterValue !== "string") return fileModifiedAt;
  const parsed = Date.parse(frontmatterValue);
  return Number.isFinite(parsed) && parsed > Date.parse(fileModifiedAt) ? frontmatterValue : fileModifiedAt;
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return Boolean(error && typeof error === "object" && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT");
}
