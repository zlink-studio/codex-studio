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

alter table public.memories add column if not exists category_id uuid references public.memory_categories(id) on delete set null;
alter table public.memories add column if not exists source_url text;

create table if not exists public.memory_relations (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.users(id) on delete cascade,
  memory_id uuid not null references public.memories(id) on delete cascade,
  related_type text not null,
  related_id text not null,
  relation_type text not null,
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

create index if not exists memory_categories_owner_type_idx on public.memory_categories(owner_id, type, sort_order);
create index if not exists memories_category_idx on public.memories(category_id, status);
create index if not exists memory_relations_memory_idx on public.memory_relations(memory_id, relation_type);
create index if not exists knowledge_sources_owner_type_idx on public.knowledge_sources(owner_id, type, status);

alter table public.memory_categories enable row level security;
alter table public.memory_relations enable row level security;
alter table public.knowledge_sources enable row level security;

drop policy if exists "Owners manage memory categories" on public.memory_categories;
create policy "Owners manage memory categories" on public.memory_categories
  for all using (owner_id is null or auth.uid() = owner_id) with check (owner_id is null or auth.uid() = owner_id);

drop policy if exists "Owners manage memory relations" on public.memory_relations;
create policy "Owners manage memory relations" on public.memory_relations
  for all using (owner_id is null or auth.uid() = owner_id) with check (owner_id is null or auth.uid() = owner_id);

drop policy if exists "Owners manage knowledge sources" on public.knowledge_sources;
create policy "Owners manage knowledge sources" on public.knowledge_sources
  for all using (owner_id is null or auth.uid() = owner_id) with check (owner_id is null or auth.uid() = owner_id);
