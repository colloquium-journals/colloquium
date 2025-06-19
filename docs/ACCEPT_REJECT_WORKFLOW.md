# Accept/Reject Workflow Documentation

## Overview

The Accept/Reject workflow allows reviewers to respond to review invitations and submit their reviews through both API endpoints and bot commands. This system provides a complete review lifecycle management with automated notifications and conversation updates.

## API Endpoints

### 1. Respond to Review Invitation
**POST** `/api/reviewers/invitations/:id/respond`

Allows reviewers to accept or decline review invitations.

**Authentication**: Required (reviewer must be the assigned reviewer)

**Request Body**:
```typescript
{
  response: 'ACCEPT' | 'DECLINE',
  message?: string,           // Optional message (max 500 chars)
  availableUntil?: Date      // Optional availability date (for ACCEPT)
}
```

**Response**:
```typescript
{
  message: string,
  assignment: ReviewAssignment,
  status: 'ACCEPTED' | 'DECLINED'
}
```

**Features**:
- Updates assignment status in database
- Creates notification message in editorial conversation
- Sends email notifications to editors
- Validates that user is the assigned reviewer
- Prevents duplicate responses

### 2. Submit Review
**POST** `/api/reviewers/assignments/:id/submit`

Allows reviewers to submit their completed reviews.

**Authentication**: Required (reviewer must be the assigned reviewer)

**Request Body**:
```typescript
{
  reviewContent: string,                    // Min 10 characters
  recommendation: 'ACCEPT' | 'MINOR_REVISION' | 'MAJOR_REVISION' | 'REJECT',
  confidentialComments?: string,            // Editor-only comments
  score?: number,                          // 1-10 rating
  attachments?: string[]                   // File attachments
}
```

**Response**:
```typescript
{
  message: string,
  assignment: ReviewAssignment,
  submission: ReviewSubmission
}
```

**Features**:
- Marks assignment as COMPLETED
- Creates review message in review conversation
- Creates separate confidential message for editors
- Sends email notifications to editors
- Validates assignment status (must be ACCEPTED or IN_PROGRESS)

### 3. Get Invitation Details
**GET** `/api/reviewers/invitations/:id`

Retrieves detailed information about a review invitation.

**Authentication**: Required (reviewer must be the assigned reviewer)

**Response**:
```typescript
{
  invitation: {
    id: string,
    status: ReviewStatus,
    dueDate?: Date,
    reviewer: UserSummary,
    manuscript: {
      id: string,
      title: string,
      abstract: string,
      authors: AuthorInfo[]
    }
  }
}
```

## Bot Commands

### 1. Respond Command
**Usage**: `@editorial-bot respond <assignment-id> <accept|decline> [message="optional message"]`

Allows reviewers to respond to invitations through bot commands.

**Examples**:
```
@editorial-bot respond assignment-12345 accept
@editorial-bot respond assignment-67890 decline message="I have a conflict of interest"
@editorial-bot respond assignment-11111 accept message="Happy to review this work"
```

**Bot Action**: Triggers `RESPOND_TO_REVIEW` action processed by BotActionProcessor

### 2. Submit Command
**Usage**: `@editorial-bot submit <assignment-id> recommendation="<recommendation>" review="<review>" [score="1-10"] [confidential="<comments>"]`

Allows reviewers to submit reviews through bot commands.

**Examples**:
```
@editorial-bot submit assignment-12345 recommendation="accept" review="Excellent work with clear methodology"
@editorial-bot submit assignment-67890 recommendation="minor_revision" review="Good work but needs revision" score="7"
@editorial-bot submit assignment-11111 recommendation="major_revision" review="Interesting but needs work" confidential="Author seems inexperienced"
```

**Bot Action**: Triggers `SUBMIT_REVIEW` action processed by BotActionProcessor

## Validation Schemas

### ReviewInvitationResponseSchema
```typescript
{
  response: z.enum(['ACCEPT', 'DECLINE']),
  message: z.string().max(500).optional(),
  availableUntil: z.coerce.date().optional()
}
```

### ReviewSubmissionSchema
```typescript
{
  reviewContent: z.string().min(10),
  recommendation: z.enum(['ACCEPT', 'MINOR_REVISION', 'MAJOR_REVISION', 'REJECT']),
  confidentialComments: z.string().optional(),
  score: z.number().min(1).max(10).optional(),
  attachments: z.array(z.string()).default([])
}
```

## Email Notifications

### Invitation Response Notifications
- **Recipients**: All editors (ADMIN, EDITOR_IN_CHIEF, MANAGING_EDITOR)
- **Trigger**: When reviewer accepts or declines invitation
- **Content**: Reviewer name, manuscript title, response type, optional message

### Review Submission Notifications
- **Recipients**: All editors
- **Trigger**: When reviewer submits completed review
- **Content**: Reviewer name, manuscript title, recommendation, score (if provided)

## Conversation Updates

### Editorial Conversation Messages
- **Accept/Decline responses**: Create EDITOR_ONLY messages with response details
- **Privacy**: Only visible to editors
- **Metadata**: Includes assignment ID, response type, and via='bot' flag

### Review Conversation Messages
- **Review submissions**: Create AUTHOR_VISIBLE messages with review content
- **Confidential comments**: Separate EDITOR_ONLY messages
- **Privacy**: Review visible to authors, confidential comments only to editors

## Error Handling

### Common Error Scenarios
1. **403 Forbidden**: User not assigned to review
2. **400 Bad Request**: Invalid assignment status for operation
3. **404 Not Found**: Assignment or invitation not found
4. **400 Validation Error**: Invalid request data

### Error Response Format
```typescript
{
  error: {
    message: string,
    type: 'ValidationError' | 'ForbiddenError' | 'NotFoundError',
    details?: Record<string, string[]>  // Field-level validation errors
  }
}
```

## Testing

### Test Coverage
- **API Endpoint Tests**: Full request/response validation
- **Bot Command Tests**: Command parsing and action generation
- **Bot Action Processor Tests**: Database operations and notifications
- **Validation Schema Tests**: Input validation and error cases

### Test Files
- `/src/__tests__/routes/reviewers-accept-reject.test.ts`
- `/src/__tests__/services/botActionProcessor-accept-reject.test.ts` 
- `/src/__tests__/schemas/validation-accept-reject.test.ts`
- `/packages/bots/src/__tests__/core/editorialBot-accept-reject.test.ts`

## Security Considerations

1. **Authorization**: Only assigned reviewers can respond to/submit for their assignments
2. **Validation**: All inputs validated with comprehensive Zod schemas
3. **Rate Limiting**: Standard API rate limits apply
4. **Email Security**: SMTP configuration with TLS encryption
5. **Data Privacy**: Confidential comments only visible to editors

## Future Enhancements

1. **Deadline Management**: Automated reminders and deadline enforcement
2. **Review Templates**: Structured review forms and templates
3. **Peer Review**: Anonymous peer review capabilities
4. **Review History**: Track review submission history and metrics
5. **Integration APIs**: Webhook support for external systems