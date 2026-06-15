# Initial Skill Import Report

## Scope

This report captures the first-pass skill library design for OneCo AI Workbench.
The current phase does not execute external scripts and does not auto-enable imported action skills.

## Candidate Sources

1. `openai/skills`
Repository use: curated Codex/OpenAI skills for planning, review, browser validation, deployment, and documentation.
License: see source repository.
Recommendation: yes, use as the main first-batch source.
Risk: low to medium depending on the individual skill.
Suitable agents: Executive, Operations, Product, Finance.
Suggested extraction: `define-goal`, `cli-creator`, `playwright`, `vercel-deploy`, `security-threat-model`, `gh-address-comments`.
Do not enable directly: any action-oriented skill that could publish, mutate, or trigger external systems without approval.
Next step: convert referenced skills into internal reviewed drafts under `skills/drafts/`.

2. `awesome-agent-skills`
Repository use: broad reference set for community skill patterns.
License: license review required.
Recommendation: reference only, do not enable directly.
Risk: medium because quality and operational boundaries may vary.
Suitable agents: Marketing, Sales, Research.
Suggested extraction: content research, SEO briefing, outbound drafting patterns.
Do not enable directly: anything with automation or outbound actions.
Next step: manually port safe instruction patterns into internal drafts.

3. `running-marketing-campaigns`
Repository use: campaign planning and operations references.
License: license review required.
Recommendation: partial reference only.
Risk: medium.
Suitable agents: Growth Marketing.
Suggested extraction: campaign planning workflow, testing matrix, reporting checklist.
Do not enable directly: ad spend mutations, live publishing.
Next step: convert into `content-planning` and `ads-analysis` style internal skills.

4. `agent-skills-marketing`
Repository use: marketing-oriented agent skill ideas.
License: license review required.
Recommendation: selective reference only.
Risk: medium.
Suitable agents: Growth Marketing.
Suggested extraction: audience segmentation, messaging frameworks, content calendar structure.
Do not enable directly: external posting or CRM mutation steps.
Next step: merge safe pieces into reviewed internal skill drafts.

5. `claude-seo`
Repository use: SEO workflow references.
License: license review required.
Recommendation: hold for review.
Risk: medium.
Suitable agents: Growth Marketing, Product.
Suggested extraction: keyword clustering, SEO briefing, page structure guidance.
Do not enable directly: automated publishing or backlink outreach.
Next step: treat as imported reference and keep disabled until review.

6. `agentic-seo-skill`
Repository use: SEO-oriented agent instructions.
License: license review required.
Recommendation: hold for review.
Risk: medium.
Suitable agents: Growth Marketing.
Suggested extraction: topic map generation, SEO task decomposition.
Do not enable directly: any live-site modifications.
Next step: merge safe text-only guidance into internal drafts.

## First-Batch Enablement Recommendation

- Enable now: `goal-breakdown`, `memory-capture`, `content-planning`, `data-cleanup`, `implementation-planning`, `review-gate`.
- Keep approval-gated: `automation-dispatch`.
- Keep disabled pending review: `seo-brief`, any imported skill with unclear license or external side effects.

## Safety Rules

- No imported skill is auto-enabled.
- No external repository script is executed.
- No API key is stored in skill instructions.
- High-risk action skills remain approval-gated.
