# Commands and Parameters

## Command Syntax

```
@bot-name command-name param1="value1" param2=value2
```

- Bot IDs always start with `bot-`
- Command names are lowercase with hyphens
- Parameters use `name=value` or `name="value with spaces"` syntax
- Boolean parameters: `flag=true` or `flag=false`

## Defining Commands

Each command is a `BotCommand` object:

```typescript
const myCommand: BotCommand = {
  name: 'analyze',
  description: 'Short description shown in help',
  usage: '@bot-name analyze [mode=standard]',
  parameters: [
    {
      name: 'mode',
      description: 'Analysis mode',
      type: 'enum',
      required: false,
      defaultValue: 'standard',
      enumValues: ['basic', 'standard', 'detailed'],
      examples: ['basic', 'standard', 'detailed']
    }
  ],
  examples: ['@bot-name analyze', '@bot-name analyze mode=detailed'],
  permissions: ['read_manuscript'],
  help: 'Optional detailed help text for this specific command.',
  async execute(params, context) {
    // params.mode is already parsed and validated
    return { messages: [{ content: 'Result' }] };
  }
};
```

## Parameter Types

| Type | Description | Example |
|------|-------------|---------|
| `string` | Free-form text | `message="Hello world"` |
| `number` | Numeric value | `timeout=30` |
| `boolean` | True/false flag | `detailed=true` |
| `enum` | Constrained set | `mode=standard` |
| `array` | Comma-separated | `reviewers=a@b.com,c@d.com` |

Parameters can include a `validation` field with a Zod schema for custom validation.

## Auto-Generated Help

Every bot automatically gets a `help` command. No code required.

- `@bot-name help` shows overview, all commands, and examples
- `@bot-name help command-name` shows detailed help for a specific command

The auto-help system uses data from your command definitions (description, usage, parameters, examples).

## Customizing Help

### Level 1: Command-level help

Add a `help` property to individual commands for detailed content:

```typescript
const myCommand: BotCommand = {
  name: 'check-doi',
  help: `Detailed multi-line help content...`,
  // ...
};
```

### Level 2: Custom help sections

Add sections before or after the auto-generated content:

```typescript
const bot: CommandBot = {
  customHelpSections: [
    {
      title: 'Getting Started',
      content: 'Step-by-step guide...',
      position: 'before'
    },
    {
      title: 'Support',
      content: 'Contact info...',
      position: 'after'
    }
  ],
  // ...
};
```

### Level 3: Full override

Define a `help` command in your commands array to fully replace auto-help. Use sparingly.
