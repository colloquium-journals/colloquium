# Editorial Bot

The Editorial Bot is Colloquium's core manuscript management assistant, designed to streamline editorial workflows and automate common editorial tasks.

## Overview

The Editorial Bot helps editors and administrators manage manuscripts through their entire lifecycle, from submission to publication. It can assign reviewers, designate action editors, and make final editorial decisions.

**Bot ID**: `editorial-bot`  
**Version**: `1.0.0`  
**Author**: Colloquium System

## Actions

### 1. Assign Reviewer (`assign_reviewer`)

Assigns a reviewer to a manuscript with optional due date.

#### Input Parameters

```json
{
  "manuscriptId": "string (required)",
  "reviewerId": "string (required)", 
  "dueDate": "string (optional, ISO date format)"
}
```

#### Example Usage

**Via Conversation:**
```
@Editorial Bot assign john.doe@university.edu as reviewer for manuscript ms-123 with due date 2024-02-15
```

**Via API:**
```bash
curl -X POST http://localhost:4000/api/bots/editorial-bot/execute/assign_reviewer \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=your-jwt-token" \
  -d '{
    "input": {
      "manuscriptId": "cm287example123",
      "reviewerId": "cm287reviewer456", 
      "dueDate": "2024-02-15"
    }
  }'
```

#### Success Response

```json
{
  "message": "Action executed successfully",
  "result": {
    "id": "review-assignment-id",
    "manuscriptId": "cm287example123",
    "reviewerId": "cm287reviewer456",
    "status": "PENDING",
    "dueDate": "2024-02-15T00:00:00.000Z",
    "reviewer": {
      "id": "cm287reviewer456",
      "name": "Dr. Jane Smith",
      "email": "jane.smith@university.edu"
    },
    "manuscript": {
      "id": "cm287example123", 
      "title": "Novel Approach to Quantum Computing"
    }
  },
  "botMessage": "Successfully assigned Dr. Jane Smith as reviewer for \"Novel Approach to Quantum Computing\""
}
```

#### Validation Rules

- Manuscript must exist
- Reviewer must exist and have REVIEWER, EDITOR, or ADMIN role
- Reviewer cannot already be assigned to the manuscript
- Due date must be in the future (if provided)

---

### 2. Assign Action Editor (`assign_action_editor`)

Designates an action editor for a manuscript. Action editors are responsible for managing the review process for specific manuscripts.

#### Input Parameters

```json
{
  "manuscriptId": "string (required)",
  "editorId": "string (required)"
}
```

#### Example Usage

**Via Conversation:**
```
@Editorial Bot set editor@university.edu as action editor for manuscript ms-123
```

**Via API:**
```bash
curl -X POST http://localhost:4000/api/bots/editorial-bot/execute/assign_action_editor \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=your-jwt-token" \
  -d '{
    "input": {
      "manuscriptId": "cm287example123",
      "editorId": "cm287editor789"
    }
  }'
```

#### Success Response

```json
{
  "message": "Action executed successfully",
  "result": {
    "id": "action-editor-assignment-id",
    "manuscriptId": "cm287example123", 
    "editorId": "cm287editor789",
    "assignedAt": "2024-01-15T10:30:00.000Z",
    "assignedBy": "cm287admin001",
    "editor": {
      "id": "cm287editor789",
      "name": "Prof. Robert Wilson", 
      "email": "robert.wilson@university.edu"
    },
    "manuscript": {
      "id": "cm287example123",
      "title": "Novel Approach to Quantum Computing"
    }
  },
  "botMessage": "Successfully assigned Prof. Robert Wilson as action editor for \"Novel Approach to Quantum Computing\""
}
```

#### Validation Rules

- Manuscript must exist
- Editor must exist and have EDITOR or ADMIN role
- Replaces existing action editor if one is already assigned
- Only one action editor per manuscript allowed

---

### 3. Make Decision (`make_decision`)

Makes an editorial decision on a manuscript (accept, reject, or request revisions).

#### Input Parameters

```json
{
  "manuscriptId": "string (required)",
  "decision": "string (required, one of: ACCEPTED, REJECTED, REVISION_REQUESTED)",
  "comments": "string (optional)"
}
```

#### Example Usage

**Via Conversation:**
```
@Editorial Bot accept manuscript ms-123 with comments "Excellent contribution to the field"
```

**Via API:**
```bash
curl -X POST http://localhost:4000/api/bots/editorial-bot/execute/make_decision \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=your-jwt-token" \
  -d '{
    "input": {
      "manuscriptId": "cm287example123",
      "decision": "ACCEPTED",
      "comments": "Excellent contribution to the field. Minor formatting issues should be addressed before publication."
    }
  }'
```

#### Success Response

```json
{
  "message": "Action executed successfully",
  "result": {
    "id": "cm287example123",
    "title": "Novel Approach to Quantum Computing",
    "status": "ACCEPTED",
    "updatedAt": "2024-01-15T14:45:00.000Z",
    "metadata": {
      "editorialDecision": {
        "decision": "ACCEPTED",
        "comments": "Excellent contribution to the field. Minor formatting issues should be addressed before publication.",
        "decidedAt": "2024-01-15T14:45:00.000Z",
        "decidedBy": "cm287editor789",
        "actionEditor": "Prof. Robert Wilson"
      }
    },
    "actionEditor": {
      "id": "action-editor-id",
      "editor": {
        "id": "cm287editor789",
        "name": "Prof. Robert Wilson",
        "email": "robert.wilson@university.edu"
      }
    }
  },
  "botMessage": "Manuscript \"Novel Approach to Quantum Computing\" has been accepted with comments: Excellent contribution to the field. Minor formatting issues should be addressed before publication."
}
```

