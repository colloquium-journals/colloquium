# Bot Configuration Guide

This guide explains how bot developers must create default configurations for their bots with helpful comments and documentation.

## Configuration Approach

### **Required: default-config.yaml file**

Create a `default-config.yaml` file in your bot's root directory:

```yaml
# My Bot Configuration
# Provide detailed descriptions of what your bot does

# This setting controls feature X
# Valid values: true/false
# Default: true
enableFeatureX: true

# Timeout settings in seconds
# Increase this value if you have slow network connections
# Range: 1-300 seconds
timeout: 30

# List of supported formats
# Add new formats as your bot evolves
supportedFormats:
  - "pdf"
  - "html"
  - "markdown"

# Advanced configuration
advanced:
  # Debug mode (only enable during development)
  debug: false
  
  # Custom processing options
  customOptions:
    quality: "high"
    compression: false
```

**Benefits:**
- ✅ **Rich comments and documentation** preserved in admin interface
- ✅ **Easy to edit** and maintain
- ✅ **Version control friendly** 
- ✅ **Better developer experience**
- ✅ **Enforces good documentation practices**

## File Structure

Your bot package should include:

```
my-bot/
├── package.json
├── default-config.yaml    ← Required
├── src/
│   └── index.ts
└── README.md
```

## How It Works

1. **Installation**: Colloquium loads configuration from `default-config.yaml` file
   - If the file doesn't exist, bot installs with empty configuration
   - Bot developers are strongly encouraged to provide comprehensive help documentation

2. **Comment Preservation**: All comments are preserved and displayed in the admin interface

3. **Runtime**: Administrators can edit the configuration using a YAML editor with syntax highlighting and validation

## Example: Markdown Renderer Bot

```yaml
# Markdown Renderer Bot Configuration
# Renders manuscript markdown files into formatted HTML/PDF output

# Default template to use for rendering
# Built-in options: "academic-standard", "minimal", "colloquium-journal"
# You can also specify custom template filenames uploaded via the Files tab
templateName: "academic-standard"

# Output formats to generate
# Options: ["html"] for web viewing, ["pdf"] for print, or both
# PDF generation requires additional processing time
outputFormats: ["pdf"]

# PDF generation engine
# "typst": Modern, fast typesetting (recommended)
# "latex": Traditional LaTeX processing (more compatibility)  
# "html": Convert HTML to PDF (fastest, basic formatting)
pdfEngine: "typst"
```

## Best Practices

1. **Comprehensive Comments**: Explain what each setting does, valid values, and when to change them

2. **Sensible Defaults**: Choose defaults that work for most users

3. **Grouping**: Use YAML objects to group related settings

4. **Validation**: Your bot should validate configuration and provide helpful error messages

5. **Documentation**: Include examples in your README.md

## Migration Guide

If you have an existing bot with JSON configuration in `package.json`:

1. Create `default-config.yaml` in your bot's root directory
2. Copy your configuration from `package.json` 
3. Convert to YAML format and add helpful comments
4. Remove `defaultConfig` from `package.json`
5. Test by reinstalling your bot in development

**Important**: The `package.json` `defaultConfig` field is no longer supported. All bots must use `default-config.yaml` files.