alter table public.agents add column if not exists model_policy_id uuid;
alter table public.agents add column if not exists preferred_provider text;
alter table public.agents add column if not exists preferred_model text;
alter table public.agents add column if not exists fallback_provider text;
alter table public.agents add column if not exists max_cost_per_run numeric;
alter table public.agents add column if not exists temperature numeric;
alter table public.agents add column if not exists max_tokens integer;

alter table public.model_providers add column if not exists display_name text;
alter table public.model_providers add column if not exists status text not null default 'missing_key';
alter table public.model_providers add column if not exists last_checked_at timestamptz;
alter table public.model_providers add column if not exists updated_at timestamptz not null default now();

create table if not exists public.model_catalog (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.users(id) on delete cascade,
  provider text not null,
  model text not null,
  display_name text not null,
  context_window integer,
  input_cost_per_1m numeric,
  output_cost_per_1m numeric,
  capabilities text[] not null default '{}',
  recommended_use text[] not null default '{}',
  enabled boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.model_policies add column if not exists description text;
alter table public.model_policies add column if not exists updated_at timestamptz not null default now();

alter table public.model_runs add column if not exists task_id uuid references public.tasks(id) on delete set null;
alter table public.model_runs add column if not exists agent_id uuid references public.agents(id) on delete set null;
alter table public.model_runs add column if not exists policy_name text;

create index if not exists model_catalog_provider_model_idx on public.model_catalog(provider, model, enabled);
create index if not exists model_runs_task_created_idx on public.model_runs(task_id, created_at);

alter table public.model_catalog enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'model_catalog' and policyname = 'Owners manage model catalog'
  ) then
    create policy "Owners manage model catalog" on public.model_catalog
      for all using (owner_id is null or auth.uid() = owner_id) with check (owner_id is null or auth.uid() = owner_id);
  end if;
end $$;

insert into public.model_providers (name, display_name, base_url, api_key_env, enabled, status, notes)
select 'openai', 'OpenAI', null, 'OPENAI_API_KEY', true, 'missing_key', 'MVP real provider'
where not exists (select 1 from public.model_providers where owner_id is null and name = 'openai');

insert into public.model_providers (name, display_name, base_url, api_key_env, enabled, status, notes)
select 'openrouter', 'OpenRouter', 'https://openrouter.ai/api/v1', 'OPENROUTER_API_KEY', false, 'disabled', 'Placeholder provider'
where not exists (select 1 from public.model_providers where owner_id is null and name = 'openrouter');

insert into public.model_providers (name, display_name, base_url, api_key_env, enabled, status, notes)
select 'litellm', 'LiteLLM', null, 'LITELLM_API_KEY', false, 'disabled', 'Placeholder provider'
where not exists (select 1 from public.model_providers where owner_id is null and name = 'litellm');

insert into public.model_providers (name, display_name, base_url, api_key_env, enabled, status, notes)
select name, display_name, base_url, api_key_env, false, 'disabled', 'Placeholder provider'
from (
  values
    ('anthropic', 'Anthropic Claude', 'https://api.anthropic.com', 'ANTHROPIC_API_KEY'),
    ('gemini', 'Google Gemini', 'https://generativelanguage.googleapis.com', 'GEMINI_API_KEY'),
    ('deepseek', 'DeepSeek', 'https://api.deepseek.com', 'DEEPSEEK_API_KEY'),
    ('qwen', 'Qwen', 'https://dashscope.aliyuncs.com', 'QWEN_API_KEY'),
    ('kimi', 'Kimi', 'https://api.moonshot.cn', 'KIMI_API_KEY')
) as providers(name, display_name, base_url, api_key_env)
where not exists (select 1 from public.model_providers where owner_id is null and model_providers.name = providers.name);

insert into public.model_catalog (provider, model, display_name, context_window, input_cost_per_1m, output_cost_per_1m, capabilities, recommended_use, enabled, notes)
select provider, model, display_name, context_window, input_cost_per_1m, output_cost_per_1m, capabilities, recommended_use, enabled, notes
from (
  values
    ('openai', 'gpt-4o', 'GPT-4o', 128000, 2.5, 10, array['chat','json','tools','vision'], array['strong_reasoning','review_policy','coding','long_context'], true, 'MVP enabled'),
    ('openai', 'gpt-4o-mini', 'GPT-4o mini', 128000, 0.15, 0.6, array['chat','json','tools'], array['low_cost','creative_content','business_english'], true, 'MVP enabled'),
    ('openrouter', 'openrouter/auto', 'OpenRouter Auto', null, null, null, array['chat','json'], array['future_multi_model'], false, 'Placeholder adapter'),
    ('litellm', 'router/default', 'LiteLLM Default', null, null, null, array['chat','json'], array['future_gateway'], false, 'Placeholder adapter')
) as models(provider, model, display_name, context_window, input_cost_per_1m, output_cost_per_1m, capabilities, recommended_use, enabled, notes)
where not exists (select 1 from public.model_catalog where owner_id is null and model_catalog.provider = models.provider and model_catalog.model = models.model);

insert into public.model_policies (name, description, agent_role, task_type, risk_level, primary_provider, primary_model, fallback_provider, fallback_model, temperature, max_tokens, cost_level, enabled)
select name, description, agent_role, task_type, risk_level, 'openai', primary_model, 'openai', 'gpt-4o-mini', temperature, max_tokens, cost_level, true
from (
  values
    ('strong_reasoning', '复杂推理、高风险规划和老板级决策。', 'leader', null, null, 'gpt-4o', 0.2, 4000, 'high'),
    ('review_policy', '质量审核、风险复核和审批前检查。', 'reviewer', null, null, 'gpt-4o', 0.1, 3000, 'high'),
    ('creative_content', '内容创意、社媒文案和营销表达。', null, 'content', null, 'gpt-4o-mini', 0.7, 2500, 'medium'),
    ('low_cost', '低风险、表格、整理和轻量任务。', null, 'simple', null, 'gpt-4o-mini', 0.2, 1400, 'low'),
    ('coding', '代码、自动化和工程实现任务。', null, 'code', null, 'gpt-4o', 0.2, 4000, 'high'),
    ('long_context', '长文档、合同和大上下文分析。', null, 'long_document', null, 'gpt-4o', 0.15, 6000, 'high'),
    ('business_english', '商务英文、跨境邮件和正式表达。', null, 'business_english', null, 'gpt-4o-mini', 0.35, 2200, 'medium')
) as policies(name, description, agent_role, task_type, risk_level, primary_model, temperature, max_tokens, cost_level)
where not exists (select 1 from public.model_policies where owner_id is null and model_policies.name = policies.name);
