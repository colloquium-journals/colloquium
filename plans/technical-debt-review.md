# Technical Debt Review

Comprehensive review of the Colloquium codebase. Issues are organized by category and severity.

Items marked ~~strikethrough~~ have been resolved.

## Summary

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Hardcoded URLs & Config | ~~1~~ | - | - | - |
| Security | ~~1~~ | ~~1~~ | ~~1~~ | - |
| Data Fetching & Performance | - | ~~3~~ | ~~3~~ | - |
| Code Quality & Duplication | - | ~~2~~ | ~~4~~ | 2 |
| Type System & Schema | - | ~~2~~ | ~~1~~ | - |
| Documentation | - | ~~1~~ | ~~2~~ | 2 |
| Dependencies | ~~1~~ | ~~1~~ | ~~1~~ | - |
| Bot Developer Experience | - | ~~2~~ | ~~2~~ | 1 |
| Deployment Readiness | - | ~~1~~ | ~~2~~ | - |
| Testing | - | 1 | ~~2~~ | - |
| **Remaining** | **0** | **1** | **0** | **5** |

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

### ~~M1. `botActionProcessor.ts` is 1553 Lines~~ (RESOLVED)

Fixed: split into thin dispatcher (`botActionProcessor.ts`, ~80 lines) + 5 sub-modules in `botActions/`: `reviewerActions.ts`, `reviewActions.ts`, `editorialActions.ts`, `publicationActions.ts`, `conversationActions.ts`.

### ~~M2. `SubmissionHeader.tsx` is 1125 Lines~~ (RESOLVED)

Fixed: split into orchestrator (`SubmissionHeader.tsx`) + sub-components (`SubmissionMetadata.tsx`, `SubmissionEditPanel.tsx`, `SubmissionFilesSection.tsx`) and hooks (`useSubmissionData.ts`, `useFileOperations.ts`). Shared utilities in `submissionUtils.ts`.

### ~~M3. `bot-markdown-renderer/src/index.ts` is 1823 Lines~~ (RESOLVED)

Fixed: split into thin entry point (`index.ts`) + sub-modules: `commands/` (renderCommand, listCommand), `templates/` (templateManager, schemas), `rendering/` (pandocClient, assetProcessor), `files/` (fileClient), and `renderMarkdown.ts` public API.

### ~~M4. Race Condition in Deadline Reminder Scheduling~~ (RESOLVED)

Fixed: added nested try/catch around `scheduleReminderJob()` in both `scheduleRemindersForAssignment` and `scheduleOverdueRemindersForAssignment`. If job scheduling fails, the reminder record is updated to `FAILED` status before re-throwing.

### ~~M5. ESLint Config Forces Next.js/React Rules on All Packages~~ (RESOLVED)

Fixed: split into `base.mjs` (TypeScript + Prettier only), `react.mjs` (adds react-hooks), and `index.mjs` (full Next.js config). Added subpath exports to `packages/config/package.json`. Non-React packages import `@colloquium/eslint-config/base`, UI uses `@colloquium/eslint-config/react`, web app uses `@colloquium/eslint-config`.

### ~~M6. Incomplete `turbo.json` Dependencies~~ (RESOLVED)

Fixed: added `@colloquium/database#build` and `@colloquium/auth#build` to the `dev#@colloquium/api` task dependencies in `turbo.json`.

### ~~M7. Inconsistent Error Response Formats~~ (RESOLVED)

Fixed: created `apps/api/src/utils/errorResponse.ts` with standardized helpers (`errorResponse`, `errors.notFound`, `errors.forbidden`, etc.). Migrated `reviewers.ts` and `bot-management.ts` error responses to flat `{ error, message }` format. Updated test assertions.

### ~~M8. No Message Pagination~~ (RESOLVED)

Fixed: added cursor-based pagination to `GET /api/conversations/:id` with `?messageLimit=50&messageBefore=<messageId>` query params. Returns `hasMoreMessages` boolean. Defaults to most recent 50 messages.

