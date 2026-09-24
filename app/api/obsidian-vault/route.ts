import { fail, ok, parseJson } from "@/lib/api";
import { ObsidianVaultConfigurationError, readObsidianVault, upsertObsidianNote } from "@/lib/obsidian-vault";

export const dynamic = "force-dynamic";

type NoteBody = {
  id?: string;
  title?: string;
  type?: string;
  tags?: string[];
  content?: string;
};

export async function GET() {
  try {
    return ok(await readObsidianVault(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Failed to read Obsidian vault.",
      error instanceof ObsidianVaultConfigurationError ? 503 : 500
    );
  }
}

export async function POST(request: Request) {
  const body = await parseJson<NoteBody>(request);
  if (!body?.title || body.content === undefined) {
    return fail("title and content are required");
  }

  try {
    const note = await upsertObsidianNote({
      id: body.id,
      title: body.title,
      type: body.type,
      tags: body.tags,
      content: body.content
    });
    return ok(note, { status: 201 });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Failed to save note.",
      error instanceof ObsidianVaultConfigurationError ? 503 : 500
    );
  }
}
