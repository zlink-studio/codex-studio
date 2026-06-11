"use client";

import { FormEvent, useEffect, useState } from "react";
import { MessageSquareText } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { normalizeAgent, readApiData } from "@/lib/client-normalizers";
import { agents as fallbackAgents, meetings } from "@/lib/mock-data";
import type { Agent } from "@/lib/types";

type MeetingResult = {
  topic: string;
  messages: Array<{ speaker: string; content: string }>;
  conclusion: string;
  actionItems: string[];
};

export function MeetingRoomWorkspace() {
  const [agents, setAgents] = useState<Agent[]>(fallbackAgents);
  const [topic, setTopic] = useState(meetings[0]?.topic ?? "");
  const [hostAgentId, setHostAgentId] = useState("agent-exec");
  const [participantIds, setParticipantIds] = useState<string[]>(meetings[0]?.participantAgentIds ?? []);
  const [result, setResult] = useState<MeetingResult>({
    topic: meetings[0]?.topic ?? "",
    messages: [],
    conclusion: meetings[0]?.conclusion ?? "",
    actionItems: meetings[0]?.actionItems ?? []
  });
  const [message, setMessage] = useState("等待发起会议");
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    fetch("/api/agents")
      .then((response) => readApiData<any[]>(response))
      .then((data) => {
        const nextAgents = data.map(normalizeAgent);
        setAgents(nextAgents);
        if (!participantIds.length) {
          setParticipantIds(nextAgents.slice(0, 3).map((agent) => agent.id));
        }
      })
      .catch(() => undefined);
  }, [participantIds.length]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsRunning(true);
    setMessage("会议讨论中...");

    try {
      const data = await readApiData<any>(
        await fetch("/api/meetings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic,
            host_agent_id: hostAgentId,
            participant_agent_ids: participantIds
          })
        })
      );
      setResult({
        topic: data.topic ?? data.meeting?.topic ?? topic,
        messages: data.messages ?? [],
        conclusion: data.conclusion ?? data.meeting?.conclusion ?? "",
        actionItems: data.actionItems ?? data.meeting?.action_items ?? []
      });
      setMessage(data.persisted === false ? "已生成会议纪要草案" : "会议纪要已保存");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "会议失败");
    } finally {
      setIsRunning(false);
    }
  }

  function toggleParticipant(agentId: string) {
    setParticipantIds((current) => (current.includes(agentId) ? current.filter((id) => id !== agentId) : [...current, agentId]));
  }

  return (
    <>
      <PageHeader
        eyebrow="Meeting Room"
        title="AI 会议室"
        description="选择多个 Agent 围绕一个主题讨论，由执行经理主持，最后生成会议纪要和待办任务。"
        action={<span className="rounded-md border border-line bg-[#fbfcf8] px-3 py-2 text-sm text-moss">{message}</span>}
      />

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="会议配置" description="选择主持人、参会 Agent 和讨论主题。">
          <form className="space-y-4" onSubmit={submit}>
            <input className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-moss" placeholder="会议主题" value={topic} onChange={(event) => setTopic(event.target.value)} required />
            <select className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-moss" value={hostAgentId} onChange={(event) => setHostAgentId(event.target.value)}>
              {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name} · {agent.title}</option>)}
            </select>
            <div className="grid gap-2">
              {agents.map((agent) => (
                <label key={agent.id} className="flex items-center gap-3 rounded-md border border-line bg-paper px-3 py-2 text-sm text-moss">
                  <input type="checkbox" className="h-4 w-4" checked={participantIds.includes(agent.id)} onChange={() => toggleParticipant(agent.id)} />
                  {agent.name} · {agent.department}
                </label>
              ))}
            </div>
            <button className="w-fit rounded-md bg-moss px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60" disabled={isRunning || participantIds.length === 0}>
              {isRunning ? "讨论中..." : "开始讨论"}
            </button>
          </form>
        </Panel>

        <Panel title={result.topic || "会议纪要"} description="会议结论会保存到 meetings，逐轮发言保存到 meeting_messages。">
          <div className="space-y-4">
            {result.messages.length > 0 ? (
              result.messages.map((item) => (
                <div key={`${item.speaker}-${item.content}`} className="rounded-md border border-line bg-paper p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <MessageSquareText size={16} />
                    {item.speaker}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-moss">{item.content}</p>
                </div>
              ))
            ) : (
              <p className="rounded-md border border-line bg-paper p-4 text-sm leading-6 text-moss">发起会议后，这里会显示各 Agent 的岗位发言。</p>
            )}
          </div>
          <div className="mt-5 rounded-md bg-mint p-4">
            <p className="font-semibold text-ink">会议结论</p>
            <p className="mt-2 text-sm leading-6 text-moss">{result.conclusion || "暂无结论"}</p>
            <ul className="mt-3 space-y-2 text-sm text-moss">
              {result.actionItems.map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </div>
        </Panel>
      </section>
    </>
  );
}
