# Configurable Review Workflow Plan

## Key Design Decisions

1. **Templates are config generators**: Each workflow template (blind, open, etc.) simply populates a structured config object. This makes the system transparent—users see exactly what each template does.

2. **Single conversation, variable visibility**: Rather than separate conversation threads for different phases, we use one conversation with visibility rules that change based on workflow phase and user role.

3. **Phases are optional**: Journals can enable discrete phases (staged model) or disable them (continuous model). The same config structure supports both.

4. **Editor "release" action**: In staged workflows, editors explicitly release the conversation to authors. This is the phase transition trigger, not an automatic status change.

5. **Existing infrastructure reused**: The current conversation types, message privacy levels, and manuscript statuses remain. We add workflow config and phase tracking on top.

6. **Author response can trigger new cycle**: Configurable per-journal—when an author responds after a release, it can automatically start a new review round.

## Overview

Enable journals to configure their review workflow model through a template-based system. Templates are predefined configurations that populate a structured config object, making it transparent what each workflow model does. Journals can select a template or customize individual settings.

The goal is to support diverse review paradigms within a single system:
- **Traditional staged review**: Authors see feedback only after editorial decisions
- **Open continuous review**: All participants see everything in real-time
- **Hybrid models**: Various combinations of visibility and participation rules

## Motivation

Academic journals have different philosophies about transparency and workflow:

| Model | Philosophy | Examples |
|-------|------------|----------|
| Double-blind staged | Reduce bias, formal rounds | Most traditional journals |
| Single-blind staged | Reviewer anonymity, author known | Many STEM journals |
| Open continuous | Transparency, dialogue | Some open-access journals, F1000Research |
| Progressive disclosure | Prevent anchoring, then discuss | Emerging model |

Rather than forcing one model, Colloquium should let each journal configure their preferred workflow while using the same underlying conversation infrastructure.

## Current State

The system already has building blocks:

- **Multiple conversation types**: EDITORIAL, REVIEW, SEMI_PUBLIC, PUBLIC, AUTHOR_ONLY
- **Message privacy levels**: PUBLIC, AUTHOR_VISIBLE, REVIEWER_ONLY, EDITOR_ONLY, ADMIN_ONLY
- **Manuscript statuses**: SUBMITTED, UNDER_REVIEW, REVISION_REQUESTED, REVISED, ACCEPTED, REJECTED, PUBLISHED, RETRACTED
- **Journal settings**: `journal_settings` table with JSON `settings` field

What's missing:
- Workflow configuration schema
- Visibility enforcement based on workflow phase
- Phase transition logic
- UI adaptation based on workflow state

## Configuration Schema

### Core Structure

```typescript
type WorkflowConfig = {
  // What authors can see and when
  author: {
    seesReviews: 'realtime' | 'on_release' | 'never';
    seesReviewerIdentity: 'always' | 'never' | 'on_release';
    canParticipate: 'anytime' | 'on_release' | 'invited';
  };

  // What reviewers can see and when
  reviewers: {
    seeEachOther: 'realtime' | 'after_all_submit' | 'never';
    seeAuthorIdentity: 'always' | 'never';
    seeAuthorResponses: 'realtime' | 'on_release';
  };

  // Workflow behavior
  phases: {
    enabled: boolean;
    authorResponseStartsNewCycle: boolean;
    requireAllReviewsBeforeRelease: boolean;
  };
};
```

### Zod Schema

```typescript
// packages/types/src/index.ts

export const WorkflowConfigSchema = z.object({
  author: z.object({
    seesReviews: z.enum(['realtime', 'on_release', 'never']),
    seesReviewerIdentity: z.enum(['always', 'never', 'on_release']),
    canParticipate: z.enum(['anytime', 'on_release', 'invited']),
  }),
  reviewers: z.object({
    seeEachOther: z.enum(['realtime', 'after_all_submit', 'never']),
    seeAuthorIdentity: z.enum(['always', 'never']),
    seeAuthorResponses: z.enum(['realtime', 'on_release']),
  }),
  phases: z.object({
    enabled: z.boolean(),
    authorResponseStartsNewCycle: z.boolean(),
    requireAllReviewsBeforeRelease: z.boolean(),
  }),
});

export type WorkflowConfig = z.infer<typeof WorkflowConfigSchema>;
```

## Workflow Templates

Templates are named configurations with descriptions. Selecting a template populates the config; users can then customize.

### Traditional Blind Review

