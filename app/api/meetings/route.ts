import { fail, ok, parseJson, resolveOwnerId } from "@/lib/api";
import { isLocalStoreEnabled } from "@/lib/local-store";
import { createSupabaseServerClient } from "@/lib/supabase";
import { runMeeting } from "@/lib/workflow-engine";

export async function GET(request: Request) {
  if (isLocalStoreEnabled()) return ok([]);
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return fail("Supabase is not configured. Set USE_LOCAL_STORE=true only for offline development.", 503);
  }

  const ownerId = resolveOwnerId(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!ownerId) return fail("owner_id or DEMO_OWNER_ID is required", 503);

  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) return fail(error.message, 500);
  return ok(data);
}

export async function POST(request: Request) {
  const body = await parseJson<{ topic?: string; owner_id?: string; host_agent_id?: string; participant_agent_ids?: string[] }>(request);
  if (!body?.topic || !body.participant_agent_ids?.length) {
    return fail("topic and participant_agent_ids are required");
  }

  const supabase = createSupabaseServerClient();
  const ownerId = resolveOwnerId(body as unknown as Record<string, unknown>);
  const localMode = isLocalStoreEnabled();
  if (!supabase && !localMode) {
    return fail("Supabase is not configured. Set USE_LOCAL_STORE=true only for offline development.", 503);
  }
  if (!localMode && supabase && !ownerId) return fail("owner_id or DEMO_OWNER_ID is required when Supabase is configured");

  try {
    const result = await runMeeting({
      topic: body.topic,
      participantAgentIds: body.participant_agent_ids,
      hostAgentId: body.host_agent_id ?? null
    });
    if (localMode || !supabase) return ok({ ...result, persisted: false }, { status: 201 });

    const { data: meeting, error } = await supabase
      .from("meetings")
      .insert({
        owner_id: ownerId,
        topic: body.topic,
        host_agent_id: body.host_agent_id,
        participant_agent_ids: body.participant_agent_ids,
        conclusion: result.conclusion,
        action_items: result.actionItems
      })
      .select("*")
      .single();
    if (error) return fail(error.message, 500);

    const messages = result.messages.map((message) => ({
      meeting_id: meeting.id,
      agent_id: message.agentId,
      role: "agent",
      content: message.content
    }));
    const { error: messageError } = await supabase.from("meeting_messages").insert(messages);
    if (messageError) return fail(messageError.message, 500);

    return ok({ ...result, meeting, persisted: true }, { status: 201 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "meeting failed", 500);
  }
}
