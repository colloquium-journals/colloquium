Implementation plan for the reviewer checklist bot.

Commands:

- generate: Generate a checklist for reviewers. By default, it will generate a checklist for all currently assigned reviewers that don't have a checklist yet. It can also generate a checklist for a specific reviewer by providing their ID.

Configration Options:

These options should be editable in the admin/bot configuration interface.

- template: Template for the checklist. This should be a markdown template that can be rendered into the final checklist. Provide a default template that can be used as a starting point.

When the bot is invoked, it should generate a checklist based on the template and the current state of the submission. This should not be a reply to the command. It should be a top level message, and it needs to be editable by the specific reviewer. 

The reviewer should be able to click the boxes on the checklist to mark items as done. These edits should be processed as simple updates to the markdown content of the checklist message, but without the reviewer needing to edit the markdown directly. This can be a universal implementation for all checklists. No special cases required.

