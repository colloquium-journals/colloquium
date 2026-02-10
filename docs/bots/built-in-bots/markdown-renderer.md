# bot-markdown-renderer

Renders Markdown manuscripts into professional PDFs and HTML using configurable journal templates and multiple rendering engines.

**Package:** `@colloquium/bot-markdown-renderer`
**Category:** formatting
**Default:** Yes (installed automatically)

## Commands

### render

Render Markdown files to PDF or HTML using journal templates.

```
@bot-markdown-renderer render [output=pdf|html] [template=name] [engine=typst|latex|html]
```

Parameters:
- `output` - Output format: `pdf`, `html`, or `pdf,html` (default: from config)
- `template` - Template name (default: `academic-standard`)
- `engine` - PDF rendering engine: `typst`, `latex`, or `html` (default: from config)

The bot:
1. Finds the Markdown source file
2. Downloads and processes content (asset linking, bibliography)
3. Applies the journal template
4. Generates output via the configured engine
5. Uploads the rendered file to the manuscript

### list-templates

List available rendering templates.

```
@bot-markdown-renderer list-templates
```

### upload-template

Upload a custom template file.

```
@bot-markdown-renderer upload-template
```

## Configuration

Key settings in `default-config.yaml`:
- `templateName` - Default template
- `outputFormats` - Default output format(s)
- `pdfEngine` - Default PDF engine (`typst`, `latex`, `html`)
- `requireSeparateBibliography` - Whether to require a `.bib` file

## Permissions

- `read_manuscript_files`
- `upload_files`

## Template System

Templates are loaded during bot installation via the `onInstall` hook. Each template is a directory containing engine-specific files (`.html`, `.tex`, `.typ`) and optional metadata (`template.json`).

## Service Dependencies

Requires a Pandoc service container for PDF generation.
