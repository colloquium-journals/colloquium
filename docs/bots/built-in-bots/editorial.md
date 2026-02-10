# bot-editorial

Manages editorial workflows: reviewer invitations, editorial decisions, action editor assignments, and workflow phase transitions.

**Package:** `@colloquium/bot-editorial`
**Category:** editorial
**Default:** Yes (installed automatically)

## Commands

### accept

Accept a manuscript for publication and initiate the publication workflow.

```
@bot-editorial accept [reason="reason for acceptance"]
```

### reject

Reject a manuscript.

```
@bot-editorial reject [reason="reason for rejection"]
```

### assign-editor

Assign an action editor to a manuscript. Validates the user has editor status and checks for conflicts of interest.

```
@bot-editorial assign-editor <editor> [message="custom message"]
@bot-editorial assign-editor editor=@DrEditor
```

### invite-reviewer

Send email invitations to potential reviewers. Creates pending review assignments with accept/decline links.

```
@bot-editorial invite-reviewer <reviewers> [deadline="YYYY-MM-DD"] [message="custom message"]
@bot-editorial invite-reviewer reviewer@university.edu,@DrSmith deadline="2024-03-15"
```

Workflow: invitation sent → reviewer accepts via link → status changes to IN_PROGRESS.

### release

Release reviews to authors with an editorial decision. Changes the workflow phase to RELEASED.

```
@bot-editorial release decision="revise|accept|reject|update" [notes="additional notes"]
```

### request-revision

Request revisions from the author, releasing reviews and optionally setting a deadline.

```
@bot-editorial request-revision [deadline="YYYY-MM-DD"] [notes="revision requirements"]
```

### begin-deliberation

Move to the deliberation phase where reviewers can see each other's reviews.

```
@bot-editorial begin-deliberation [notes="optional notes"]
```

### send-reminder

Send a manual reminder to a reviewer about their pending review.

```
@bot-editorial send-reminder <reviewer> [message="custom message"]
```

## Permissions

- `read_manuscript`
- `update_manuscript`
- `assign_reviewers`
- `make_editorial_decision`

## Action Handlers

- `REINVITE_REVIEWER` - Re-invites a reviewer who previously declined, resetting their status to PENDING and sending a new email.
