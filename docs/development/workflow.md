# Configurable Review Workflow

Colloquium supports configurable review workflows that allow journals to implement different peer review models: traditional double-blind, single-blind, open review, progressive disclosure, and more.

## Overview

The workflow system controls:

1. **Visibility**: Who can see reviews and when
2. **Identity Masking**: Whether reviewer/author identities are revealed
3. **Participation**: When authors can respond to reviews
4. **Phases**: Structured stages of the review process

## Workflow Phases

Manuscripts progress through workflow phases:

| Phase | Description |
|-------|-------------|
| `REVIEW` | Initial phase where reviewers submit their assessments independently |
| `DELIBERATION` | Reviewers can see each other's reviews and discuss |
| `RELEASED` | Reviews are released to authors |
| `AUTHOR_RESPONDING` | Author is actively responding to reviews |

## Workflow Configuration

### Configuration Schema

```typescript
interface WorkflowConfig {
  author: {
    seesReviews: 'realtime' | 'on_release' | 'never';
    seesReviewerIdentity: 'always' | 'never' | 'on_release';
    canParticipate: 'anytime' | 'on_release' | 'invited';
  };
  reviewers: {
    seeEachOther: 'realtime' | 'after_all_submit' | 'never';
    seeAuthorIdentity: 'always' | 'never';
    seeAuthorResponses: 'realtime' | 'on_release';
  };
  phases: {
    enabled: boolean;
    authorResponseStartsNewCycle: boolean;
    requireAllReviewsBeforeRelease: boolean;
  };
}
```

### Configuration Options

#### Author Settings

| Option | Values | Description |
|--------|--------|-------------|
| `seesReviews` | `realtime`, `on_release`, `never` | When authors can see reviewer comments |
| `seesReviewerIdentity` | `always`, `never`, `on_release` | Whether authors see who wrote reviews |
| `canParticipate` | `anytime`, `on_release`, `invited` | When authors can post messages |

#### Reviewer Settings

| Option | Values | Description |
|--------|--------|-------------|
| `seeEachOther` | `realtime`, `after_all_submit`, `never` | When reviewers can see other reviews |
| `seeAuthorIdentity` | `always`, `never` | Whether reviewers know author identities |
| `seeAuthorResponses` | `realtime`, `on_release` | When reviewers see author responses |

#### Phase Settings

| Option | Description |
|--------|-------------|
| `enabled` | Whether to use structured phases |
| `authorResponseStartsNewCycle` | If true, author response increments review round |
| `requireAllReviewsBeforeRelease` | Prevent release until all reviews complete |

## Pre-built Templates

Five workflow templates are available:

### 1. Traditional Double-Blind (`traditional-blind`)

Classic double-blind review where neither party knows identities.

- Authors see reviews only after release
- Reviewer identities always hidden
- Authors can only participate after release
- Reviewers never see each other or author identity

### 2. Single-Blind (`single-blind`)

Reviewers know authors, but authors don't know reviewers.

- Authors see reviews only after release
- Reviewer identities hidden
- Reviewers can see author identity

### 3. Open Continuous (`open-continuous`)

Fully transparent review process.

- All identities visible
- Real-time visibility of all content
- Authors can participate anytime
- No structured phases

### 4. Progressive Disclosure (`progressive-disclosure`)

Reviewers work independently, then collaborate.

- Reviews hidden from each other until all submit
- Identities revealed on release
- Authors see everything upon release

### 5. Open with Gated Participation (`open-gated`)

Open review with controlled author participation.

- Authors see reviews in real-time
- All identities visible
- Authors can only respond when invited by editor

## Identity Masking

When identities are masked:

- Reviewers appear as "Reviewer A", "Reviewer B", etc. (alphabetically by assignment order)
- Authors appear as "Author"
- Masked identities have anonymized IDs that don't reveal the original user
- Profile links are removed for masked users

## Editorial Bot Commands

The editorial bot provides workflow management commands:

### Release Reviews

```
@bot-editorial release decision="revise" notes="Please address reviewer concerns"
```

Decisions: `accept`, `revise`, `reject`, `update`

### Request Revision

```
@bot-editorial request-revision deadline="2024-03-15" notes="Major revisions required"
```

### Begin Deliberation

```
@bot-editorial begin-deliberation notes="Please discuss methodology concerns"
```

## API Integration

### GET /api/conversations/:id

Response includes workflow information:

