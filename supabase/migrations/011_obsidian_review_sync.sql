create unique index if not exists memories_owner_obsidian_source_idx
  on public.memories(owner_id, source_id)
  where source_type = 'obsidian' and source_id is not null;