### ~~M9. Workflow Config Queried on Every Request~~ (RESOLVED)

Fixed: extracted `apps/api/src/services/workflowConfig.ts` with 60-second TTL cache. Replaced duplicate local `getWorkflowConfig()` in `conversations.ts` and `events.ts`. Cache invalidated via `invalidateWorkflowConfigCache()` in settings update route.

### ~~M10. Username Generation Duplicated~~ (RESOLVED)

Fixed: extracted `apps/api/src/utils/usernameGeneration.ts` with `generateUniqueUsername(email)` (includes `bot-` prefix guard, padding, collision resolution). Replaced all 3 inline copies in `auth.ts`, `reviewers.ts`, and `botActionProcessor.ts`.

### ~~M11. Mantine Version Drift~~ (RESOLVED)

Fixed: aligned all Mantine packages to `^7.17.8` in both `apps/web/package.json` and `packages/ui/package.json`.

### ~~M12. Port Number Inconsistency in Docs~~ (RESOLVED)

Fixed in docs/README.md rewrite (H12).

### ~~M13. `create-colloquium-journal` README Has Wrong Bot Names~~ (RESOLVED)

Fixed: bot names corrected to `bot-editorial`, `bot-markdown-renderer`, `bot-reference-check`.

### ~~M14. Missing Database Indexes~~ (RESOLVED)

Fixed: added `@@index([status])` and `@@index([workflowPhase])` to manuscripts, `@@index([conversationId])` to messages, and `@@index([editorId])` to action_editors in Prisma schema.

### ~~M15. Bot Permission System Defined But Not Enforced~~ (RESOLVED)

Fixed: removed `bot_permissions` model from Prisma schema (no runtime code enforced it). Kept `permissions` field in bot manifest schema as informational metadata for future use.

### ~~M16. `bot-reviewer-checklist` Uses Hardcoded Mock Data~~ (RESOLVED)

Fixed: replaced mock data with real API calls using `context.config.apiUrl` and `context.serviceToken`. Added `authenticateWithBots` middleware to reviewer assignments endpoint for bot access.

### ~~M17. Fallback Session Secret~~ (RESOLVED)

Fixed: session secret now throws `SESSION_SECRET environment variable is required in production` if missing in production. Development fallback preserved.

### ~~M18. Legacy Auth Permission Functions Are Broken~~ (RESOLVED)

Fixed: deleted legacy `Role` enum, `Permission` enum, `hasPermission()`, `hasAnyPermission()`, `hasAllPermissions()` from auth package. Deleted `requirePermission` middleware. Migrated all callers to `requireGlobalPermission`/`GlobalPermission`. Also fixed a bug in `formats.ts` where `Permission.MANAGE_FORMATS` (nonexistent) silently denied all users — replaced with `GlobalPermission.MANAGE_JOURNAL_SETTINGS`.

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

All critical, high (except H16), and medium items are resolved. Remaining work:

**Next priorities:**
1. ~~Centralize API URL configuration (C1)~~ — DONE
2. Fix pre-existing test failures (H16)
3. ~~Split large files (M1, M2, M3)~~ — DONE
4. ~~Standardize error response format (M7)~~ — DONE
5. ~~Extract duplicated utilities (M10)~~ — DONE
6. ~~Split ESLint config (M5)~~ — DONE
7. ~~Add message pagination (M8)~~ — DONE
8. ~~Cache workflow config (M9)~~ — DONE
9. ~~Add database indexes (M14)~~ — DONE
10. ~~Fix deadline reminder race condition (M4)~~ — DONE
11. ~~Fix turbo.json dependencies (M6)~~ — DONE
12. ~~Fix fallback session secret (M17)~~ — DONE
13. ~~Clean up legacy auth functions (M18)~~ — DONE
14. Add missing tests (L4)
