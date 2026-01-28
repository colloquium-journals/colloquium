# Template Development Guide

## Quick Start

Templates support three rendering engines: HTML, LaTeX, and Typst. Create engine-specific template files with shared metadata.

## File Structure

```
templates/
└── my-template/
    ├── template.html     # HTML template (optional)
    ├── template.tex      # LaTeX template (optional)
    ├── template.typ      # Typst template (optional)
    └── template.json     # Required metadata
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
      "mathSupport": true,
      "citationHover": {
        "enabled": true,
        "links": ["doi", "googleScholar"]
      }
    }
  }
}
```

### Feature Flags

The `features` object controls template behavior:

| Feature | Type | Description |
|---------|------|-------------|
| `citations` | boolean | Enable citation support |
| `mathSupport` | boolean | Enable math rendering |
| `citationHover` | boolean or object | Enable citation hover tooltips (see below) |

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

1. Create a template folder in `templates/` directory (e.g., `templates/my-template/`)
2. Add `template.json` and at least one template file (`template.html`, `template.tex`, or `template.typ`)
3. Restart bot to reload templates
4. Configure journal to use new template via admin settings

## Citation Hover Feature

The citation hover feature displays a tooltip when users hover over inline citations, showing the full citation text plus links to external sources like DOI and Google Scholar.

### Configuration

Enable in `template.json`:

```json
{
  "metadata": {
    "features": {
      "citationHover": {
        "enabled": true,
        "links": ["doi", "googleScholar"]
      }
    }
  }
}
```

**Shorthand form**: Use `"citationHover": true` for defaults (DOI + Google Scholar links).

### Available Link Types

| Link Type | Description |
|-----------|-------------|
| `doi` | Direct DOI link (only shown if DOI detected in citation) |
| `googleScholar` | Google Scholar search by title |
| `pubmed` | PubMed search (useful for biomedical journals) |
| `semanticScholar` | Semantic Scholar search |

### Custom Links

Add custom link types with URL patterns:

```json
{
  "citationHover": {
    "enabled": true,
    "links": ["doi", "googleScholar", "journalArchive"],
    "customLinks": {
      "journalArchive": {
        "label": "Journal Archive",
        "urlPattern": "https://myjournal.org/search?q={title}"
      }
    }
  }
}
```

**Available URL pattern variables**:
- `{title}` - Extracted title from citation
- `{doi}` - DOI if present (empty string if not)
- `{text}` - Full citation text
- `{authors}` - Author portion of citation
- `{year}` - Publication year

### Adding to HTML Templates

To support citation hover in your template, add the following conditional block before `</body>`:

```html
$if(citationHover)$
<style>
.citation-tooltip {
    position: absolute;
    background: #fff;
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 12px;
    max-width: 400px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    z-index: 1000;
    font-size: 14px;
    line-height: 1.4;
    text-align: left;
    text-indent: 0;
}
.citation-tooltip-text { margin-bottom: 8px; }
.citation-tooltip-links {
    padding-top: 8px;
    border-top: 1px solid #eee;
    display: flex;
    gap: 16px;
}
.citation-tooltip-links a {
    color: #2c5aa0;
    text-decoration: none;
}
.citation[data-citation-hover] { cursor: pointer; }
@media print { .citation-tooltip { display: none !important; } }
</style>
<script>
(function() {
    var enabledLinks = $citationHoverLinks$;
    var customLinks = $citationHoverCustomLinks$;
    // ... (see built-in templates for full implementation)
})();
</script>
$endif$
```

The JavaScript reads citation data from Pandoc's output format:
- Inline citations: `<span class="citation" data-cites="smith2020">(Smith 2020)</span>`
- Bibliography entries: `<div id="ref-smith2020" class="csl-entry">Full citation...</div>`

### Accessibility

The citation hover implementation includes:
- Keyboard support via `tabindex` and `focus`/`blur` events
- `role="tooltip"` and `aria-describedby` attributes
- Links open in new tabs with `rel="noopener noreferrer"`

## Testing

Use `@markdown-renderer templates` to verify your template loads correctly.