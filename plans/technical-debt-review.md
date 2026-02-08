# Technical Debt Review

Comprehensive review of the Colloquium codebase. Issues are organized by category and severity.

Items marked ~~strikethrough~~ have been resolved.

## Summary

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Hardcoded URLs & Config | ~~1~~ | - | - | - |
| Security | ~~1~~ | ~~1~~ | 1 | - |
| Data Fetching & Performance | - | ~~3~~ | 3 | - |
| Code Quality & Duplication | - | ~~2~~ | 4 | 2 |
| Type System & Schema | - | ~~2~~ | 1 | - |
| Documentation | - | ~~1~~ | ~~2~~ | 2 |
| Dependencies | ~~1~~ | ~~1~~ | 1 | - |
| Bot Developer Experience | - | ~~2~~ | 2 | 1 |
| Deployment Readiness | - | ~~1~~ | 2 | - |
| Testing | - | 1 | 2 | - |
| **Remaining** | **0** | **1** | **16** | **5** |

---

## Critical

### ~~C1. Hardcoded `localhost:4000` Throughout Codebase~~ (RESOLVED)

Fixed: All production code and test files now use environment-based config (`API_URL` from `@/lib/api` in frontend, `process.env.API_URL || fallback` in backend/bots). Remaining `localhost:4000` references are only in docs/plans (example URLs) and config templates (`.env.example`, docker-compose defaults), which is intentional.

### ~~C2. Magic Link Secret Falls Back to Hardcoded Default~~ (RESOLVED)

Fixed: magic link functions removed; auth uses JWT exclusively.

### ~~C3. Express v4/v5 Version Mismatch~~ (RESOLVED)

Fixed: bot-markdown-renderer aligned to same Express version as rest of monorepo.

---

## High

### ~~H1. N+1 Query Problem in Conversations~~ (RESOLVED)

Fixed: added `batchPrefetchAuthorRoles()` to load all message author roles in 3 batch queries. Pre-computed `areAllReviewsComplete()` once per conversation load and threaded through visibility/masking functions.

### ~~H2. SSE Memory Leak — No Connection Timeout~~ (RESOLVED)

Fixed: added heartbeat (30s), stale connection sweep (60s), and 2-minute stale threshold.

### ~~H3. No Data Fetching Layer in Frontend~~ (RESOLVED)

Resolved by Next.js 16 upgrade: React 19 `use()` hook and Suspense replace the need for React Query.

### ~~H4. Email Transporter Created in 4+ Locations~~ (RESOLVED)

Fixed: extracted shared `emailService.ts`, all 4 consumers import from it.

### ~~H5. Synchronous File Operations Block Event Loop~~ (RESOLVED)

Fixed: multer callbacks converted to async `fs/promises`. Module-level init kept sync (one-time at startup).

### ~~H6. `UserRole` Enum Doesn't Match Prisma `GlobalRole`~~ (RESOLVED)

Fixed: removed `UserRole` enum from types package. Codebase uses `GlobalRole` from auth package.

### ~~H7. `ManuscriptStatus` Enum Missing `RETRACTED`~~ (RESOLVED)

Fixed: added `RETRACTED` to the TypeScript enum and `StatusBadge` component.

### ~~H8. `dangerouslySetInnerHTML` Without Sanitization~~ (RESOLVED)

Fixed: added `sanitizeHTML()` wrapper using `isomorphic-dompurify`. All 7 `dangerouslySetInnerHTML` call sites now sanitize.

### ~~H9. UI Package Build Output Broken~~ (RESOLVED)

Fixed: added `moduleResolution: "node"`, `baseUrl`, and `paths: {}` overrides to prevent root tsconfig's bundler settings from conflicting.

### ~~H10. 78 DEBUG Console Statements in Production Code~~ (RESOLVED)

Fixed: removed debug `console.log` from auth middleware, articles route, conversations route, and bot-markdown-renderer.

### ~~H11. CLAUDE.md Lists Wrong Review Assignment Statuses~~ (RESOLVED)

Fixed: corrected statuses to `PENDING`, added `SUPPLEMENTARY` to file types, fixed bot naming.

### ~~H12. docs/README.md Has 10+ Dead Links~~ (RESOLVED)

Fixed: rewrote README with links to existing documentation files.

### ~~H13. Bot Framework Hardcoded Paths~~ (RESOLVED)

Fixed: replaced hardcoded paths with `discoverLocalBotDirs()` dynamic discovery.

### ~~H14. No CI/CD Pipeline for Code Quality~~ (RESOLVED)

Fixed: added `.github/workflows/ci.yml` with lint, type-check, build, and test steps.

### ~~H15. `marked` Major Version Split~~ (RESOLVED)

Fixed: unified all packages on `marked` v15.0.12.

### H16. 12 Pre-existing Test Failures in `apps/web`

Test suite has pre-existing failures including missing `BotManagement` page component, `useSSE` auth wrapper issues, and stale test imports (`GlobalRole` from `@colloquium/database` instead of `@colloquium/auth`).

---

## Medium

### M1. `botActionProcessor.ts` is 1553 Lines

`apps/api/src/services/botActionProcessor.ts` handles 10+ action types (assign reviewer, update status, send email, publish, etc.) in a single file. Hard to test and maintain.

### M2. `SubmissionHeader.tsx` is 1125 Lines

