-- Replace this value with an auth.users id, then run this file after schema.sql.
-- Also set the same uuid as DEMO_OWNER_ID in .env.local during MVP development.

insert into public.users (id, email, display_name, role)
values ('00000000-0000-0000-0000-000000000000', 'owner@example.com', '老板', 'owner')
on conflict (id) do update set display_name = excluded.display_name;

insert into public.agents (id, owner_id, name, department, title, model, prompt, tool_permissions, status, current_focus, success_rate)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'Kiki', 'Executive', '执行经理 Agent', 'gpt-4o', '负责目标拆解、任务编排、风险识别和会议主持。', array['openai','supabase','n8n','email'], 'online', '拆解老板今日增长目标', 94),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'Jessie', 'Marketing', '增长营销 Agent', 'gpt-4o-mini', '负责用户洞察、渠道策略、内容日历和广告创意。', array['openai','browser','n8n'], 'busy', '设计获客内容矩阵', 88),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', '许栖', 'Operations', '运营交付 Agent', 'gpt-4o-mini', '负责 SOP、项目推进、客户交付和复盘。', array['openai','supabase','email'], 'online', '整理客户交付 SOP', 91),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'Poppy', 'Finance', '财务风控 Agent', 'gpt-4o-mini', '负责预算、现金流、合同风险和高风险任务审查。', array['openai','supabase'], 'idle', '等待审批任务', 86)
on conflict (id) do nothing;

insert into public.projects (id, owner_id, name, client_name, objective, client_profile, progress, stage, due_date)
values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'Aurora 咨询交付', 'Aurora Studio', '30 天内完成 AI 工作流诊断、SOP 重建与自动化上线。', '创意服务公司，团队 12 人，主要痛点是交付不稳定、销售线索沉淀不足。', 62, '自动化搭建', '2026-06-28'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', '个人品牌增长系统', '内部项目', '建立可复用的内容生产、私域转化和日报复盘系统。', '一人公司自营增长项目，目标是降低老板日常运营负担。', 38, '策略验证', '2026-07-12')
on conflict (id) do nothing;

insert into public.tasks (id, owner_id, project_id, assigned_agent_id, title, description, priority, risk_level, status, approval_status, due_at, created_by)
values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '拆解 Aurora 自动化上线计划', '将客户现有交付流程拆为 n8n 自动化节点、负责人和验收标准。', 'urgent', 'high', 'in_progress', 'pending', '2026-06-10 18:00:00+08', 'executive_agent'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '生成本周内容选题池', '围绕一人公司 AI 员工主题生成 20 个短内容选题。', 'high', 'medium', 'todo', 'not_required', '2026-06-11 12:00:00+08', 'owner')
on conflict (id) do nothing;

insert into public.daily_reports (owner_id, report_date, summary, wins, risks, next_actions)
values (
  '00000000-0000-0000-0000-000000000000',
  '2026-06-09',
  '今日重点推进 Aurora 自动化交付和个人品牌增长系统。高风险事项集中在合同条款与上线范围控制。',
  '["完成 4 条核心自动化链路梳理", "新增 20 个内容选题候选方向"]'::jsonb,
  '["Aurora 合同变更范围尚未确认"]'::jsonb,
  '["审批高风险任务", "确认 n8n Webhook 节点"]'::jsonb
)
on conflict (owner_id, report_date) do update
set summary = excluded.summary,
    wins = excluded.wins,
    risks = excluded.risks,
    next_actions = excluded.next_actions;