Double-blind, staged model. Authors see feedback only after editorial decision.

```typescript
{
  id: 'traditional-blind',
  name: 'Traditional Blind Review',
  description: 'Double-blind review with discrete revision rounds. Authors see feedback only after editorial decision.',

  config: {
    author: {
      seesReviews: 'on_release',
      seesReviewerIdentity: 'never',
      canParticipate: 'on_release',
    },
    reviewers: {
      seeEachOther: 'realtime',
      seeAuthorIdentity: 'never',
      seeAuthorResponses: 'on_release',
    },
    phases: {
      enabled: true,
      authorResponseStartsNewCycle: true,
      requireAllReviewsBeforeRelease: true,
    },
  },
}
```

### Single-Blind Staged

Reviewers know author identity, but remain anonymous to authors.

```typescript
{
  id: 'single-blind',
  name: 'Single-Blind Review',
  description: 'Reviewers see author identity but remain anonymous. Staged with discrete rounds.',

  config: {
    author: {
      seesReviews: 'on_release',
      seesReviewerIdentity: 'never',
      canParticipate: 'on_release',
    },
    reviewers: {
      seeEachOther: 'realtime',
      seeAuthorIdentity: 'always',
      seeAuthorResponses: 'on_release',
    },
    phases: {
      enabled: true,
      authorResponseStartsNewCycle: true,
      requireAllReviewsBeforeRelease: true,
    },
  },
}
```

### Open Continuous

Fully transparent, real-time conversation.

```typescript
{
  id: 'open-continuous',
  name: 'Open Continuous',
  description: 'All participants see everything in real-time. Fully transparent dialogue.',

  config: {
    author: {
      seesReviews: 'realtime',
      seesReviewerIdentity: 'always',
      canParticipate: 'anytime',
    },
    reviewers: {
      seeEachOther: 'realtime',
      seeAuthorIdentity: 'always',
      seeAuthorResponses: 'realtime',
    },
    phases: {
      enabled: false,
      authorResponseStartsNewCycle: false,
      requireAllReviewsBeforeRelease: false,
    },
  },
}
```

### Progressive Disclosure

Prevents anchoring by hiding reviewer opinions from each other until all submit.

```typescript
{
  id: 'progressive-disclosure',
  name: 'Progressive Disclosure',
  description: 'Reviewers submit independently (hidden from each other), then see all reviews, then author sees.',

  config: {
    author: {
      seesReviews: 'on_release',
      seesReviewerIdentity: 'always',
      canParticipate: 'on_release',
    },
    reviewers: {
      seeEachOther: 'after_all_submit',
      seeAuthorIdentity: 'always',
      seeAuthorResponses: 'on_release',
    },
    phases: {
      enabled: true,
      authorResponseStartsNewCycle: true,
      requireAllReviewsBeforeRelease: true,
    },
  },
}
```

### Open Review, Gated Response

Authors observe the review discussion in real-time but can only respond at decision points.

```typescript
{
  id: 'open-gated',
  name: 'Open Review, Gated Response',
  description: 'Authors observe review discussion in real-time but respond only at decision points.',

  config: {
    author: {
      seesReviews: 'realtime',
      seesReviewerIdentity: 'always',
      canParticipate: 'on_release',
    },
    reviewers: {
      seeEachOther: 'realtime',
      seeAuthorIdentity: 'always',
      seeAuthorResponses: 'on_release',
    },
    phases: {
      enabled: true,
      authorResponseStartsNewCycle: true,
      requireAllReviewsBeforeRelease: false,
    },
  },
}
```

## Phase Tracking

For workflows with `phases.enabled: true`, manuscripts need phase state.

### Database Schema

Add to `manuscripts` table:

```prisma
model manuscripts {
  // existing fields...

  workflowPhase     WorkflowPhase    @default(REVIEW)
  workflowRound     Int              @default(1)
  releasedAt        DateTime?        // when current phase was released to author

  workflow_releases workflow_releases[]
}

model workflow_releases {
  id            String      @id @default(cuid())
  manuscriptId  String
  round         Int
  releasedAt    DateTime    @default(now())
  releasedBy    String      // editor userId
  decisionType  String?     // 'accept' | 'reject' | 'revise' | 'progress_update'

  manuscripts   manuscripts @relation(fields: [manuscriptId], references: [id], onDelete: Cascade)
  users         users       @relation(fields: [releasedBy], references: [id])
}

enum WorkflowPhase {
  REVIEW              // reviewers providing feedback
  DELIBERATION        // reviewers can see each other (for progressive disclosure)
  RELEASED            // author can see and respond
  AUTHOR_RESPONDING   // waiting for author revision
}
```

