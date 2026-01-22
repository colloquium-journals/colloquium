# Template Development Guide

This document explains how to create and manage templates for the Markdown Renderer Bot.

## Template Structure

Templates are stored as separate files in the `/templates/` directory, making them easy to create, modify, and distribute.

### File Structure

```
templates/
├── template-name.html    # HTML template with Handlebars syntax
└── template-name.json    # Metadata and configuration
```

### Template Files

#### HTML Template (`template-name.html`)
- Standard HTML file with Handlebars templating syntax
- Use `{{variable}}` for text variables
- Use `{{{variable}}}` for HTML content (like `{{{content}}}`)
- Use conditional blocks: `{{#if variable}}...{{/if}}`

#### Metadata File (`template-name.json`)
```json
{
  "name": "template-name",
  "title": "Human-Readable Template Name",
  "description": "Brief description of the template",
  "cssTemplate": "",
  "metadata": {
    "type": "academic|modern|journal",
    "responsive": true,
    "printOptimized": true,
    "features": ["typography", "branding", "etc"]
  }
}
```

## Available Template Variables

Templates have access to these variables:

### Document Content
- `{{title}}` - Manuscript title
- `{{abstract}}` - Abstract text
- `{{{content}}}` - Processed markdown content (HTML)

### Author Information
- `{{authors}}` - Simple comma-separated author list (legacy compatibility)
- `{{authorList}}` - Rich array of author objects with detailed information
- `{{authorCount}}` - Number of authors
- `{{correspondingAuthor}}` - Corresponding author object

**Rich Author Data** (available in `{{authorList}}`):
- `{{name}}` - Author's full name
- `{{email}}` - Email address (if available)
- `{{orcidId}}` - ORCID identifier
- `{{affiliation}}` - Institution/organization
- `{{bio}}` - Author biography
- `{{website}}` - Personal/professional website
- `{{isCorresponding}}` - Boolean: is this the corresponding author?
- `{{order}}` - Author order (0-indexed)
- `{{isRegistered}}` - Boolean: is this a registered user?

### Metadata
- `{{submittedDate}}` - Submission date
- `{{renderDate}}` - Current render date
- `{{journalName}}` - Journal name from settings

### Customization
- `{{customCss}}` - Custom CSS injected by user
- Any custom variables passed by specialized bots

## Built-in Templates

### 1. `academic-standard`
- Traditional academic journal styling
- Times New Roman typography
- Classic layout with abstract highlighting
- Print-optimized

### 2. `colloquium-journal`
- Modern academic journal with branding
- Crimson Text + Source Sans Pro typography
- Professional header with journal name
- Enhanced abstract styling
- Colloquium branding in footer

### 3. `minimal`
- Clean, minimal design
- Modern system fonts
- Simplified layout
- Good for drafts and informal documents

## Creating New Templates

### 1. Create Template Files
Create both `.html` and `.json` files in the `/templates/` directory:

```bash
templates/
├── my-journal.html
└── my-journal.json
```

### 2. Template HTML Structure
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>
    <style>
        /* Your CSS styles here */
        body {
            font-family: 'Your Font', serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
        }
        /* ... more styles ... */
    </style>
    {{#if customCss}}<style>{{customCss}}</style>{{/if}}
</head>
<body>
    <header>
        <h1>{{title}}</h1>
        {{#if authors}}<p class="authors">{{authors}}</p>{{/if}}
    </header>

    {{#if abstract}}
    <section class="abstract">
        <h3>Abstract</h3>
        <p>{{abstract}}</p>
    </section>
    {{/if}}

    <main class="content">
        {{{content}}}
    </main>

    <footer>
        <!-- Your footer content -->
    </footer>
</body>
</html>
```

### 3. Template Metadata
```json
{
  "name": "my-journal",
  "title": "My Journal Style",
  "description": "Custom template for My Journal publication",
  "cssTemplate": "",
  "metadata": {
    "type": "custom",
    "responsive": true,
    "printOptimized": true,
    "features": ["custom-branding", "special-typography"]
  }
}
```

### 4. Testing Templates
Templates are automatically loaded when the bot starts. Use these commands to test:

```
@markdown-renderer templates
@markdown-renderer render template="my-journal"
```

## Template Loading Process

1. **Startup**: Bot scans `/templates/` directory for `.html` files
2. **Pairing**: For each `.html` file, looks for matching `.json` file
3. **Validation**: Loads and validates template structure
4. **Caching**: Templates are cached in memory for performance
5. **Usage**: Templates are available via `@markdown-renderer render template="name"`

## Best Practices

### CSS Guidelines
- Use relative units (`em`, `rem`, `%`) for responsive design
- Include print styles with `@media print`
- Keep specificity low for easy customization
- Use CSS custom properties for theming

### HTML Structure
- Use semantic HTML elements (`<header>`, `<main>`, `<section>`)
- Include proper accessibility attributes
- Keep template variables clearly separated
- Use conditional blocks to handle optional content

### Performance
- Minimize external dependencies
- Optimize CSS for fast rendering
- Consider PDF generation constraints
- Keep templates under 100KB when possible

### Compatibility
- Test with various content lengths
- Ensure images and assets display correctly
- Validate HTML structure
- Test both web and PDF output

## Development Workflow

1. **Create** template files in `/templates/`
2. **Test** with sample content using bot commands
3. **Iterate** on design and functionality
4. **Validate** across different manuscript types
5. **Document** any special features or requirements

## File Distribution

Templates are included in the npm package automatically. When the bot is installed, all templates in `/templates/` are available immediately without additional configuration.

This makes templates feel like first-class citizens that can be easily created, shared, and modified by journal administrators and developers.

## See Also

- **[Author Templating Guide](AUTHOR_TEMPLATING.md)** - Comprehensive guide to working with rich author data in templates
- **[Template Examples](TEMPLATE_EXAMPLES.md)** - Usage examples and template comparisons