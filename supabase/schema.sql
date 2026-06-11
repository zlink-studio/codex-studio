create extension if not exists "uuid-ossp";
create extension if not exists vector;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  role text not null default 'owner',
  created_at timestamptz not null default now()
);

create table if not exists public.agents (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  department text not null,
  title text not null,
  manager_id uuid references public.agents(id) on delete set null,
  model text not null default 'gpt-4o-mini',
  prompt text not null,
  tool_permissions text[] not null default '{}',
  status text not null default 'idle',
  agent_role text not null default 'worker',
  skills text[] not null default '{}',
  workload integer not null default 0,
  preferred_model_policy text,
  fallback_model text,
  last_heartbeat_at timestamptz,
  current_focus text,
  success_rate numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  client_name text not null,
  objective text not null,
  client_profile text,
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  stage text not null default 'planning',
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_agents (
  project_id uuid not null references public.projects(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, agent_id)
);

create table if not exists public.memory_categories (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.users(id) on delete cascade,
  name text not null,
  type text not null,
  parent_id uuid references public.memory_categories(id) on delete cascade,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  assigned_agent_id uuid references public.agents(id) on delete set null,
  title text not null,
  description text not null,
  task_type text not null default 'general',
  priority text not null default 'medium',
  risk_level text not null default 'low',
  status text not null default 'todo',
  board_status text not null default 'todo',
  approval_status text not null default 'not_required',
  review_status text not null default 'not_required',
  estimated_cost numeric not null default 0,
  actual_cost numeric not null default 0,
  parent_task_id uuid references public.tasks(id) on delete set null,
  sort_order integer not null default 0,
  due_at timestamptz,
  outputs jsonb not null default '[]'::jsonb,
  created_by text not null default 'owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memories (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  type text not null,
  scope text not null default 'global',
  category_id uuid references public.memory_categories(id) on delete set null,
  client_name text,
  project_id uuid references public.projects(id) on delete set null,
  agent_id uuid references public.agents(id) on delete set null,
  content text not null,
  summary text,
  tags text[] not null default '{}',
  related_client text,
  importance integer not null default 3 check (importance >= 1 and importance <= 5),
  confidence numeric not null default 0.8 check (confidence >= 0 and confidence <= 1),
  status text not null default 'approved',
  visibility text not null default 'owner',
  source_type text not null default 'manual',
  source_id text,
  source_url text,
  created_by text,
  approved_by text,
  last_accessed_at timestamptz,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memory_relations (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.users(id) on delete cascade,
  memory_id uuid not null references public.memories(id) on delete cascade,
  related_type text not null,
  related_id text not null,
  relation_type text not null,
  created_at timestamptz not null default now()
);

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

create table if not exists public.knowledge_sources (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.users(id) on delete cascade,
  name text not null,
  type text not null,
  source_url text,
  sync_mode text not null default 'manual',
  status text not null default 'active',
  last_synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meetings (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.users(id) on delete cascade,
  topic text not null,
  host_agent_id uuid references public.agents(id) on delete set null,
  participant_agent_ids uuid[] not null default '{}',
  conclusion text,
  action_items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.meeting_messages (
  id uuid primary key default uuid_generate_v4(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.approvals (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  requested_by_agent_id uuid references public.agents(id) on delete set null,
  status text not null default 'pending',
  reason text not null,
  decision_note text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_runs (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  status text not null default 'queued',
  model text,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  cost numeric not null default 0,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.task_logs (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  run_id uuid references public.agent_runs(id) on delete set null,
  type text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.quality_reviews (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  reviewer_agent_id uuid references public.agents(id) on delete set null,
  status text not null default 'pending',
  score integer,
  checklist jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
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

create table if not exists public.daily_reports (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.users(id) on delete cascade,
  report_date date not null,
  summary text not null,
  wins jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  next_actions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (owner_id, report_date)
);

create table if not exists public.tool_connections (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  name text not null,
  config jsonb not null default '{}'::jsonb,
  is_enabled boolean not null default true,
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists agents_owner_status_idx on public.agents(owner_id, status);
create index if not exists projects_owner_stage_idx on public.projects(owner_id, stage);
create index if not exists tasks_owner_status_idx on public.tasks(owner_id, status);
create index if not exists tasks_owner_board_status_idx on public.tasks(owner_id, board_status, sort_order);
create index if not exists tasks_risk_approval_idx on public.tasks(owner_id, risk_level, approval_status);
create index if not exists approvals_owner_status_idx on public.approvals(owner_id, status);
create index if not exists memory_categories_owner_type_idx on public.memory_categories(owner_id, type, sort_order);
create index if not exists memories_owner_type_idx on public.memories(owner_id, type);
create index if not exists memories_owner_status_idx on public.memories(owner_id, status, scope);
create index if not exists memories_category_idx on public.memories(category_id, status);
create index if not exists memories_project_agent_idx on public.memories(project_id, agent_id);
create index if not exists memory_relations_memory_idx on public.memory_relations(memory_id, relation_type);
create index if not exists memory_review_owner_status_idx on public.memory_review_queue(owner_id, review_status);
create index if not exists memory_access_logs_memory_idx on public.memory_access_logs(memory_id, created_at);
create index if not exists knowledge_sources_owner_type_idx on public.knowledge_sources(owner_id, type, status);
create index if not exists agent_runs_owner_status_idx on public.agent_runs(owner_id, status);
create index if not exists task_logs_task_created_idx on public.task_logs(task_id, created_at);
create index if not exists quality_reviews_owner_status_idx on public.quality_reviews(owner_id, status);
create index if not exists model_policies_lookup_idx on public.model_policies(agent_role, task_type, risk_level, enabled);
create index if not exists model_runs_agent_run_idx on public.model_runs(agent_run_id, created_at);

alter table public.users enable row level security;
alter table public.agents enable row level security;
alter table public.projects enable row level security;
alter table public.project_agents enable row level security;
alter table public.tasks enable row level security;
alter table public.memory_categories enable row level security;
alter table public.memories enable row level security;
alter table public.memory_embeddings enable row level security;
alter table public.memory_relations enable row level security;
alter table public.memory_review_queue enable row level security;
alter table public.memory_access_logs enable row level security;
alter table public.knowledge_sources enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_messages enable row level security;
alter table public.approvals enable row level security;
alter table public.agent_runs enable row level security;
alter table public.task_logs enable row level security;
alter table public.quality_reviews enable row level security;
alter table public.model_providers enable row level security;
alter table public.model_policies enable row level security;
alter table public.model_runs enable row level security;
alter table public.daily_reports enable row level security;
alter table public.tool_connections enable row level security;

create policy "Users can read own profile" on public.users
  for select using (auth.uid() = id);

create policy "Owners manage agents" on public.agents
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "Owners manage projects" on public.projects
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "Owners manage project agents" on public.project_agents
  for all using (
    exists (
      select 1 from public.projects
      where projects.id = project_agents.project_id
      and projects.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.projects
      where projects.id = project_agents.project_id
      and projects.owner_id = auth.uid()
    )
  );

create policy "Owners manage tasks" on public.tasks
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "Owners manage memory categories" on public.memory_categories
  for all using (owner_id is null or auth.uid() = owner_id) with check (owner_id is null or auth.uid() = owner_id);

create policy "Owners manage memories" on public.memories
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "Owners manage memory embeddings" on public.memory_embeddings
  for all using (
    exists (
      select 1 from public.memories
      where memories.id = memory_embeddings.memory_id
      and memories.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.memories
      where memories.id = memory_embeddings.memory_id
      and memories.owner_id = auth.uid()
    )
  );

create policy "Owners manage memory relations" on public.memory_relations
  for all using (owner_id is null or auth.uid() = owner_id) with check (owner_id is null or auth.uid() = owner_id);

create policy "Owners manage memory review queue" on public.memory_review_queue
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "Owners manage memory access logs" on public.memory_access_logs
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "Owners manage knowledge sources" on public.knowledge_sources
  for all using (owner_id is null or auth.uid() = owner_id) with check (owner_id is null or auth.uid() = owner_id);

create policy "Owners manage meetings" on public.meetings
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "Owners manage meeting messages" on public.meeting_messages
  for all using (
    exists (
      select 1 from public.meetings
      where meetings.id = meeting_messages.meeting_id
      and meetings.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.meetings
      where meetings.id = meeting_messages.meeting_id
      and meetings.owner_id = auth.uid()
    )
  );

create policy "Owners manage approvals" on public.approvals
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "Owners manage agent runs" on public.agent_runs
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "Owners manage task logs" on public.task_logs
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "Owners manage quality reviews" on public.quality_reviews
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "Owners manage model providers" on public.model_providers
  for all using (owner_id is null or auth.uid() = owner_id) with check (owner_id is null or auth.uid() = owner_id);

create policy "Owners manage model policies" on public.model_policies
  for all using (owner_id is null or auth.uid() = owner_id) with check (owner_id is null or auth.uid() = owner_id);

create policy "Owners manage model runs" on public.model_runs
  for all using (owner_id is null or auth.uid() = owner_id) with check (owner_id is null or auth.uid() = owner_id);

create policy "Owners manage daily reports" on public.daily_reports
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "Owners manage tool connections" on public.tool_connections
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
