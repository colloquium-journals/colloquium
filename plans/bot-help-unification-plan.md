# Plan: Unifying Bot Help – Automated, Consistent, and Always Present

## Problem

- Currently, there are two help systems:
  - `getBotHelp()` (admin panel): auto-generated, technical, always available.
  - `help` command (user-facing): hand-written, can be missing, inconsistent, or outdated.
- This leads to duplicated effort, risk of missing help commands, and inconsistent user experience.

## Goal

- Guarantee that every bot always has a `help` command.
- The `help` command should be auto-generated from the same metadata as `getBotHelp()`.
- Allow bot developers to optionally add custom sections or override the default help, but never require manual implementation.
- Ensure both admin and user help are consistent and up-to-date.

## Approach

### 1. Centralize and Enhance Help Generation
- A single utility, `generateBotHelp(bot, options)`, will generate help text.
- It will support generating help for the entire bot (`@bot help`) and for specific commands (`@bot help <command-name>`).
- It will use bot and command metadata as the primary source of truth.

### 2. Smart `help` Command Injection
- On registration, if a bot does not define its own `help` command, one will be automatically injected.
- This default `help` command will:
  - Handle requests for both general help and command-specific help.
  - Call the centralized `generateBotHelp` utility.

### 3. Flexible, Multi-Level Customization (Optional)
- Bot developers have multiple, cascading options for customizing help content:
  - **Command-Level Descriptions**: Add an optional `help` property to a command's definition to provide more detailed explanations or examples for that specific command. The generator will use this in place of the default summary.
  - **Bot-Level Custom Sections**: Add a `customHelpSections` property to the bot definition. This property will be an array of `{title: string, content: string, position: 'before' | 'after'}` objects, allowing developers to add structured content before or after the main command list.
  - **Full Override**: For maximum flexibility, a developer can implement their own `help` command. The auto-injection logic will respect this and not add a default one. This is the "escape hatch" and should be used sparingly.

### 4. Update Core Logic
- The command parser and executor must be updated to recognize the injected `help` command and handle its optional argument (the command name).

### 5. Promote Convention Over Configuration
- The new default should be zero-config help.
- Documentation will guide developers to use the customization options instead of writing `help` commands from scratch, promoting consistency and reducing boilerplate.

## Implementation Steps

1. **Create the `generateBotHelp` utility**
   - It must handle two main cases: general help and command-specific help (e.g., `generateBotHelp(bot, { commandName: '...' })`).
   - It must read `command.help` for detailed descriptions and `bot.customHelpSections` for additional content, integrating them into the final output.

2. **Modify bot registration logic**
   - Before registering a bot, check for an existing `help` command in its `commands` array.
   - If not found, create and inject a default `help` command. This command's handler should parse for an optional argument (the target command name) and call `generateBotHelp` with the correct options.

3. **Update command parser/executor**
   - Ensure the parser can pass arguments to the `help` command handler (e.g., the `<command-name>` part of `@bot help <command-name>`).

4. **Refactor existing bots**
   - Systematically review existing bots.
   - Replace manual `help` commands with the new, declarative customization options (`command.help`, `bot.customHelpSections`).
   - Keep full `help` command overrides only where absolutely necessary.

5. **Update documentation**
   - Clearly document the three levels of customization: command-level `help`, bot-level `customHelpSections`, and full override.
   - Provide code examples for each customization method.
   - Explain how users can get help for specific commands.

## Example

**Bot developer experience (with advanced customization):**

```typescript
const myBot: CommandBot = {
  id: 'example-bot',
  name: 'Example Bot',
  // ...other properties...
  commands: [
    // No need to add a help command! It's auto-injected.
    {
      name: 'do-something',
      description: 'A short description for the command list.',
      // Optional: Provide detailed help for `@bot help do-something`
      help: `This command does something really important. 

**Usage:**
\`@bot do-something --with-flag\`

It has several parameters you should be aware of...`,
      // ...
    },
    {
      name: 'another-task',
      description: 'Does another task.',
      // No `help` property, so its detailed help will be auto-generated.
    }
  ],
  // Optional: Add custom sections to the main help output
  customHelpSections: [
    {
      title: 'Getting Started',
      content: 'This bot helps you manage your projects. Use `do-something` to get started.',
      position: 'before' // Show this before the command list
    },
    {
      title: 'Support',
      content: 'Contact support@example.com for help.',
      position: 'after' // Show this after the command list
    }
  ]
};
```

**User experience:**

- Typing `@example-bot help` returns a well-structured help message with the "Getting Started" section, the command list, and then the "Support" section.
- Typing `@example-bot help do-something` returns the custom, detailed `help` string provided for that command.
- Typing `@example-bot help another-task` returns auto-generated help based on its parameters and description.

## Benefits

- No more missing or outdated help commands.
- Consistent, professional help for all bots.
- Less work for bot developers.
- Easier onboarding for new bots and users.
- **Granular Control**: Developers can fine-tune help for specific commands without overriding the entire system.
- **Progressive Disclosure**: Users get a simple overview with `@bot help` and can dive into details with `@bot help <command-name>`.

---