### Phase Transitions

| Current Phase | Trigger | Next Phase |
|---------------|---------|------------|
| REVIEW | All reviewers submitted (if progressive) | DELIBERATION |
| REVIEW | Editor releases (if not progressive) | RELEASED |
| DELIBERATION | Editor releases | RELEASED |
| RELEASED | Author submits response (if cycles enabled) | REVIEW (round++) |
| RELEASED | Editor accepts/rejects | (terminal) |

## Visibility Enforcement

### Backend: Message Filtering

When fetching conversation messages, filter based on workflow config and phase.

```typescript
// apps/api/src/services/workflowVisibility.ts

export function canUserSeeMessage(
  user: User,
  message: Message,
  manuscript: Manuscript,
  config: WorkflowConfig
): boolean {
  const isAuthor = manuscript.authorId === user.id;
  const isReviewer = manuscript.reviewAssignments.some(r => r.reviewerId === user.id);
  const isEditor = hasEditorRole(user, manuscript);

  // Editors always see everything
  if (isEditor) return true;

  // For authors
  if (isAuthor) {
    const isReviewerMessage = message.authorRole === 'REVIEWER';

    if (isReviewerMessage) {
      if (config.author.seesReviews === 'never') return false;
      if (config.author.seesReviews === 'on_release') {
        return manuscript.workflowPhase === 'RELEASED' ||
               manuscript.workflowPhase === 'AUTHOR_RESPONDING';
      }
      return true; // realtime
    }
    return true; // author sees their own and editor messages
  }

  // For reviewers
  if (isReviewer) {
    const isOtherReviewerMessage = message.authorRole === 'REVIEWER' &&
                                    message.authorId !== user.id;
    const isAuthorMessage = message.authorId === manuscript.authorId;

    if (isOtherReviewerMessage) {
      if (config.reviewers.seeEachOther === 'never') return false;
      if (config.reviewers.seeEachOther === 'after_all_submit') {
        return manuscript.workflowPhase !== 'REVIEW';
      }
      return true; // realtime
    }

    if (isAuthorMessage) {
      if (config.reviewers.seeAuthorResponses === 'on_release') {
        return manuscript.workflowPhase === 'RELEASED' ||
               manuscript.workflowPhase === 'AUTHOR_RESPONDING';
      }
      return true; // realtime
    }

    return true;
  }

  return false;
}
```

### Backend: Participation Enforcement

Block message creation when user cannot participate.

```typescript
// apps/api/src/middleware/workflowParticipation.ts

export function canUserParticipate(
  user: User,
  manuscript: Manuscript,
  config: WorkflowConfig
): boolean {
  const isAuthor = manuscript.authorId === user.id;
  const isEditor = hasEditorRole(user, manuscript);

  // Editors and reviewers can always participate
  if (isEditor) return true;
  if (!isAuthor) return true; // reviewers

  // Author participation rules
  if (config.author.canParticipate === 'anytime') return true;

  if (config.author.canParticipate === 'on_release') {
    return manuscript.workflowPhase === 'RELEASED' ||
           manuscript.workflowPhase === 'AUTHOR_RESPONDING';
  }

  if (config.author.canParticipate === 'invited') {
    // Check for explicit invitation (future: invitation system)
    return false;
  }

  return false;
}
```

### Identity Masking

When `seesReviewerIdentity: 'never'`, mask reviewer identity in API responses.

```typescript
function maskMessageAuthor(message: Message, shouldMask: boolean): Message {
  if (!shouldMask) return message;

  return {
    ...message,
    author: {
      id: `reviewer-${message.reviewerIndex}`,
      name: `Reviewer ${message.reviewerIndex}`,
      // no email, avatar, or other identifying info
    },
  };
}
```

## UI Components

### Journal Configuration Page