`apps/web/src/components/submissions/SubmissionHeader.tsx` mixes data fetching, UI rendering, and business logic with 26+ `useState` calls and calls `window.location.reload()` on file upload success.

### M3. `bot-markdown-renderer/src/index.ts` is 1823 Lines

Handles file retrieval, template loading (5 levels of fallback), rendering, and asset processing in one file.

### M4. Race Condition in Deadline Reminder Scheduling

`apps/api/src/services/deadlineScanner.ts:68-102` — If `scheduleReminderJob()` fails after the `deadline_reminders` DB record is created, the reminder is orphaned (exists in DB but never executed).

### M5. ESLint Config Forces Next.js/React Rules on All Packages

`packages/config/index.js` imports `@next/eslint-plugin-next` and `react-hooks` rules globally. Non-React packages (API, bots, database, auth) shouldn't depend on these.

**Fix:** Split into base, React, and Next.js configs.

### M6. Incomplete `turbo.json` Dependencies

`turbo.json:16-17` only declares `@colloquium/bots#build` and `@colloquium/types#build` as API dev dependencies, but the API actually depends on all bot packages, database, and auth.

### M7. Inconsistent Error Response Formats

API routes use different error shapes:
- `{ error: 'message' }` in articles routes
- `{ error: { message: '...', type: '...' } }` in reviewer routes
- Mixed formats in conversations

### M8. No Message Pagination

`apps/api/src/routes/conversations.ts:308-354` loads all messages for a conversation in a single query with nested includes. Conversations with hundreds of messages will have slow response times.

### M9. Workflow Config Queried on Every Request

`getWorkflowConfig()` queries the database on every conversation request with no caching. This is static-ish data that changes rarely.

### M10. Username Generation Duplicated

The same username generation algorithm exists in `apps/api/src/routes/auth.ts:52-69`, `apps/api/src/routes/reviewers.ts`, and `apps/api/src/services/botActionProcessor.ts:122-132`.

### M11. Mantine Version Drift

`apps/web/package.json` mixes `@mantine/core: ^7.12.0` with `@mantine/hooks: ^7.17.8`. `packages/ui` uses `^7.12.0` for everything. Minor version drift can cause component behavior differences.

### ~~M12. Port Number Inconsistency in Docs~~ (RESOLVED)

Fixed in docs/README.md rewrite (H12).

### ~~M13. `create-colloquium-journal` README Has Wrong Bot Names~~ (RESOLVED)

Fixed: bot names corrected to `bot-editorial`, `bot-markdown-renderer`, `bot-reference-check`.

### M14. Missing Database Indexes

Schema lacks indexes on frequently queried columns:
- `manuscripts.status` and `manuscripts.workflowPhase` (used for filtering)
- `messages.conversationId` (foreign key, frequently joined)
- `action_editors.editorId` (queried to find editor's manuscripts)

### M15. Bot Permission System Defined But Not Enforced

`packages/bots/src/framework/plugin.ts:27` defines a `permissions` array in the bot schema, and `plugin.ts:85-98` defines a `BotRegistry` interface — neither is implemented or enforced at runtime.

### M16. `bot-reviewer-checklist` Uses Hardcoded Mock Data

`packages/bot-reviewer-checklist/src/index.ts:54-77` — `getAssignedReviewers()` is async but returns hardcoded mock data instead of querying the API.

### M17. Fallback Session Secret

`apps/api/src/app.ts:65` — Session secret falls back to `'fallback-secret-for-development'` instead of failing if the env var is missing.

### M18. Legacy Auth Permission Functions Are Broken

`packages/auth/src/index.ts:273-318` — Legacy `hasPermission()` only maps 4 permissions; all others return false. Any code using the legacy system has broken authorization.

---

## Low

### L1. No Prettier Configuration

No `.prettierrc` or `prettier.config.js` at the root. While ESLint extends `eslint-config-prettier`, Prettier itself isn't configured, so formatting isn't enforced.

### L2. Jest Root Config Missing Packages

Root `jest.config.js` only lists 7 of 13+ workspace packages. Missing packages aren't included in coverage reports when running from root.

### L3. Storybook Listed But Not Set Up

`packages/ui/package.json` includes Storybook as a devDependency but no `.storybook/` directory or stories exist.

### L4. `packages/auth` Has No Tests

Only a `tests/setup.ts` exists — no actual test files for JWT generation, magic link tokens, or permission checks.

### L5. Handlebars Template Security in Markdown Renderer

`packages/bot-markdown-renderer/src/index.ts:773-776` compiles Handlebars templates without input sanitization before compilation.

---

## Recommended Priority Order

**Phase 1 — Unblock deployment:**
1. Centralize API URL configuration (C1)

**Phase 2 — Code quality & testing:**
2. Fix pre-existing test failures (H16)
3. Split large files (M1, M2, M3)
4. Standardize error response format (M7)
5. Extract duplicated utilities (M10)
6. Split ESLint config (M5)

**Phase 3 — Performance & scalability:**
7. Add message pagination (M8)
8. Cache workflow config (M9)
9. Add database indexes (M14)

**Phase 4 — Robustness:**
10. Fix deadline reminder race condition (M4)
11. Fix turbo.json dependencies (M6)
12. Fix fallback session secret (M17)
13. Clean up legacy auth functions (M18)
14. Add missing tests (L4)
