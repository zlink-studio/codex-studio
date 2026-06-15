---
name: automation-dispatch
description: Design automation workflows and approval conditions without executing external actions.
---

# Automation Dispatch

## suitable_agents

Operations, Product

## when_to_use

Use when a workflow should be automated and an approval-safe design is needed.

## inputs

- workflow goal
- system boundaries
- approved memories

## outputs

- automation plan
- node sequence
- approval requirements
- rollback considerations

## workflow

1. Define trigger, inputs, and outputs.
2. Map the flow into safe steps.
3. Flag any external mutation as approval-gated.
4. Return the plan only.

## risk_level

high

## approval_required

true

## source_references

- internal design
- openai/skills `playwright`, `vercel-deploy` as related workflow references only

## notes

Never execute external actions directly in this phase.