```
┌─────────────────────────────────────────────────────────────┐
│ Review Workflow                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Select a workflow template:                                 │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ● Traditional Blind Review                              │ │
│ │   Double-blind with discrete revision rounds            │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ○ Single-Blind Review                                   │ │
│ │   Reviewers see author, remain anonymous                │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ○ Open Continuous                                       │ │
│ │   Fully transparent real-time dialogue                  │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ○ Progressive Disclosure                                │ │
│ │   Reviewers independent, then visible, then author      │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ○ Open Review, Gated Response                           │ │
│ │   Authors observe but respond at decision points        │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ○ Custom                                                │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Current Configuration:                                      │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Author                                                  │ │
│ │   Sees reviews .............. on release                │ │
│ │   Sees reviewer identity .... never (anonymous)         │ │
│ │   Can participate ........... on release                │ │
│ │                                                         │ │
│ │ Reviewers                                               │ │
│ │   See each other ............ realtime                  │ │
│ │   See author identity ....... never (double-blind)      │ │
│ │   See author responses ...... on release                │ │
│ │                                                         │ │
│ │ Phases                                                  │ │
│ │   Discrete phases ........... yes                       │ │
│ │   Response starts new cycle . yes                       │ │
│ │   Require all reviews ....... yes                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [Customize]                                    [Save]       │
└─────────────────────────────────────────────────────────────┘
```

### Customize Mode

When "Customize" is clicked, config fields become editable dropdowns:

```
┌─────────────────────────────────────────────────────────────┐
│ Custom Configuration                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Author Visibility & Participation                           │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Author sees reviews        [On release         ▼]      │ │
│ │ Author sees reviewer names [Never (anonymous)  ▼]      │ │
│ │ Author can participate     [On release         ▼]      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Reviewer Visibility                                         │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Reviewers see each other   [Realtime           ▼]      │ │
│ │ Reviewers see author name  [Never (blind)      ▼]      │ │
│ │ Reviewers see author msgs  [On release         ▼]      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Workflow Behavior                                           │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ☑ Enable discrete phases                                │ │
│ │ ☑ Author response starts new review cycle               │ │
│ │ ☑ Require all reviews before release                    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [Back to Templates]                            [Save]       │
└─────────────────────────────────────────────────────────────┘
```

### Author View: Staged Workflow

During review phase (locked out):

```
┌─────────────────────────────────────────────────────────────┐
│ Your Paper Title                                            │
│ Status: Under Review                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                                                        │ │
│  │  📋  Review in Progress                                │ │
│  │                                                        │ │
│  │  Your manuscript is currently being evaluated by       │ │
│  │  the editorial team. You'll be notified when           │ │
│  │  feedback is available.                                │ │
│  │                                                        │ │
│  │  Submitted: January 15, 2026                           │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  📎 Your Submitted Files                                    │
│     manuscript.md                                           │
│     figures.zip                                             │
│     references.bib                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

After decision released:

```
┌─────────────────────────────────────────────────────────────┐
│ Your Paper Title                                            │
│ Status: Revision Requested                        Round 1   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ─── Editorial Decision · January 28, 2026 ───────────────── │
│                                                             │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ Editor                                                 │  │
│ │ We've completed the initial review of your manuscript. │  │
│ │ Please address the reviewer comments and resubmit.     │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ Reviewer A                                             │  │
│ │ The methodology section needs clarification on the     │  │
│ │ sampling procedure. Specifically...                    │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ Reviewer B                                             │  │
│ │ Strong contribution overall. Figure 3 would benefit    │  │
│ │ from higher resolution. The statistical analysis...    │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
│ ──────────────────────────────────────────────────────────  │
│                                                             │
│ [Your response or revision...]                         [▶]  │
│                                                             │
│ [📎 Upload Revised Manuscript]                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Editor View: Phase Controls

Editors see the full conversation plus phase management:

```
┌─────────────────────────────────────────────────────────────┐
│ Paper Title                                                 │
│ Status: Under Review                    Phase: Review (R1)  │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Review Status                                           │ │
│ │                                                         │ │
│ │ ✓ Reviewer A — submitted Jan 25                         │ │
│ │ ✓ Reviewer B — submitted Jan 26                         │ │
│ │ ○ Reviewer C — pending (due Feb 1)                      │ │
│ │                                                         │ │
│ │ [Release to Author ▼]        [Send Reminder]            │ │
│ │  ├─ With decision: Accept                               │ │
│ │  ├─ With decision: Revise                               │ │
│ │  ├─ With decision: Reject                               │ │
│ │  └─ Progress update (no decision)                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [Reviewer A]: The methodology section needs...              │
│                                                             │
│ [Reviewer B]: Strong contribution. Figure 3...              │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 👁 Author cannot see this conversation                  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [Add message...]                                       [▶]  │
└─────────────────────────────────────────────────────────────┘
```

### Continuous Model View

For open continuous workflow, everyone sees the same conversation without phase controls:

