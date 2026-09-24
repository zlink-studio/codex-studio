import { fail, ok } from "@/lib/api";
import { readCollection } from "@/lib/local-store";
import { syncSiteGenerationState } from "@/lib/project-workflows";
import { generateSiteDraft, readSiteDraftStatus } from "@/lib/site-builder";
import type { Project } from "@/lib/types";

export const dynamic = "force-dynamic";
// Model calls can run long; 60s is the ceiling that works on every Vercel plan.
export const maxDuration = 60;

export async function GET(_: Request, { params }: { params: { projectId: string } }) {
  const status = await readSiteDraftStatus(params.projectId);
  return ok(status ?? { exists: false, outputDir: null, files: [] });
}

export async function POST(_: Request, { params }: { params: { projectId: string } }) {
  const projects = await readCollection<Project>("projects");
  const project = projects.find((item) => item.id === params.projectId);
  if (!project) return fail("project not found", 404);

  const draft = await generateSiteDraft(project);
  await syncSiteGenerationState(params.projectId, draft.files);
  return ok(draft, { status: 201 });
}
