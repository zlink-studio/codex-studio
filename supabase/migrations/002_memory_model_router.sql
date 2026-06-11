alter table if exists public.agents
  add column if not exists preferred_model_policy text,
  add column if not exists fallback_model text;

alter table if exists public.memories
  add column if not exists scope text not null default 'global',
  add column if not exists client_name text,
  add column if not exists project_id uuid references public.projects(id) on delete set null,
  add column if not exists agent_id uuid references public.agents(id) on delete set null,
  add column if not exists summary text,
  add column if not exists importance integer not null default 3,
  add column if not exists confidence numeric not null default 0.8,
  add column if not exists status text not null default 'approved',
  add column if not exists visibility text not null default 'owner',
  add column if not exists source_type text not null default 'manual',
  add column if not exists source_id text,
  add column if not exists created_by text,
  add column if not exists approved_by text,
  add column if not exists last_accessed_at timestamptz;

create table if not exists public.memory_embeddings (
  id uuid primary key default uuid_generate_v4(),
  memory_id uuid not null references public.memories(id) on delete cascade,
  content_chunk text not null,
  embedding vector(1536),
  embedding_model text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.memory_review_queue (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.users(id) on delete cascade,
  memory_id uuid not null references public.memories(id) on delete cascade,
  proposed_by_agent_id uuid references public.agents(id) on delete set null,
  reason text not null,
  risk_level text not null default 'medium',
  review_status text not null default 'pending',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.memory_access_logs (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.users(id) on delete cascade,
  memory_id uuid references public.memories(id) on delete set null,
  agent_id uuid references public.agents(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  access_type text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.model_providers (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.users(id) on delete cascade,
  name text not null,
  base_url text,
  api_key_env text not null,
  enabled boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.model_policies (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.users(id) on delete cascade,
  name text not null,
  agent_role text,
  task_type text,
  risk_level text,
  primary_provider text not null,
  primary_model text not null,
  fallback_provider text,
  fallback_model text,
  temperature numeric not null default 0.2,
  max_tokens integer not null default 2000,
  cost_level text not null default 'medium',
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.model_runs (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.users(id) on delete cascade,
  agent_run_id uuid references public.agent_runs(id) on delete set null,
  provider text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost numeric not null default 0,
  latency_ms integer not null default 0,
  status text not null default 'succeeded',
  error text,
  created_at timestamptz not null default now()
);

create index if not exists memories_owner_status_idx on public.memories(owner_id, status, scope);
create index if not exists memories_project_agent_idx on public.memories(project_id, agent_id);
create index if not exists memory_review_owner_status_idx on public.memory_review_queue(owner_id, review_status);
create index if not exists memory_access_logs_memory_idx on public.memory_access_logs(memory_id, created_at);
create index if not exists model_policies_lookup_idx on public.model_policies(agent_role, task_type, risk_level, enabled);
create index if not exists model_runs_agent_run_idx on public.model_runs(agent_run_id, created_at);

alter table public.memory_embeddings enable row level security;
alter table public.memory_review_queue enable row level security;
alter table public.memory_access_logs enable row level security;
alter table public.model_providers enable row level security;
alter table public.model_policies enable row level security;
alter table public.model_runs enable row level security;

drop policy if exists "Owners manage memory review queue" on public.memory_review_queue;
create policy "Owners manage memory review queue" on public.memory_review_queue
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "Owners manage memory access logs" on public.memory_access_logs;
create policy "Owners manage memory access logs" on public.memory_access_logs
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "Owners manage model providers" on public.model_providers;
create policy "Owners manage model providers" on public.model_providers
  for all using (owner_id is null or auth.uid() = owner_id) with check (owner_id is null or auth.uid() = owner_id);

drop policy if exists "Owners manage model policies" on public.model_policies;
create policy "Owners manage model policies" on public.model_policies
  for all using (owner_id is null or auth.uid() = owner_id) with check (owner_id is null or auth.uid() = owner_id);

drop policy if exists "Owners manage model runs" on public.model_runs;
create policy "Owners manage model runs" on public.model_runs
  for all using (owner_id is null or auth.uid() = owner_id) with check (owner_id is null or auth.uid() = owner_id);

insert into public.model_providers (name, base_url, api_key_env, enabled, notes)
values
  ('openai', 'https://api.openai.com/v1', 'OPENAI_API_KEY', true, 'First-stage real provider'),
  ('openrouter', 'https://openrouter.ai/api/v1', 'OPENROUTER_API_KEY', false, 'Adapter placeholder'),
  ('litellm', null, 'LITELLM_API_KEY', false, 'Adapter placeholder')
on conflict do nothing;

insert into public.model_policies (name, agent_role, task_type, risk_level, primary_provider, primary_model, fallback_provider, fallback_model, temperature, max_tokens, cost_level, enabled)
values
  ('strong_reasoning', 'leader', null, null, 'openai', 'gpt-4o', 'openai', 'gpt-4o-mini', 0.2, 3000, 'high', true),
  ('review_policy', 'reviewer', null, null, 'openai', 'gpt-4o', 'openai', 'gpt-4o-mini', 0.1, 2500, 'high', true),
  ('creative_content', null, 'content', null, 'openai', 'gpt-4o-mini', 'openai', 'gpt-4o-mini', 0.7, 2500, 'medium', true),
  ('creative_social', null, 'social', null, 'openai', 'gpt-4o-mini', 'openai', 'gpt-4o-mini', 0.7, 1800, 'medium', true),
  ('low_cost', null, 'simple', null, 'openai', 'gpt-4o-mini', 'openai', 'gpt-4o-mini', 0.2, 1200, 'low', true),
  ('data_table', null, 'data', null, 'openai', 'gpt-4o-mini', 'openai', 'gpt-4o-mini', 0.1, 1600, 'low', true),
  ('coding_policy', null, 'code', null, 'openai', 'gpt-4o', 'openai', 'gpt-4o-mini', 0.2, 3000, 'high', true),
  ('automation_policy', null, 'automation', null, 'openai', 'gpt-4o', 'openai', 'gpt-4o-mini', 0.2, 3000, 'high', true),
  ('high_risk_strong', null, null, 'high', 'openai', 'gpt-4o', 'openai', 'gpt-4o-mini', 0.1, 3000, 'high', true)
on conflict do nothing;
