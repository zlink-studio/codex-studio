import { promises as fs } from "fs";
import path from "path";
import { fail } from "@/lib/api";
import { readCollection } from "@/lib/local-store";
import { resolveDeliverablePath } from "@/lib/storage-paths";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { deliverableId: string } }
) {
  const rows = await readCollection<any>("deliverables");
  const deliverable = rows.find((item) => item.id === params.deliverableId);
  if (!deliverable) return fail("deliverable not found", 404);

  const filePath = deliverable.file_path ? resolveDeliverablePath(String(deliverable.file_path)) : null;
  if (filePath) {
    const buffer = await fs.readFile(filePath).catch(() => null);
    if (buffer) {
      return new Response(buffer, {
        headers: {
          "Content-Type": contentTypeByExt(path.extname(filePath)),
          "Content-Disposition": contentDisposition(path.basename(filePath))
        }
      });
    }
  }

  return new Response(String(deliverable.content ?? ""), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": contentDisposition(`${slugify(String(deliverable.title ?? "deliverable"))}.txt`)
    }
  });
}

// HTTP 头只能是 ASCII（ByteString），中文文件名需用 RFC 5987 编码，并提供 ASCII 兜底名。
function contentDisposition(fileName: string) {
  const asciiFallback = fileName.replace(/[^\x20-\x7e]+/g, "_").replace(/["\\]/g, "_") || "deliverable";
  const encoded = encodeURIComponent(fileName);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

function contentTypeByExt(ext: string) {
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".md") return "text/markdown; charset=utf-8";
  return "text/plain; charset=utf-8";
}

function slugify(input: string) {
  return input.replace(/[^\w\u4e00-\u9fa5-]+/g, "-");
}
