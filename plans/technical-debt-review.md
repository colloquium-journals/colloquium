# Technical Debt Review

Comprehensive review of the Colloquium codebase. Issues are organized by category and severity.

## Summary

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Hardcoded URLs & Config | 1 | - | - | - |
| Security | 1 | 2 | 1 | - |
| Data Fetching & Performance | - | 3 | 3 | - |
| Code Quality & Duplication | - | 2 | 4 | 2 |
| Type System & Schema | - | 2 | 1 | - |
| Documentation | - | 1 | 2 | 2 |
| Dependencies | 1 | 1 | 1 | - |
| Bot Developer Experience | - | 2 | 2 | 1 |
| Deployment Readiness | - | 1 | 2 | - |
| Testing | - | 1 | 2 | - |
| **Total** | **3** | **15** | **18** | **5** |

---

## Critical

### C1. Hardcoded `localhost:4000` Throughout Codebase

**178 occurrences across 69 files.** The API URL is hardcoded as `http://localhost:4000` everywhere — frontend components, bot packages, tests, and even documentation. This makes production deployment impossible without a find-and-replace.

**Affected areas (non-exhaustive):**
- `apps/web/src/contexts/AuthContext.tsx` — auth calls
- `apps/web/src/components/submissions/SubmissionHeader.tsx` — 6 occurrences
- `apps/web/src/app/admin/settings/page.tsx` — 22 occurrences
- `packages/bot-editorial/src/index.ts` — 4 occurrences, inconsistent (some use `context.config?.apiUrl || 'http://localhost:4000'`, some hardcode directly)
- `packages/bot-markdown-renderer/src/index.ts` — 10 occurrences
- `packages/bots/src/framework/pluginLoader.ts` — hardcoded in user search

**Fix:** Create a centralized `getApiUrl()` utility for the frontend using `NEXT_PUBLIC_API_URL`. For bots, enforce use of `context.config.apiUrl` and never fall back to hardcoded values.

### C2. Magic Link Secret Falls Back to Hardcoded Default

`packages/auth/src/index.ts:50,62` — Both `generateMagicLinkToken()` and `verifyMagicLinkToken()` fall back to `'default-secret'` when `MAGIC_LINK_SECRET` is not set. This is inconsistent with `generateJWT()` which throws an error when `JWT_SECRET` is missing. A misconfigured deployment would silently accept forged magic link tokens.

**Fix:** Throw an error when `MAGIC_LINK_SECRET` is not set, matching the JWT pattern.

### C3. Express v4/v5 Version Mismatch

`packages/bot-markdown-renderer/package.json:38` uses `express: ^5.1.0` while everything else uses `express: ^4.18.2`. Express v5 has breaking API changes.

**Fix:** Upgrade everything to `^5.1.0` for consistency.

---

## High

### H1. N+1 Query Problem in Conversations

`apps/api/src/routes/conversations.ts:376-446` — When loading a conversation, each message triggers sequential DB queries for permission checks (`canUserSeeMessage` → queries `manuscript_authors` and `review_assignments`) and author masking. A conversation with 50 messages generates 150+ database queries.

**Fix:** Batch-fetch all author/reviewer relationships upfront and pass them to the per-message checks.

### H2. SSE Memory Leak — No Connection Timeout

`apps/api/src/routes/events.ts` — SSE connections are tracked in an in-memory `Map` and only cleaned up when the `close` event fires. Abrupt network failures don't trigger `close`, so stale connections accumulate forever. Additionally, the broadcast path (`lines 177-199`) runs async DB queries per connected user per message.

**Fix:** Add a periodic heartbeat/sweep to detect stale connections. Cache permission results during broadcast.

### H3. No Data Fetching Layer in Frontend

`@tanstack/react-query` is installed as a dependency in `apps/web/package.json` but never used anywhere. Every component makes its own `fetch()` calls with `useState`/`useEffect`, resulting in no caching, no deduplication, and inconsistent loading/error states.

**Fix:** Adopt React Query progressively, starting with the most-fetched resources (manuscripts, conversations, user data).

### H4. Email Transporter Created in 4+ Locations

The same `nodemailer.createTransport()` configuration is duplicated in:
- `apps/api/src/services/botActionProcessor.ts:8-19`
- `apps/api/src/services/deadlineReminderProcessor.ts:9-20`
- `apps/api/src/routes/reviewers.ts:22-33`
- `apps/api/src/routes/auth.ts:12-23`

**Fix:** Extract to a shared email service module.

### H5. Synchronous File Operations Block Event Loop

`apps/api/src/routes/articles.ts` uses `fs.mkdirSync`, `fs.existsSync`, `fs.unlinkSync`, `fs.readFileSync`, `fs.statSync` — at least 6 locations of synchronous I/O in request handlers.

**Fix:** Replace with async equivalents (`fs.promises`).

### H6. `UserRole` Enum Doesn't Match Prisma `GlobalRole`

`packages/types/src/index.ts:4-9` defines `UserRole` as `{AUTHOR, REVIEWER, EDITOR, ADMIN}`. The Prisma schema defines `GlobalRole` as `{ADMIN, EDITOR_IN_CHIEF, ACTION_EDITOR, USER, BOT}`. These are completely different. Code using the TypeScript enum will have wrong values.

