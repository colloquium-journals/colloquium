# Example Custom Review Checklist Template

This is an example of a custom review checklist template that can be uploaded via the Files tab for the Reviewer Checklist Bot.

## Journal-Specific Criteria

- [ ] The manuscript aligns with our journal's scope and mission
- [ ] Authors have followed our submission guidelines
- [ ] The title is informative and follows our journal's style

## Scientific Quality

- [ ] Research question is clearly articulated and significant
- [ ] Methodology is sound and appropriate
- [ ] Data analysis is rigorous and well-documented
- [ ] Results are clearly presented and support conclusions

## Writing and Presentation

- [ ] Abstract effectively summarizes the work
- [ ] Introduction provides adequate background
- [ ] Methods are detailed enough for replication
- [ ] Discussion interprets results appropriately
- [ ] References are current and comprehensive

## Ethics and Reproducibility

- [ ] Appropriate ethics approvals obtained (if applicable)
- [ ] Data availability statement is provided
- [ ] Conflicts of interest are disclosed
- [ ] Code/materials are available as stated

## Template Variables

You can use the following variables in your template:
- `{{manuscriptTitle}}` - The manuscript title
- `{{authors}}` - List of manuscript authors  
- `{{reviewerName}}` - Name of the assigned reviewer

## Usage Instructions

1. Create your custom markdown template file
2. Upload it via the bot's Files tab in the admin interface
3. Set `templateFile` in the bot configuration to your uploaded filename
4. The bot will use your custom template for all new checklists

---
*Customize this template to match your journal's specific review criteria and standards.*