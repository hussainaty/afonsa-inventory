# Graph Report - afonsa inventory  (2026-10-11)

## Corpus Check
- 98 files · ~51,708 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 605 nodes · 1630 edges · 28 communities (26 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.77)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0759bdc7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- DB
- catalog.ts
- actions.ts
- images.ts
- dependencies
- useServerForm
- app-nav.tsx
- compilerOptions
- devDependencies
- auth.ts
- schema.ts
- apple-icon.tsx
- context.ts
- app/layout.tsx
- onboarding/page.tsx
- invite/[id]/page.tsx
- Jury (4 jurors, blind, one lens each; orchestrator acted as judge and verified every finding in code)
- Afonsa Inventory
- Research: how this app compares with Odoo Inventory and community-built Odoo inventory apps
- journey.spec.ts
- eslint.config.mjs
- vercel.json
- next.config.ts
- AGENTS.md
- postcss.config.mjs

## God Nodes (most connected - your core abstractions)
1. `DB` - 72 edges
2. `requirePageContext()` - 31 edges
3. `requireActionContext()` - 31 edges
4. `run()` - 29 edges
5. `refreshApp()` - 26 edges
6. `useServerForm()` - 21 edges
7. `formatQty()` - 20 edges
8. `newId()` - 17 edges
9. `requireManager()` - 17 edges
10. `idOf()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `createDb()`  [EXTRACTED]
  scripts/migrate.ts → src/db/index.ts
- `AppLayout()` --calls--> `requirePageContext()`  [EXTRACTED]
  src/app/(app)/layout.tsx → src/server/context.ts
- `WorkspaceForm()` --indirect_call--> `createWorkspaceAction()`  [INFERRED]
  src/components/forms/workspace-form.tsx → src/app/actions.ts
- `CategoryForm()` --indirect_call--> `saveCategoryAction()`  [INFERRED]
  src/components/forms/category-form.tsx → src/app/actions.ts
- `OperationForm()` --indirect_call--> `createOperationAction()`  [INFERRED]
  src/components/forms/operation-form.tsx → src/app/actions.ts

## Import Cycles
- None detected.

## Communities (28 total, 2 thin omitted)

### Community 0 - "DB"
Cohesion: 0.08
Nodes (74): External dependency: lucide_react, External dependency: next, External dependency: next_link, CategoriesPage(), metadata, DashboardPage(), metadata, HistoryPage() (+66 more)

### Community 1 - "catalog.ts"
Cohesion: 0.06
Nodes (78): External dependency: dotenv_config, External dependency: drizzle_kit, External dependency: drizzle_orm_pglite, External dependency: drizzle_orm_pglite_migrator, External dependency: drizzle_orm_postgres_js, External dependency: drizzle_orm_postgres_js_migrator, External dependency: electric_sql_pglite, External dependency: node_fs (+70 more)

### Community 2 - "actions.ts"
Cohesion: 0.09
Nodes (62): External dependency: zod, acceptInvitationAction(), addStockNewSizeAction(), adjustStockAction(), archiveLocationAction(), cancelInvitationAction(), cancelOperationAction(), countStockAction() (+54 more)

### Community 3 - "images.ts"
Cohesion: 0.07
Nodes (31): External dependency: aws_sdk_client_s3, External dependency: aws_sdk_s3_request_presigner, External dependency: better_auth_cookies, External dependency: drizzle_orm, External dependency: next_cache, External dependency: next_server, External dependency: node_fs_promises, External dependency: node_path (+23 more)

### Community 4 - "dependencies"
Cohesion: 0.05
Nodes (39): @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, better-auth, drizzle-orm, @electric-sql/pglite, lucide-react, next, dependencies (+31 more)

### Community 5 - "useServerForm"
Cohesion: 0.12
Nodes (25): External dependency: react, External dependency: react_dom, ActionState, Cat, CategoryForm(), SWATCHES, NewLocationForm(), NewWarehouseForm() (+17 more)

### Community 6 - "app-nav.tsx"
Cohesion: 0.08
Nodes (22): External dependency: better_auth_client_plugins, External dependency: better_auth_react, External dependency: next_navigation, findByCodeAction(), AppLayout(), metadata, metadata, isActive() (+14 more)

### Community 7 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 8 - "devDependencies"
Cohesion: 0.07
Nodes (27): dotenv, drizzle-kit, eslint, eslint-config-next, devDependencies, dotenv, drizzle-kit, eslint (+19 more)

### Community 9 - "auth.ts"
Cohesion: 0.14
Nodes (14): External dependency: better_auth, External dependency: better_auth_adapters_drizzle, External dependency: better_auth_api, External dependency: better_auth_next_js, External dependency: better_auth_plugins, ALLOWED, GET(), handler (+6 more)

### Community 10 - "schema.ts"
Cohesion: 0.12
Nodes (12): External dependency: drizzle_orm_pg_core, account, inventory, LOCATION_TYPES, LocationType, OPERATION_STATES, OPERATION_TYPES, OperationState (+4 more)

### Community 11 - "apple-icon.tsx"
Cohesion: 0.18
Nodes (7): External dependency: next_og, contentType, size, contentType, size, SIZES, BrandMark()

### Community 12 - "context.ts"
Cohesion: 0.20
Nodes (10): External dependency: next_headers, metadata, ROLE_HELP, CopyLink(), InviteForm(), member, user, Context (+2 more)

### Community 13 - "app/layout.tsx"
Cohesion: 0.22
Nodes (7): External dependency: next_font_google, Imported asset: globals.css, geistMono, geistSans, metadata, viewport, ServiceWorker()

### Community 14 - "onboarding/page.tsx"
Cohesion: 0.27
Nodes (4): metadata, OnboardingPage(), CenteredShell(), WorkspaceForm()

### Community 15 - "invite/[id]/page.tsx"
Cohesion: 0.32
Nodes (6): InvitePage(), metadata, Home(), invitation, organization, getContext

### Community 16 - "Jury (4 jurors, blind, one lens each; orchestrator acted as judge and verified every finding in code)"
Cohesion: 0.25
Nodes (7): Confirmed and fixed, Confirmed, not fixed (follow-ups), Dissent preserved, Jury (4 jurors, blind, one lens each; orchestrator acted as judge and verified every finding in code), Open questions (Phase 2 gate), Testing report — project, Workflow state

### Community 17 - "Afonsa Inventory"
Cohesion: 0.29
Nodes (6): Afonsa Inventory, Deploying (Vercel + Supabase, free tiers), Features, Local development, Stack, Tests

### Community 18 - "Research: how this app compares with Odoo Inventory and community-built Odoo inventory apps"
Cohesion: 0.29
Nodes (6): Evidence cards, Proposed next options (PROPOSED, ranked by value for one warehouse of parts on phones), Research: how this app compares with Odoo Inventory and community-built Odoo inventory apps, Where Odoo and its community apps are ahead (not in this app), Where this app follows the leads, Where this app is ahead for this specific user (inference, not a general claim)

### Community 19 - "journey.spec.ts"
Cohesion: 0.40
Nodes (3): External dependency: playwright_test, stockDialog(), stockPanel()

### Community 20 - "eslint.config.mjs"
Cohesion: 0.40
Nodes (4): eslintConfig, External dependency: eslint_config, External dependency: eslint_config_next_core_web_vitals, External dependency: eslint_config_next_typescript

### Community 21 - "vercel.json"
Cohesion: 0.40
Nodes (4): fra1, crons, regions, $schema

### Community 22 - "next.config.ts"
Cohesion: 0.50
Nodes (3): csp, nextConfig, securityHeaders

## Knowledge Gaps
- **173 isolated node(s):** `eslintConfig`, `csp`, `securityHeaders`, `nextConfig`, `name` (+168 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `DB` connect `DB` to `catalog.ts`, `actions.ts`, `images.ts`, `auth.ts`, `context.ts`, `invite/[id]/page.tsx`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **Why does `requirePageContext()` connect `DB` to `context.ts`, `app-nav.tsx`, `invite/[id]/page.tsx`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `csp`, `securityHeaders` to the rest of the system?**
  _173 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DB` be split into smaller, more focused modules?**
  _Cohesion score 0.0785413744740533 - nodes in this community are weakly interconnected._
- **Should `catalog.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.057387057387057384 - nodes in this community are weakly interconnected._
- **Should `actions.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09262510974539069 - nodes in this community are weakly interconnected._
- **Should `images.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07419712070874862 - nodes in this community are weakly interconnected._