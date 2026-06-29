import { promises as fs } from "fs";
import path from "path";
import { fail } from "@/lib/api";
import { readCollection } from "@/lib/local-store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { deliverableId: string } }
) {
  const rows = await readCollection<any>("deliverables");
  const deliverable = rows.find((item) => item.id === params.deliverableId);
  if (!deliverable) return fail("deliverable not found", 404);

  let raw = String(deliverable.content ?? "");
  let ext = "";
  if (deliverable.file_path) {
    const filePath = String(deliverable.file_path);
    ext = path.extname(filePath).toLowerCase();
    try {
      raw = await fs.readFile(filePath, "utf8");
    } catch {
      // Fall back to stored content when the generated file is unavailable.
    }
  }

  const type = String(deliverable.type ?? "").toLowerCase();
  const looksHtml = type === "html" || ext === ".html" || /^\s*<(!doctype|html|section|div|article|main)/i.test(raw);
  const body = looksHtml ? raw : renderMarkdownPage(String(deliverable.title ?? "交付物"), raw);

  return new Response(body, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": "inline"
    }
  });
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inline(text: string) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+?)`/g, "<code>$1</code>");
}

function markdownToHtml(markdown: string) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let listOpen = false;
  let tableRows: string[][] = [];

  const flushList = () => {
    if (listOpen) {
      html.push("</ul>");
      listOpen = false;
    }
  };

  const flushTable = () => {
    if (!tableRows.length) return;
    const [head, , ...rest] = tableRows;
    const body = tableRows.length > 1 && /^[\s:|-]+$/.test((tableRows[1] ?? []).join("")) ? rest : tableRows.slice(1);
    const headCells = (head ?? []).map((cell) => `<th>${inline(cell.trim())}</th>`).join("");
    const bodyRows = body
      .map((row) => `<tr>${row.map((cell) => `<td>${inline(cell.trim())}</td>`).join("")}</tr>`)
      .join("");
    html.push(`<table><thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody></table>`);
    tableRows = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^\|(.+)\|$/.test(trimmed)) {
      flushList();
      tableRows.push(trimmed.slice(1, -1).split("|"));
      continue;
    }
    flushTable();

    if (!trimmed) {
      flushList();
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushList();
      const level = heading[1].length + 1;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      if (!listOpen) {
        html.push("<ul>");
        listOpen = true;
      }
      html.push(`<li>${inline(trimmed.replace(/^[-*]\s+/, ""))}</li>`);
      continue;
    }

    flushList();
    html.push(`<p>${inline(trimmed)}</p>`);
  }

  flushList();
  flushTable();
  return html.join("\n");
}

function renderMarkdownPage(title: string, markdown: string) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f4f6fb; color: #1b2330; font-family: -apple-system, "Segoe UI", "Microsoft YaHei", Roboto, Helvetica, Arial, sans-serif; line-height: 1.7; }
  .wrap { max-width: 880px; margin: 0 auto; padding: 48px 24px 96px; }
  .card { background: #fff; border: 1px solid #e3e8f2; border-radius: 20px; padding: 40px clamp(20px, 5vw, 56px); box-shadow: 0 18px 50px rgba(15,23,42,.08); }
  h1,h2,h3,h4 { color: #0f172a; line-height: 1.3; margin: 1.6em 0 .6em; }
  h1 { font-size: 1.9rem; margin-top: 0; }
  h2 { font-size: 1.4rem; padding-bottom: .3em; border-bottom: 1px solid #eef1f7; }
  h3 { font-size: 1.15rem; }
  p { margin: .7em 0; }
  ul { padding-left: 1.3em; margin: .6em 0; }
  li { margin: .3em 0; }
  code { background: #eef2fb; padding: .12em .4em; border-radius: 6px; font-size: .92em; }
  table { width: 100%; border-collapse: collapse; margin: 1.2em 0; font-size: .94rem; }
  th, td { border: 1px solid #e3e8f2; padding: 10px 12px; text-align: left; vertical-align: top; }
  th { background: #f3f6fc; font-weight: 600; }
  tbody tr:nth-child(even) { background: #fafbfe; }
</style>
</head>
<body>
  <div class="wrap"><div class="card">${markdownToHtml(markdown)}</div></div>
</body>
</html>`;
}
