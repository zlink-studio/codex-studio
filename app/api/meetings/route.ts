import { fail, ok, parseJson, resolveOwnerId } from "@/lib/api";
import { meetings } from "@/lib/mock-data";
import { runMeeting } from "@/lib/orchestrator";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createSupabaseServerClient();
  if (!supabase) return ok(meetings);

  const { data, error } = await supabase.from("meetings").select("*").order("created_at", { ascending: false });
  if (error) return fail(error.message, 500);
  return ok(data);
}

export async function POST(request: Request) {
  const body = await parseJson<{ topic?: string; owner_id?: string; host_agent_id?: string; participant_agent_ids?: string[] }>(request);
  if (!body?.topic || !body.participant_agent_ids?.length) {
    return fail("topic and participant_agent_ids are required");
  }

  const result = await runMeeting(body.topic, body.participant_agent_ids);
  const supabase = createSupabaseServerClient();
  if (!supabase) return ok({ ...result, persisted: false }, { status: 201 });

  const ownerId = resolveOwnerId(body as unknown as Record<string, unknown>);
  if (!ownerId) return fail("owner_id or DEMO_OWNER_ID is required when Supabase is configured");

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
    role: "agent",
    content: `${message.speaker}: ${message.content}`
  }));
  const { error: messageError } = await supabase.from("meeting_messages").insert(messages);
  if (messageError) return fail(messageError.message, 500);

  return ok({ meeting, messages: result.messages }, { status: 201 });
}
