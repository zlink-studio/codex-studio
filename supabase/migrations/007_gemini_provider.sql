update public.model_providers
set
  display_name = 'Google Gemini',
  base_url = 'https://generativelanguage.googleapis.com',
  api_key_env = 'GEMINI_API_KEY',
  enabled = true,
  status = 'missing_key',
  notes = 'Real Gemini API provider. Uses GEMINI_API_KEY and supports Free Tier where available.',
  updated_at = now()
where owner_id is null and name = 'gemini';

insert into public.model_providers (name, display_name, base_url, api_key_env, enabled, status, notes)
select 'gemini', 'Google Gemini', 'https://generativelanguage.googleapis.com', 'GEMINI_API_KEY', true, 'missing_key',
  'Real Gemini API provider. Uses GEMINI_API_KEY and supports Free Tier where available.'
where not exists (select 1 from public.model_providers where owner_id is null and name = 'gemini');

delete from public.model_catalog
where owner_id is null and provider = 'gemini' and model = 'gemini-placeholder';

insert into public.model_catalog (provider, model, display_name, context_window, input_cost_per_1m, output_cost_per_1m, capabilities, recommended_use, enabled, notes)
select provider, model, display_name, context_window, input_cost_per_1m, output_cost_per_1m, capabilities, recommended_use, enabled, notes
from (
  values
    ('gemini', 'gemini-3.1-flash-lite', 'Gemini 3.1 Flash Lite', 1000000, 0::numeric, 0::numeric, array['chat','json','vision','long_context'], array['low_cost','content','data','long_context'], true, 'Gemini API Free Tier friendly model'),
    ('gemini', 'gemini-3.1-flash', 'Gemini 3.1 Flash', 1000000, 0::numeric, 0::numeric, array['chat','json','vision','long_context'], array['creative_content','business_english','memory'], true, 'Gemini API Flash model'),
    ('gemini', 'gemini-3.1-pro', 'Gemini 3.1 Pro', 1000000, null::numeric, null::numeric, array['chat','json','vision','long_context'], array['strong_reasoning','review_policy','long_context'], true, 'Gemini Pro model; usage depends on Google AI Studio or Cloud quota')
) as models(provider, model, display_name, context_window, input_cost_per_1m, output_cost_per_1m, capabilities, recommended_use, enabled, notes)
where not exists (
  select 1
  from public.model_catalog
  where owner_id is null
    and model_catalog.provider = models.provider
    and model_catalog.model = models.model
);

insert into public.model_policies (name, description, task_type, primary_provider, primary_model, fallback_provider, fallback_model, temperature, max_tokens, cost_level, enabled)
select 'gemini_free', 'Gemini API Free Tier friendly policy for data, content, and long-context organization.', 'data',
  'gemini', 'gemini-3.1-flash-lite', 'codex_local', 'openai/gpt-5.5', 0.2, 3000, 'low', true
where not exists (select 1 from public.model_policies where owner_id is null and name = 'gemini_free');
