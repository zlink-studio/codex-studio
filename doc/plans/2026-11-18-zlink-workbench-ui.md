# ZLink trial workbench UI

User-authorized local customization of stable v2026.1106.0. Present existing work more clearly without introducing orchestration services or changing execution, approval, model-account, or storage behavior.

## Composition

- Put actionable work, task search, recent deliverables and the agent team above historical charts.
- Keep live runs visible whenever agents are running. Keep existing warnings, plugins, activity and charts, with inactive statistics in disclosure sections.
- Use the native new-task dialog and company-aware task, inbox, agent and artifact destinations.
- Translate primary sidebar labels and the new home surface into Chinese. Other existing screens retain their original language.
- Define all new visual values in the `--zlink-*` token layer in `ui/src/index.css`, with neutral light/dark surfaces and one restrained accent.
- Keep the upstream dashboard accessible in the existing design sandbox.

## Data and limits

Use existing company-scoped dashboard, issue and agent queries. The recent-deliverables panel reads the existing artifact gallery (limit three). When that gallery is empty, read document lists for only the three most recently updated completed tasks, reusing canonical document cache keys. This bounded fallback includes board-authored task documents; it is not a complete company-wide document index. Search/filter apply to the already loaded task list, with at most six rows displayed. Costs are reported API costs; subscription allowances are not inferred.

## Verification

Production build; UI TypeScript; existing dashboard and sidebar tests; token gates; Git whitespace checks. Dedicated Agent Chrome acceptance covers task search/clear, native new-task dialog, opening an existing task document, and desktop/tablet/mobile overflow. These checks do not run agents or submit tasks. The Storybook story provides mixed, empty and read-error fixture states, without claiming live behavior.

## Running locally

The independent trial backend remains at port 3100. The customized production frontend is at port 3101 and proxies the same backend. Machine-specific trial startup scripts remain outside the source repository. For portable development/build commands, see `ZLINK.md`. This source handoff does not deploy a running site.

## Second visual pass: YunJing TS references

At the user's request, inspected Modern HR Dashboard, Dashboard UI, Task Engine and Autonomous Ops in the authenticated YunJing TS gallery at https://ts.leess.fun/. Adapted the first two references into independent metric cards, a task/team/deliverable module grid, paper-style document previews, and restrained violet/light-dark tokens. No third-party prompt text, remote media, or external font dependency is included in the source. Query behavior, control-plane contracts and issue/document destinations remain unchanged. Local research and the original ZLink-specific implementation prompt are in the parent ZLink planning workspace.

## Supplied logo integration

The user explicitly authorized replacing the sidebar mark and browser icon with their ZLink logo. Use the supplied standalone Z for legibility at small sizes, prepared as PNG/ICO sizes under `ui/public/brands/zlink/`. The dashboard header uses the same mark. The sidebar uses the native company-logo asset setting for the selected company, without hard-coding branding into the organization switcher or affecting other companies. The local trial records the prior and new logo metadata for rollback. Browser icons and the installed-shortcut manifest use new asset URLs; the underlying platform title and control-plane behavior remain unchanged.
