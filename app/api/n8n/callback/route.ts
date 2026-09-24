import { fail, ok } from "@/lib/api";
import { verifyN8nCallbackSignature } from "@/lib/connectors/callback-auth";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    if (!verifyN8nCallbackSignature(rawBody, request.headers.get("x-zlink-signature"))) {
      return fail("Invalid n8n callback signature", 401);
    }
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Callback authentication failed.", 503);
  }
  let body: {
    task_id?: string;
    agent_id?: string;
    output?: string;
    status?: string;
  };
  try {
    body = JSON.parse(rawBody) as typeof body;
  } catch {
    return fail("Callback body must be valid JSON");
  }

  if (!body?.task_id || !body.output) {
    return fail("task_id and output are required");
  }

  const supabase = createSupabaseServerClient();
  const output = {
    agentId: body.agent_id ?? "n8n",
    content: body.output,
    createdAt: new Date().toISOString()
  };

  if (!supabase) {
    return ok({ task_id: body.task_id, output, persisted: false });
  }

  const { data: task, error: readError } = await supabase.from("tasks").select("outputs").eq("id", body.task_id).single();
  if (readError) return fail(readError.message, 500);

  const outputs = Array.isArray(task.outputs) ? task.outputs : [];
  const { data, error } = await supabase
    .from("tasks")
    .update({
      outputs: [...outputs, output],
      status: body.status ?? "in_progress",
      updated_at: new Date().toISOString()
    })
    .eq("id", body.task_id)
    .select("*")
    .single();

  if (error) return fail(error.message, 500);
  return ok(data);
}
