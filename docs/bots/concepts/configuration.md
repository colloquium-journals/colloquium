# Bot Configuration

## default-config.yaml

Every bot package should include a `default-config.yaml` file in its root directory. This YAML file:

- Defines the bot's default configuration
- Preserves comments for display in the admin UI
- Is loaded when the bot is installed
- Can be edited at runtime by journal administrators

Example:
```yaml
# Markdown Renderer Configuration
#
# Template to use for rendering
templateName: "academic-standard"

# Output formats to generate
# Options: pdf, html
outputFormats:
  - pdf

# PDF rendering engine
# Options: typst, latex, html
pdfEngine: "typst"

# Whether to require a separate bibliography file
requireSeparateBibliography: false
```

## Accessing Config in Code

Bot configuration is available via `context.config`:

```typescript
async execute(params, context) {
  const mode = params.mode || context.config?.defaultMode || 'standard';
  const threshold = context.config?.threshold || 0.8;
  // ...
}
```

## Best Practices

1. **Use comprehensive comments** - Comments are displayed in the admin UI and serve as documentation
2. **Provide sensible defaults** - The bot should work without any configuration changes
3. **Group related settings** - Use YAML structure to organize settings logically
4. **Document valid values** - List allowed options in comments above each setting
5. **Keep it simple** - Only expose settings that admins actually need to change

## Admin UI

Journal administrators can edit bot configuration through:
1. Admin panel → Bot Management → Select bot → Configuration tab
2. The YAML editor preserves comments and formatting
3. Changes take effect immediately (no restart required)

## Migration from JSON

If you previously used `defaultConfig` in `package.json`, migrate to `default-config.yaml`:

1. Create `default-config.yaml` with the same settings
2. Add comments documenting each setting
3. Remove `defaultConfig` from the `colloquium` section of `package.json`
4. Add `"default-config.yaml"` to the `files` array in `package.json`
