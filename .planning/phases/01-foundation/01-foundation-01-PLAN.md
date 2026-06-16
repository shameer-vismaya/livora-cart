---
phase: 01-foundation
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - nx.json
  - tsconfig.base.json
  - .eslintrc.json
  - .prettierrc
  - jest.config.ts
  - jest.preset.js
  - libs/contracts/src/index.ts
  - libs/config/src/index.ts
  - libs/observability/src/index.ts
  - libs/contracts/project.json
  - libs/config/project.json
  - libs/observability/project.json
  - README.md
autonomous: true
must_haves:
  truths:
    - "nx build/lint/test run green on an empty workspace"
    - "Three shared libs are importable via @livora/* path aliases"
  artifacts:
    - "nx.json + package.json (pnpm) workspace"
    - "libs/contracts, libs/config, libs/observability"
    - "tsconfig.base.json path aliases @livora/*"
  key_links:
    - "tsconfig path aliases -> libs resolve at build time"
    - "jest preset -> libs test targets run"
---

<objective>
Scaffold the Nx + pnpm + TypeScript monorepo and the three foundational shared libraries every Livora Cart service will depend on.

Purpose: One toolchain, affected-only builds, and shared contracts/config/observability so the ~14–16 services stay consistent (per research/STACK.md §1).
Output: A buildable empty Nx workspace with `@livora/contracts`, `@livora/config`, `@livora/observability` libs and root lint/format/test tooling.
</objective>

<context>
@.planning/PROJECT.md
@.planning/research/STACK.md
@.planning/phases/01-foundation/CONTEXT.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Initialize Nx + pnpm + TypeScript workspace with tooling</name>
  <files>package.json, nx.json, tsconfig.base.json, .eslintrc.json, .prettierrc, jest.config.ts, jest.preset.js, .gitignore, README.md</files>
  <action>Initialize an integrated Nx monorepo using pnpm as the package manager (`npx create-nx-workspace@latest . --preset=ts --pm=pnpm --nx-cloud=skip` semantics — but author files directly to avoid interactive prompts). Pin Node 20 LTS in package.json `engines`. Configure: nx.json with `@nx/js`, `@nx/eslint`, `@nx/jest` plugins and target defaults (build, lint, test) with caching; tsconfig.base.json with `compilerOptions.paths` for `@livora/contracts`, `@livora/config`, `@livora/observability`; root ESLint (typescript-eslint, import ordering) + Prettier; Jest preset. Add npm scripts: `build`, `lint`, `test`, `format`. Update the existing root .gitignore if needed (do not remove existing entries). Do NOT add Kubernetes/Terraform/CI config — out of scope this phase.</action>
  <verify>`pnpm install` succeeds; `pnpm nx run-many -t lint` and `pnpm nx run-many -t test` exit 0 on the empty workspace; `pnpm nx graph --file=/tmp/g.json` produces a graph.</verify>
  <done>Workspace installs and `nx` build/lint/test targets run green with no projects errors.</done>
</task>

<task type="auto">
  <name>Task 2: Generate the three shared libraries with starter exports</name>
  <files>libs/contracts/src/index.ts, libs/contracts/project.json, libs/config/src/index.ts, libs/config/project.json, libs/observability/src/index.ts, libs/observability/project.json</files>
  <action>Generate three buildable TS libs via `nx g @nx/js:lib` (or author equivalently): (1) `contracts` — placeholder for Avro/event + DTO types; export an example `interface DomainEvent { eventId: string; type: string; aggregateId: string; occurredAt: string; payload: unknown }` and an `IdempotencyKey` type. (2) `config` — a typed env loader using zod: export `loadEnv(schema)` that validates `process.env` and throws on missing keys. (3) `observability` — export a `createTelemetry(serviceName: string)` stub that will later wire the OpenTelemetry NodeSDK (leave a TODO referencing Plan 04). Each lib gets a trivial unit test so `nx test` has coverage. Wire all three into tsconfig.base.json paths (done in Task 1) and confirm cross-import works (add a temporary import in a test, then remove).</action>
  <verify>`pnpm nx test contracts config observability` passes; importing `@livora/config` from a scratch test resolves the path alias.</verify>
  <done>Three libs build, test green, and are importable via `@livora/*` aliases.</done>
</task>

</tasks>

<verification>
- `pnpm install && pnpm nx run-many -t build,lint,test` is green.
- `@livora/contracts|config|observability` resolve from another project.
- No K8s/Terraform/CI artifacts introduced (deferred phase).
</verification>

<success_criteria>
- [ ] Nx + pnpm workspace builds clean
- [ ] 3 shared libs present, tested, alias-resolvable
- [ ] Root lint/format/test scripts work
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation/01-foundation-01-SUMMARY.md` noting Nx version, pnpm version, Node version, and the shared-lib public surfaces.
</output>