**Fix:** Replace `UserRole` with a `GlobalRole` enum that matches the schema, or auto-generate from Prisma.

### H7. `ManuscriptStatus` Enum Missing `RETRACTED`

`packages/types/src/index.ts:13-21` omits the `RETRACTED` status that exists in the Prisma schema (`schema.prisma:368`).

**Fix:** Add `RETRACTED` to the TypeScript enum.

### H8. `dangerouslySetInnerHTML` Without Sanitization

Multiple frontend components render HTML without sanitization:
- `apps/web/src/components/submissions/SubmissionHeader.tsx:1000`
- `apps/web/src/components/conversations/MessageContent.tsx:83,97`
- `apps/web/src/app/about/[slug]/page.tsx`

While the markdown renderer bot uses DOMPurify, the frontend rendering paths do not consistently sanitize.

**Fix:** Ensure all `dangerouslySetInnerHTML` usage is wrapped with DOMPurify.

### H9. UI Package Build Output Broken

`packages/ui/package.json` declares `main: "dist/index.js"` but TypeScript actually outputs to `dist/ui/src/index.js`. The package can't be imported by consumers.

**Fix:** Fix the tsconfig `rootDir`/`outDir` or update `package.json` main/types paths.

### H10. 78 DEBUG Console Statements in Production Code

`apps/api/src/routes/articles.ts` has 20 DEBUG log statements, `packages/bot-markdown-renderer/src/index.ts` has 39, `apps/api/src/middleware/auth.ts` has 2 (logging user emails).

**Fix:** Remove or gate behind a debug flag. The auth middleware ones that log emails are a security concern.

### H11. CLAUDE.md Lists Wrong Review Assignment Statuses

CLAUDE.md line 125 says statuses are `INVITED, ACCEPTED, DECLINED, IN_PROGRESS, COMPLETED`. The actual Prisma schema has `PENDING` not `INVITED`. (See also the `ManuscriptFileType` list which omits `SUPPLEMENTARY`.)

### H12. docs/README.md Has 10+ Dead Links

Most of the documentation index links point to non-existent files:
- `./development/api.md`, `./development/database.md`
- All `./features/` links (`manuscripts.md`, `conversations.md`, `content.md`, `users.md`)
- All `./deployment/` links (`local.md`, `production.md`, `environment.md`)
- `./bots/plagiarism-checker.md`, `./bots/statistics-reviewer.md`

### H13. Bot Framework Hardcoded Paths

`packages/bots/src/framework/botManager.ts:446-470` hardcodes relative paths to bot directories assuming a specific monorepo structure. If packages are reorganized, this breaks silently.

### H14. No CI/CD Pipeline for Code Quality

Only two GitHub Actions workflows exist: one for the Astro docs site and one for Terraform validation. There's no workflow for lint, type-check, test, or build verification on PRs.

### H15. `marked` Major Version Split

Root `package.json` declares `marked: ^15.0.12` but `packages/bots` and `packages/bot-markdown-renderer` use `marked: ^9.1.0`. Major version mismatch means different markdown rendering behavior in different parts of the system.

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

### M12. Port Number Inconsistency in Docs

`docs/README.md:60` references `localhost:3001` but the main README and CLAUDE.md say port 3000.

### M13. `create-colloquium-journal` README Has Wrong Bot Names

`packages/create-colloquium-journal/README.md` references bot names as `editorial-bot`, `markdown-renderer-bot`, `reference-bot` — the actual names are `bot-editorial`, `bot-markdown-renderer`, `bot-reference-check`.

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

## CLAUDE.md Corrections Needed

1. **Line 92**: File types list should include `SUPPLEMENTARY`
2. **Line 125**: Review assignment statuses should say `PENDING` not `INVITED`
3. **Line 179**: `bot-reference` should be `bot-reference-check` (the actual package/bot ID)
4. Missing mention of `RETRACTED` manuscript status anywhere
5. Should document the `NEXT_PUBLIC_API_URL` env var (needed for frontend, missing from env setup section)
6. Should note that `@tanstack/react-query` is available but not yet adopted

## Recommended Priority Order

**Phase 1 — Unblock deployment:**
1. Centralize API URL configuration (C1)
2. Fix magic link secret fallback (C2)
3. Fix Express version mismatch (C3)
4. Remove/gate DEBUG logging (H10)
5. Add CI pipeline (H14)

**Phase 2 — Fix correctness issues:**
6. Align TypeScript enums with Prisma schema (H6, H7)
7. Sanitize all `dangerouslySetInnerHTML` (H8)
8. Fix UI package build (H9)
9. Fix CLAUDE.md inaccuracies (H11)
10. Remove dead doc links or write the pages (H12)

**Phase 3 — Performance & scalability:**
11. Fix N+1 conversation queries (H1)
12. Add SSE connection cleanup (H2)
13. Adopt React Query (H3)
14. Extract email service (H4)
15. Use async file operations (H5)
16. Add message pagination (M8)
17. Cache workflow config (M9)

**Phase 4 — Code quality:**
18. Split large files (M1, M2, M3)
19. Standardize error response format (M7)
20. Extract duplicated utilities (M10)
21. Split ESLint config (M5)
22. Add database indexes (M14)
23. Add missing tests (L4)