#### Decision Types

- **`ACCEPTED`**: Manuscript is accepted for publication
- **`REJECTED`**: Manuscript is rejected 
- **`REVISION_REQUESTED`**: Authors should revise and resubmit

#### Validation Rules

- Manuscript must exist
- Decision must be one of the valid values
- Editorial decision is recorded in manuscript metadata
- Manuscript status is updated accordingly

## Permissions

The Editorial Bot requires the following permissions:

| Permission | Description |
|------------|-------------|
| `manuscript.assign_reviewer` | Assign reviewers to manuscripts |
| `manuscript.assign_action_editor` | Assign action editors to manuscripts |
| `manuscript.make_decision` | Make editorial decisions on manuscripts |
| `manuscript.view_all` | View all manuscript details including private information |

## User Access Control

### Who Can Execute Actions

| Role | Assign Reviewer | Assign Action Editor | Make Decision |
|------|----------------|---------------------|---------------|
| **Admin** | ✅ | ✅ | ✅ |
| **Editor** | ✅ | ✅ | ✅ |
| **Reviewer** | ❌ | ❌ | ❌ |
| **Author** | ❌ | ❌ | ❌ |

### Manuscript Context

- Actions require valid manuscript ID
- User permissions are checked against manuscript relationships
- Action editors have enhanced permissions for their assigned manuscripts

## Configuration

The Editorial Bot supports the following configuration options:

```json
{
  "autoAssignReviewers": {
    "type": "boolean",
    "description": "Automatically assign reviewers based on keywords",
    "default": false
  },
  "defaultReviewDays": {
    "type": "number", 
    "description": "Default number of days for review deadline",
    "default": 21
  },
  "requireActionEditor": {
    "type": "boolean",
    "description": "Require action editor assignment before review",
    "default": true
  }
}
```

### Default Configuration

```json
{
  "autoAssignReviewers": false,
  "defaultReviewDays": 21,
  "requireActionEditor": true
}
```

## Installation

The Editorial Bot is automatically installed during system initialization with default configuration.

### Manual Installation

```bash
curl -X POST http://localhost:4000/api/bots/editorial-bot/install \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=admin-token" \
  -d '{
    "config": {
      "autoAssignReviewers": false,
      "defaultReviewDays": 30,
      "requireActionEditor": true  
    }
  }'
```

## Usage Examples

### Complete Editorial Workflow

```bash
# 1. Assign action editor
curl -X POST http://localhost:4000/api/bots/editorial-bot/execute/assign_action_editor \
  -d '{"input": {"manuscriptId": "ms-123", "editorId": "editor-456"}}'

# 2. Assign reviewers  
curl -X POST http://localhost:4000/api/bots/editorial-bot/execute/assign_reviewer \
  -d '{"input": {"manuscriptId": "ms-123", "reviewerId": "reviewer-789", "dueDate": "2024-02-15"}}'

curl -X POST http://localhost:4000/api/bots/editorial-bot/execute/assign_reviewer \
  -d '{"input": {"manuscriptId": "ms-123", "reviewerId": "reviewer-012", "dueDate": "2024-02-15"}}'

# 3. Make editorial decision (after reviews are complete)
curl -X POST http://localhost:4000/api/bots/editorial-bot/execute/make_decision \
  -d '{"input": {"manuscriptId": "ms-123", "decision": "REVISION_REQUESTED", "comments": "Please address reviewer concerns about methodology"}}'
```

### Conversation-Based Usage

Users can mention the Editorial Bot in conversations:

```
@Editorial Bot please assign the following reviewers to manuscript ms-123:
- alice@university.edu (due Feb 15)  
- bob@institute.org (due Feb 15)

Also set charlie@college.edu as the action editor.
```

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Manuscript not found` | Invalid manuscript ID | Verify manuscript exists |
| `User not found` | Invalid user ID | Check user exists and has correct role |
| `Permission denied` | Insufficient user permissions | Use admin/editor account |
| `Reviewer already assigned` | Duplicate reviewer assignment | Check existing assignments first |
| `Invalid decision` | Unsupported decision type | Use ACCEPTED, REJECTED, or REVISION_REQUESTED |

### Error Response Format

```json
{
  "error": "Action execution failed",
  "message": "Reviewer alice@university.edu is already assigned to this manuscript"
}
```

## Monitoring & Auditing

### Execution History

View all Editorial Bot executions:

```bash
curl http://localhost:4000/api/bots/editorial-bot/executions
```

### Execution Logs

Each execution is logged with:
- **Input parameters**: What was requested
- **Execution context**: Who triggered it and when
- **Result**: Success/failure and returned data
- **Timing**: Start and completion timestamps
- **Errors**: Detailed error information if failed

## Integration with Other Systems

### Notification System

When integrated with the notification system, the Editorial Bot can:
- Email reviewers when assigned
- Notify authors of editorial decisions
- Alert editors when actions are needed

### Manuscript Workflow

The Editorial Bot integrates with the manuscript lifecycle:
- **Submission**: Auto-assign action editor if configured
- **Review**: Manage reviewer assignments and deadlines
- **Decision**: Update manuscript status and notify stakeholders
- **Publication**: Trigger publication workflow for accepted manuscripts

## Future Enhancements

Planned features for future versions:

- **Auto-reviewer matching**: AI-powered reviewer suggestions based on expertise
- **Deadline management**: Automatic reminders and escalations
- **Batch operations**: Assign multiple reviewers or make bulk decisions
- **Custom workflows**: Configurable decision trees for different manuscript types
- **Integration APIs**: Connect with external editorial management systems