```json
{
  "workflow": {
    "phase": "REVIEW",
    "round": 1,
    "hasConfig": true
  },
  "participation": {
    "canParticipate": true,
    "viewerRole": "reviewer",
    "phase": "REVIEW",
    "round": 1
  },
  "messages": [
    {
      "author": {
        "id": "masked-abc123",
        "username": "reviewer-a",
        "name": "Reviewer A",
        "isMasked": true
      }
    }
  ]
}
```

### POST /api/conversations/:id/messages

Returns 403 if participation is blocked:

```json
{
  "error": "Participation Not Allowed",
  "message": "Authors can only participate after reviews have been released."
}
```

## Database Schema

### Manuscript Fields

```prisma
model manuscripts {
  workflowPhase  WorkflowPhase  @default(REVIEW)
  workflowRound  Int            @default(1)
  releasedAt     DateTime?
}

enum WorkflowPhase {
  REVIEW
  DELIBERATION
  RELEASED
  AUTHOR_RESPONDING
}
```

### Workflow Releases Table

Tracks release events:

```prisma
model workflow_releases {
  id            String      @id
  manuscriptId  String
  round         Int
  releasedAt    DateTime
  releasedBy    String
  decisionType  String?
  notes         String?
}
```

## Journal Settings

Workflow configuration is stored in journal settings:

```typescript
{
  // ... other settings
  workflowTemplateId: "traditional-blind",  // Optional template ID
  workflowConfig: { ... }                   // Full config (overrides template)
}
```

If `workflowConfig` is null/undefined, the system uses existing behavior with no workflow restrictions.

## Backend Services

### workflowVisibility.ts

Handles visibility and identity masking:

- `canUserSeeMessageWithWorkflow()` - Apply workflow visibility rules
- `maskMessageAuthor()` - Apply identity masking
- `getViewerRole()` - Determine user's role in the manuscript

### workflowParticipation.ts

Handles participation control:

- `canUserParticipate()` - Check if user can post messages
- `handleAuthorResponse()` - Handle phase transitions on author response

## SSE Events

New event types:

```typescript
// Phase change broadcast
{
  type: 'workflow-phase-changed',
  phase: 'RELEASED',
  round: 1,
  decision: 'revise',
  manuscriptId: '...'
}
```

Messages are masked per-connection based on the viewer's role and workflow config.

## Frontend Components

### Admin Settings

**WorkflowConfigPanel** (`apps/web/src/components/admin/WorkflowConfigPanel.tsx`)
- Template selector with visual cards
- Customization mode for fine-tuning settings
- Save/clear configuration buttons

Access via Admin Settings > Review Workflow tab (admin only).

### Conversation UI

**PhaseAwareConversation** (`apps/web/src/components/conversations/PhaseAwareConversation.tsx`)
- Wrapper component that handles workflow state
- Shows appropriate UI based on user role and workflow phase
- Coordinates child components

**AuthorLockedState** (`apps/web/src/components/conversations/AuthorLockedState.tsx`)
- Displayed to authors during review phase when they cannot participate
- Shows submission info and what to expect

**EditorPhaseControls** (`apps/web/src/components/conversations/EditorPhaseControls.tsx`)
- Shown to editors with workflow config
- Phase badge and round indicator
- Review progress bar with reviewer status
- Release decision dropdown

**RoundDivider** (`apps/web/src/components/conversations/RoundDivider.tsx`)
- Visual separator between review rounds
- Shows round number, date, and decision

### MessageCard Updates

The MessageCard component handles masked identities:
- `author.isMasked: boolean` - indicates masked identity
- Masked users show "?" avatar with violet color
- "Anonymous" badge displayed
- UserProfileHover disabled for masked users

### SSE Events

The `useSSE` hook handles workflow events:
```typescript
onWorkflowPhaseChanged?: (data: {
  phase: string;
  round: number;
  decision?: string;
  manuscriptId: string;
}) => void;
```

## Migration Guide

### For Existing Journals

1. Workflow config is optional - existing behavior unchanged without config
2. Configure workflow via admin settings or API
3. Existing manuscripts get default phase but ignore workflow rules without config

### Setting Up Workflow

1. Choose a template or create custom config
2. Update journal settings:
   ```json
   {
     "workflowTemplateId": "traditional-blind"
   }
   ```
   Or with custom config:
   ```json
   {
     "workflowConfig": {
       "author": { ... },
       "reviewers": { ... },
       "phases": { ... }
     }
   }
   ```
3. New manuscripts will use the workflow rules

## Backward Compatibility

- All workflow code paths short-circuit if no config exists
- Existing `MessagePrivacy` system continues unchanged
- Workflow rules are additive restrictions on top of privacy levels
- Database fields have sensible defaults for existing data
