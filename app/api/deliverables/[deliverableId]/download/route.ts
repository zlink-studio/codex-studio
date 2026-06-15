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

  if (deliverable.file_path) {
    const filePath = String(deliverable.file_path);
    const buffer = await fs.readFile(filePath);
    return new Response(buffer, {
      headers: {
        "Content-Type": contentTypeByExt(path.extname(filePath)),
        "Content-Disposition": `attachment; filename="${path.basename(filePath)}"`
      }
    });
  }

  return new Response(String(deliverable.content ?? ""), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slugify(String(deliverable.title ?? "deliverable"))}.txt"`
    }
  });
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