```
┌─────────────────────────────────────────────────────────────┐
│ Paper Title                                                 │
│ Status: Under Review                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ [Author]: Here's our submission on...                       │
│                                                             │
│ [Dr. Smith (Reviewer)]: Interesting approach. I have a      │
│ question about the sampling method...                       │
│                                                             │
│ [Author]: Good question. We used stratified sampling        │
│ because...                                                  │
│                                                             │
│ [Dr. Jones (Reviewer)]: I agree with Dr. Smith. Also,       │
│ could you clarify Figure 2?                                 │
│                                                             │
│ [Editor]: Let's also discuss the theoretical framing...     │
│                                                             │
│ [Your message...]                                      [▶]  │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### Phase 1: Schema & Types

1. Add `WorkflowConfig` schema to `packages/types`
2. Add `WorkflowPhase` enum and fields to Prisma schema
3. Create migration for manuscript phase tracking
4. Add workflow config to journal settings schema
5. Create workflow templates constant file

### Phase 2: Backend Enforcement

1. Create `workflowVisibility` service for message filtering
2. Create `workflowParticipation` middleware for message creation
3. Modify conversation message endpoints to apply visibility rules
4. Add identity masking for anonymous review
5. Implement phase transition logic in editorial bot

### Phase 3: Editorial Bot Updates

1. Add `release` command to release conversation to author
2. Modify `accept`/`reject` to handle phase transitions
3. Add `revise` command for revision requests
4. Track workflow rounds
5. Handle author response detection for new cycles

### Phase 4: Journal Settings UI

1. Create workflow configuration component
2. Implement template selector with config preview
3. Add customize mode with individual settings
4. Show config diff when switching templates

### Phase 5: Conversation UI Adaptation

1. Create phase-aware conversation container
2. Implement locked/waiting state for authors
3. Add phase controls for editors
4. Add round markers and release dividers
5. Implement identity masking in message display

### Phase 6: Notifications

1. Notify authors when conversation is released
2. Notify reviewers of phase transitions
3. Email templates for each notification type

## Files to Create/Modify

| File | Change |
|------|--------|
| `packages/types/src/index.ts` | Add `WorkflowConfig` schema, `WorkflowPhase` enum |
| `packages/types/src/workflowTemplates.ts` | New: template definitions |
| `packages/database/prisma/schema.prisma` | Add phase fields, `workflow_releases` table |
| `apps/api/src/services/workflowVisibility.ts` | New: visibility logic |
| `apps/api/src/services/workflowParticipation.ts` | New: participation logic |
| `apps/api/src/routes/conversations.ts` | Apply visibility/participation |
| `apps/api/src/routes/journal-settings.ts` | Handle workflow config |
| `packages/bot-editorial/src/commands/release.ts` | New: release command |
| `packages/bot-editorial/src/commands/revise.ts` | New: revise command |
| `apps/web/src/app/admin/settings/workflow/page.tsx` | New: config UI |
| `apps/web/src/components/workflow/TemplateSelector.tsx` | New: template picker |
| `apps/web/src/components/workflow/ConfigDisplay.tsx` | New: config display |
| `apps/web/src/components/conversations/PhaseAwareConversation.tsx` | New: phase-aware wrapper |
| `apps/web/src/components/conversations/EditorPhaseControls.tsx` | New: editor controls |
| `apps/web/src/components/conversations/AuthorLockedState.tsx` | New: waiting state |

## Testing

### Unit Tests

- Visibility logic for each template configuration
- Participation enforcement for each user role
- Phase transition state machine
- Identity masking

### Integration Tests

- Full workflow cycle: submit → review → release → respond → new cycle
- Template application to journal settings
- Message filtering in API responses
- SSE updates respect visibility rules

### E2E Tests

- Author experience through staged workflow
- Editor phase control actions
- Reviewer experience with progressive disclosure
- Continuous model full conversation

## Security Considerations

- Visibility enforcement must happen at API level, not just UI
- Identity masking must be consistent across all endpoints (messages, SSE, exports)
- Phase transitions should be atomic with proper locking
- Audit log for all release actions

## Future Considerations

- **Per-manuscript workflow override**: Allow editors to use different workflow for specific manuscripts
- **Invitation-based participation**: Explicit invitations for `canParticipate: 'invited'`
- **Reviewer deadlines per phase**: Different deadlines for initial review vs. re-review
- **Workflow visualization**: Visual timeline of phases and transitions
- **Export considerations**: How to handle visibility in exported/archived conversations
