# Template Development Guide

## Quick Start

Templates support three rendering engines: HTML, LaTeX, and Typst. Create engine-specific template files with shared metadata.

## File Structure

```
templates/
├── my-template.html     # HTML template (optional)
├── my-template.tex      # LaTeX template (optional)  
├── my-template.typ      # Typst template (optional)
└── my-template.json     # Required metadata
```

## Metadata File (Required)

```json
{
  "name": "my-template",
  "title": "My Template",
  "description": "Brief description",
  "engines": ["html", "latex", "typst"],
  "defaultEngine": "typst",
  "metadata": {
    "type": "academic",
    "features": {
      "citations": true,
      "mathSupport": true
    }
  }
}
```

## Template Variables

All engines support these variables:

- `$title$` - Manuscript title
- `$authors$` - Author list (comma-separated)
- `$abstract$` - Manuscript abstract
- `$body$` - Rendered markdown content
- `$submittedDate$` - Submission date
- `$renderDate$` - Current date
- `$journalName$` - Journal name

## HTML Templates

Use Handlebars syntax:

```html
<!DOCTYPE html>
<html>
<head>
  <title>{{title}}</title>
</head>
<body>
  <h1>{{title}}</h1>
  {{#if authors}}<p>{{authors}}</p>{{/if}}
  <div>{{{content}}}</div>
</body>
</html>
```

## LaTeX Templates

Use Pandoc LaTeX syntax:

```latex
\documentclass{article}
\title{$title$}
$if(authors)$\author{$authors$}$endif$
\begin{document}
\maketitle
$if(abstract)$\begin{abstract}$abstract$\end{abstract}$endif$
$body$
\end{document}
```

## Typst Templates

Use Pandoc Typst syntax:

```typst
#let title = "$title$"
#let authors = "$authors$"

#align(center)[
  #text(size: 16pt, weight: "bold", title)
  #if authors != "" [#text(authors)]
]

$body$
```

## Engine Support

- **HTML**: Good for web display, basic PDF generation
- **LaTeX**: Best for complex academic papers, citations, math
- **Typst**: Modern alternative to LaTeX, faster compilation

## Installation

1. Create template files in `templates/` directory
2. Restart bot to reload templates
3. Configure journal to use new template via admin settings

## Testing

Use `@markdown-renderer templates` to verify your template loads correctly.