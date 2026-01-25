# Admin Settings

The admin settings panel provides configuration options for journal administrators. Access it via the main navigation: **Admin → Settings**.

## Reminders Tab

The Reminders tab configures automated deadline reminders for reviewers.

### Overview

The reminder system sends automated notifications to reviewers as their review deadlines approach and after they become overdue. Reminders can be sent via email and/or posted to the editorial conversation.

### Configuration Options

#### Master Toggle
- **Enable Reminder System**: Global on/off switch for all automated reminders

#### Review Deadline Reminders
- **Enable Review Deadline Reminders**: Toggle for review-specific reminders

#### Reminder Intervals

Configure when reminders are sent before the deadline:

| Setting | Description |
|---------|-------------|
| Days Before | How many days before the deadline to send the reminder (0 = on due date) |
| Enabled | Whether this interval is active |
| Email | Send reminder via email |
| Post | Post reminder to editorial conversation |

Default intervals: 7 days, 3 days, 1 day before deadline

**To add an interval**: Click "Add Interval" and configure the days before and notification methods.

**To remove an interval**: Click the trash icon next to the interval.

#### Overdue Reminders

Configure reminders after the deadline has passed:

| Setting | Description |
|---------|-------------|
| Enable Overdue Reminders | Toggle overdue reminders on/off |
| Reminder Interval | Days between overdue reminders (default: 3) |
| Maximum Reminders | Stop after this many overdue reminders (default: 3) |

### How It Works

1. **Daily Scanner**: A cron job runs daily at 8 AM (server time) to scan for upcoming deadlines
2. **Job Scheduling**: For each deadline and configured interval, a job is scheduled in the database
3. **Reminder Execution**: When a scheduled job runs:
   - Sends email to reviewer (if enabled)
   - Posts message to editorial conversation (if enabled)
   - Updates reminder status to SENT
4. **Cancellation**: If a reviewer completes their review, pending reminders are automatically cancelled

### Manual Reminders

Editors can send manual reminders at any time using the editorial bot:

```
@bot-editorial send-reminder @DrSmith
@bot-editorial send-reminder @DrSmith message="Please prioritize this review"
```

Manual reminders always send both email and conversation notifications, regardless of the interval settings.

### Best Practices

- **Balance frequency**: Too many reminders can be annoying; too few may not be effective
- **Start early**: The 7-day reminder gives reviewers time to plan
- **Escalate gradually**: Increase urgency with shorter intervals closer to the deadline
- **Limit overdues**: 3 overdue reminders is usually sufficient before personal follow-up
- **Use manual reminders**: For urgent cases, send a manual reminder with a custom message

### Troubleshooting

**Reminders not sending?**
1. Check that the master toggle is enabled
2. Verify the interval is enabled with at least one notification method (email or post)
3. Confirm the assignment has a due date set
4. Check that the assignment status is ACCEPTED or IN_PROGRESS

**Too many reminders?**
1. Reduce the number of intervals
2. Increase the overdue interval days
3. Decrease the maximum overdue reminders

**Want to stop reminders for a specific reviewer?**
- Complete or cancel their review assignment
- Pending reminders will be automatically cancelled
