# Editorial Bot

The Editorial Bot is Colloquium's core manuscript management assistant, designed to streamline editorial workflows and automate common editorial tasks.

## Overview

The Editorial Bot assists with manuscript editorial workflows, status updates, and reviewer assignments. It provides a conversational interface for managing the entire review process from submission to publication decision.

**Bot ID**: `bot-editorial`
**Version**: `2.1.0`
**Author**: Colloquium System

## Commands

### 1. Status (`status`)

Updates the status of a manuscript with an optional reason.

**Usage:** `@bot-editorial status <new-status> [reason="reason for change"]`

#### Parameters
- `newStatus` (required): The new status - one of: SUBMITTED, UNDER_REVIEW, REVISION_REQUESTED, REVISED, ACCEPTED, REJECTED, PUBLISHED
- `reason` (optional): Reason for the status change

#### Examples
```
@bot-editorial status UNDER_REVIEW
@bot-editorial status REVISION_REQUESTED reason="Minor formatting issues"
@bot-editorial status ACCEPTED reason="High quality research with clear findings"
```

---

### 2. Assign (`assign`)

Assigns reviewers to a manuscript with optional deadline and custom message.

**Usage:** `@bot-editorial assign <reviewer-emails> [deadline="YYYY-MM-DD"] [message="custom message"]`

#### Parameters
- `reviewers` (required): Comma-separated list of reviewer email addresses
- `deadline` (optional): Review deadline in YYYY-MM-DD format (defaults to 30 days from now)
- `message` (optional): Custom message to send to reviewers

#### Examples
```
@bot-editorial assign reviewer1@uni.edu,reviewer2@inst.org
@bot-editorial assign reviewer@example.com deadline="2024-02-15"
@bot-editorial assign expert@university.edu deadline="2024-03-01" message="This paper needs statistical review"
```

---

### 3. Summary (`summary`)

Generates a summary of manuscript review progress.

**Usage:** `@bot-editorial summary [format="brief|detailed"]`

#### Parameters
- `format` (optional): Level of detail - "brief" (default) or "detailed"

#### Examples
```
@bot-editorial summary
@bot-editorial summary format="detailed"
```

---

### 4. Respond (`respond`)

Respond to a review invitation (accept or decline).

**Usage:** `@bot-editorial respond <assignment-id> <accept|decline> [message="optional message"]`

#### Parameters
- `assignmentId` (required): The ID of the review assignment to respond to
- `response` (required): "accept" or "decline"
- `message` (optional): Optional message to include with your response

#### Examples
```
@bot-editorial respond assignment-12345 accept
@bot-editorial respond assignment-67890 decline message="I have a conflict of interest"
@bot-editorial respond assignment-11111 accept message="Happy to review this work"
```

---

### 5. Submit (`submit`)

Submit a review for a manuscript.

**Usage:** `@bot-editorial submit <assignment-id> recommendation=<accept|minor_revision|major_revision|reject> review="your review text" [score=1-10] [confidential="editor comments"]`

#### Parameters
- `assignmentId` (required): The ID of the review assignment
- `recommendation` (required): One of "accept", "minor_revision", "major_revision", "reject"
- `review` (required): Your detailed review of the manuscript
- `score` (optional): Score from 1-10
- `confidential` (optional): Confidential comments for editors only

#### Examples
```
@bot-editorial submit assignment-12345 recommendation="accept" review="Excellent work with clear methodology"
@bot-editorial submit assignment-67890 recommendation="minor_revision" review="Good work but needs revision" score="7"
@bot-editorial submit assignment-11111 recommendation="major_revision" review="Interesting but needs significant work" confidential="Author seems inexperienced"
```

---

### 6. Help (`help`)

Show help information for editorial bot commands.

**Usage:** `@bot-editorial help [command="command-name"]`

#### Parameters
- `command` (optional): Specific command to get help for

#### Examples
```
@bot-editorial help
@bot-editorial help command="status"
@bot-editorial help command="assign"
```

## Permissions

The Editorial Bot requires the following permissions:

| Permission | Description |
|------------|-------------|
| `read_manuscript` | View manuscript details |
| `update_manuscript` | Update manuscript status and metadata |
| `assign_reviewers` | Assign reviewers to manuscripts |

## Keywords & Triggers

The bot responds to the following keywords in conversations:
- "editorial decision"
- "review status" 
- "assign reviewer"
- "manuscript status"

And is automatically triggered by these events:
- `MANUSCRIPT_SUBMITTED`
- `REVIEW_COMPLETE`

## Quick Start

The Editorial Bot streamlines manuscript management by automating status updates, reviewer assignments, and progress tracking.

1. Use `@bot-editorial help` to see all available commands
2. Most common commands:
   - `@bot-editorial status <status>` to update manuscript status
   - `@bot-editorial assign <reviewers>` to assign reviewers

### Common Workflow Examples

```
# Update manuscript status to under review
@bot-editorial status UNDER_REVIEW reason="Initial review passed"

# Assign reviewers with deadline
@bot-editorial assign reviewer1@uni.edu,reviewer2@inst.org deadline="2024-02-15"

# Get detailed progress summary
@bot-editorial summary format="detailed"
```

## Implementation Details

The Editorial Bot is built using the command-based bot framework. Each command:

- Validates input parameters
- Executes the requested action
- Returns formatted messages for display
- Optionally triggers system actions (like updating database records)

### Bot Actions

Commands can trigger these system actions:
- `UPDATE_MANUSCRIPT_STATUS` - Updates manuscript status
- `ASSIGN_REVIEWER` - Assigns reviewers to manuscripts  
- `RESPOND_TO_REVIEW` - Records reviewer response to invitations
- `SUBMIT_REVIEW` - Stores completed reviews

### Integration Notes

- Commands are executed within manuscript conversation contexts
- The bot has access to manuscript IDs from the conversation context
- All actions are logged for audit trails
- Commands can be triggered by mentioning `@bot-editorial` in conversations

## Supported Manuscript Statuses

The following statuses are supported for the `status` command:

- `SUBMITTED` - Initial submission received
- `UNDER_REVIEW` - Currently being reviewed
- `REVISION_REQUESTED` - Authors asked to revise and resubmit
- `REVISED` - Revised version submitted by authors
- `ACCEPTED` - Accepted for publication
- `REJECTED` - Rejected for publication  
- `PUBLISHED` - Published and publicly available

## Review Recommendations

The following recommendations are supported for the `submit` command:

- `accept` - Recommend acceptance without changes
- `minor_revision` - Accept with minor revisions required
- `major_revision` - Accept pending major revisions
- `reject` - Recommend rejection