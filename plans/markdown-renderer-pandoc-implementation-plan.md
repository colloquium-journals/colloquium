# Multi-Engine PDF Rendering Implementation Plan

**Status: ✅ Implemented**

## Overview
Replace Puppeteer with Pandoc supporting HTML, LaTeX, and Typst engines. All configuration is handled at the journal level through bot admin settings, not command arguments.

## Configuration-First Approach

### Journal Administrator Controls
- **PDF Engine**: Journal-wide choice (HTML, LaTeX, or Typst)
- **Template Selection**: Which template to use for the chosen engine
- **Citation Style**: CSL file for bibliography formatting
- **Output Format**: PDF-only, HTML-only, or both
- **Bibliography Requirements**: Whether separate .bib files are required

### Bot Configuration Schema
```json
{
  "pdfEngine": "typst",
  "templateName": "academic-standard",
  "citationStyle": "apa.csl",
  "outputFormats": ["pdf"],
  "requireSeparateBibliography": false,
  "fallbackEngine": "html"
}
```

## Simplified Command Interface

### Single Render Command
```bash
@markdown-renderer render
```

That's it. No arguments needed. The bot uses journal configuration to determine:
- Which PDF engine to use
- Which template to apply
- How to handle citations
- What output formats to generate

### Administrative Commands
```bash
@markdown-renderer templates  # List available templates for current engine
@markdown-renderer help       # Show current journal configuration
```

## Template Engine Support

### 1. HTML Engine (Default/Fallback)
- **Templates**: `.html` files with CSS
- **PDF Generation**: Pandoc HTML-to-PDF
- **Best For**: Journals preferring web-first workflows

### 2. LaTeX Engine
- **Templates**: `.tex` files 
- **PDF Generation**: Pandoc with LaTeX
- **Best For**: Traditional academic publishing

### 3. Typst Engine
- **Templates**: `.typ` files
- **PDF Generation**: Pandoc with Typst
- **Best For**: Modern typesetting without LaTeX complexity

## Template Structure (Simplified)
```
templates/
├── academic-standard-html.html
├── academic-standard-latex.tex
├── academic-standard-typst.typ
├── academic-standard.json (metadata)
├── minimal-html.html
├── minimal-latex.tex
├── minimal-typst.typ
└── minimal.json
```

## Configuration Management

### Journal Setup Process
1. Admin navigates to Bot Configuration → Markdown Renderer
2. Selects preferred PDF engine from dropdown
3. Chooses template from available options for that engine
4. Configures citation style and bibliography requirements
5. Sets output format preferences

### Template Availability
- Templates declare which engines they support
- Admin UI only shows compatible templates for selected engine
- Fallback to HTML engine if preferred engine fails

## Reference Processing

### Automatic Detection
- If separate `.bib` file uploaded → use for citations
- If no `.bib` file → assume inline/pre-formatted references
- Configuration determines whether .bib files are required

### Citation Styles
- Journal-wide CSL file configuration
- Support for standard styles (APA, MLA, Chicago, IEEE)
- Custom CSL upload capability

## Benefits

### For Journal Administrators
- **Simple Configuration**: One-time setup, consistent results
- **Full Control**: Determine publishing pipeline once
- **No User Confusion**: Authors don't need to learn template syntax

### For Authors
- **Zero Configuration**: Just upload markdown and render
- **Consistent Experience**: Same command always works
- **Focus on Content**: No technical decisions needed

### For System
- **Predictable Behavior**: Configuration-driven processing
- **Easier Support**: Clear journal-specific settings
- **Scalable**: New engines/templates added without changing interface

## Implementation Strategy
1. **Remove Puppeteer**: Clean up existing code
2. **Add Pandoc Integration**: Core conversion pipeline
3. **Implement Configuration Schema**: Journal-wide settings
4. **Create Template System**: Multi-engine template support
5. **Add Engine Support**: HTML → LaTeX → Typst
6. **Test with Real Papers**: Validate academic formatting
7. **Documentation**: Admin guide for configuration

## Next Steps
- Write this plan to `/plans/markdown-renderer-pandoc-implementation-plan.md`
- Begin implementation with Pandoc integration
- Create template system for multi-engine support