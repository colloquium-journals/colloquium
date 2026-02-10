# bot-reviewer-checklist

Generates customizable review checklists for assigned reviewers using configurable templates.

**Package:** `@colloquium/bot-reviewer-checklist`
**Category:** quality
**Default:** Yes (installed automatically)

## Commands

### generate

Generate a review checklist for one or all assigned reviewers.

```
@bot-reviewer-checklist generate [reviewer="@username"]
```

Parameters:
- `reviewer` - Target a specific reviewer by @mention, name, or ID. If omitted, generates checklists for all assigned reviewers who don't have one yet.

Behavior:
- Fetches reviewer assignments from the API
- Renders the checklist template with context variables
- Posts editable checklist messages (one per reviewer)
- Skips reviewers who already have a checklist

## Configuration

Settings in `default-config.yaml`:
- `template` - Inline checklist template (markdown)
- `templateFile` - Filename of an uploaded template file

## Template Variables

Use these in custom templates:
- `{{manuscriptTitle}}` - The manuscript title
- `{{authors}}` - List of manuscript authors
- `{{reviewerName}}` - Name of the assigned reviewer

## Default Template

The built-in template covers:
- Scientific rigor (methodology, data analysis, statistics)
- Significance and novelty
- Scholarship (literature review, citations)
- Technical quality (writing, figures, references)
- Ethics and standards
- Reproducibility
- Overall assessment

## Permissions

- `read_manuscript`
- `send_messages`
