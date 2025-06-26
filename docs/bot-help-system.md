# Creating Bot Help: The Automated System

To ensure a consistent and high-quality user experience, all bots now feature an automated, robust help system. You no longer need to write a `help` command from scratch. This document explains how the system works and how you can easily customize it.

## The "Zero-Config" Default

By default, every bot automatically gets a powerful `help` command. You don't have to do anything.

- A user can type `@your-bot-name help`.
- The system will automatically generate a help message listing all available commands, using the `name` and `description` you've provided for each command in your bot's definition.

This means every bot has working help out-of-the-box.

## How Users Get Help

The help system supports two levels of detail for users:

1.  **General Help:** `@bot-name help`  
    Displays an overview of the bot and a list of all its commands.
2.  **Command-Specific Help:** `@bot-name help <command-name>`  
    Displays detailed information, usage, and examples for a single command.

## Customizing Help Content

While the default is great, you have several powerful, declarative options for enhancing the help content. We strongly recommend using these methods over writing a custom `help` command.

### Level 1: Adding Detailed Help for a Specific Command

To provide detailed help for a specific command (e.g., for `@bot help my-command`), add a `help` property to that command's definition. This is the ideal place for extended descriptions, usage examples, and parameter details.

```typescript
// In your bot definition:
commands: [
  {
    name: 'create-project',
    description: 'Creates a new project.', // Used in the main command list
    // The `help` property provides detailed content for this specific command.
    help: `Creates a new project in the system.

**Usage:**
\`@bot create-project --name "My Awesome Project" --due-date "2024-12-31"\`

**Parameters:**
- \`--name\`: (Required) The name of the project.
- \`--due-date\`: (Optional) The deadline for the project.`,
    // ...other command properties
  }
]
```

If a command does not have a `help` property, the system will auto-generate a basic help message from its other metadata (like its `parameters`).

### Level 2: Adding Custom Sections to the Main Help

To add custom sections to the main help output (for `@bot help`), use the `customHelpSections` property on your bot's definition. This is perfect for adding a "Getting Started" guide, support information, or general tips.

It's an array of objects, each with a `title`, `content`, and `position` (`'before'` or `'after'` the main command list).

```typescript
// In your bot definition:
const myBot: CommandBot = {
  id: 'project-manager-bot',
  name: 'Project Manager',
  commands: [ /* ...your commands... */ ],
  
  // Add custom sections to the main help output
  customHelpSections: [
    {
      title: '🚀 Getting Started',
      content: 'This bot helps you manage your projects. Use `create-project` to get started.',
      position: 'before' // Show this before the command list
    },
    {
      title: 'ℹ️ Support',
      content: 'For more help, contact the #dev-team channel.',
      position: 'after' // Show this after the command list
    }
  ]
};
```

### Level 3 (Advanced): Full Override

If you need complete control and the declarative options above are insufficient, you can implement your own `help` command. If a command named `help` is found in your bot's `commands` array, the automatic injection is skipped.

**Use this as a last resort.** It makes you responsible for maintaining the entire help output and you lose the benefits of the automated system.

```typescript
// In your bot definition:
commands: [
  // ...other commands
  {
    name: 'help',
    description: 'Shows custom help.',
    handler: async (context, args) => {
      // Your custom logic here
      return "This is a completely custom help message.";
    }
  }
]
```

## Summary & Best Practices

- **Don't write a `help` command.** Let the system generate it for you.
- **Use `command.description`** for a brief, one-line summary.
- **Use `command.help`** for detailed, multi-line explanations and examples for a specific command.
- **Use `bot.customHelpSections`** to add broad, contextual information to the main help screen.
- **Only use a full override** if you have a very unique requirement that cannot be met with the declarative options.
