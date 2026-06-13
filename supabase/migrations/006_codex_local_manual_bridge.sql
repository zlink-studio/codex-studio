insert into public.model_providers (name, display_name, base_url, api_key_env, enabled, status, notes)
select 'codex_local', 'Codex Local OAuth', null, 'CODEX_LOCAL_BASE_URL', true, 'missing_key',
  'Local Codex/OpenClaw OAuth gateway. Requires a local OpenAI-compatible gateway; no ChatGPT web cookie extraction.'
where not exists (select 1 from public.model_providers where owner_id is null and name = 'codex_local');

insert into public.model_providers (name, display_name, base_url, api_key_env, enabled, status, notes)
select 'manual_bridge', 'ChatGPT Manual Bridge', null, 'LLM_NO_KEY_MODE', true, 'missing_key',
  'Manual no-key bridge. Copy the generated prompt to ChatGPT web and paste structured JSON back.'
where not exists (select 1 from public.model_providers where owner_id is null and name = 'manual_bridge');

insert into public.model_catalog (provider, model, display_name, context_window, input_cost_per_1m, output_cost_per_1m, capabilities, recommended_use, enabled, notes)
select provider, model, display_name, context_window, input_cost_per_1m, output_cost_per_1m, capabilities, recommended_use, enabled, notes
from (
  values
    ('codex_local', 'openai/gpt-4o', 'Codex Local GPT-4o', 128000, null::numeric, null::numeric, array['chat','json','tools'], array['strong_reasoning','review_policy','coding'], true, 'Local Codex/OpenClaw OAuth gateway'),
    ('codex_local', 'openai/gpt-4o-mini', 'Codex Local GPT-4o mini', 128000, null::numeric, null::numeric, array['chat','json'], array['low_cost','creative_content'], true, 'Local Codex/OpenClaw OAuth gateway'),
    ('manual_bridge', 'chatgpt-web-manual', 'ChatGPT Web Manual', null::integer, null::numeric, null::numeric, array['chat','json'], array['no_api_key','manual_review'], true, 'Manual no-key bridge')
) as models(provider, model, display_name, context_window, input_cost_per_1m, output_cost_per_1m, capabilities, recommended_use, enabled, notes)
where not exists (
  select 1
  from public.model_catalog
  where owner_id is null
    and model_catalog.provider = models.provider
    and model_catalog.model = models.model
);

insert into public.model_policies (name, description, primary_provider, primary_model, fallback_provider, fallback_model, temperature, max_tokens, cost_level, enabled)
select 'codex_local_default', 'Local Codex/OpenClaw OAuth gateway mode.', 'codex_local', 'openai/gpt-4o-mini', 'manual_bridge', 'chatgpt-web-manual', 0.2, 3000, 'low', true
where not exists (select 1 from public.model_policies where owner_id is null and name = 'codex_local_default');

insert into public.model_policies (name, description, primary_provider, primary_model, fallback_provider, fallback_model, temperature, max_tokens, cost_level, enabled)
select 'manual_bridge', 'Manual ChatGPT web bridge mode.', 'manual_bridge', 'chatgpt-web-manual', 'manual_bridge', 'chatgpt-web-manual', 0.2, 3000, 'low', true
where not exists (select 1 from public.model_policies where owner_id is null and name = 'manual_bridge');
