# Markdown Renderer Bot - Template Examples

This document shows examples of how to use the different templates available in the Markdown Renderer Bot.

## Available Templates

### 1. `academic-standard` (Default)
Classic academic journal layout with traditional typography.

**Usage:**
```
@markdown-renderer render
@markdown-renderer render template="academic-standard"
```

**Features:**
- Times New Roman typography
- Traditional academic styling
- Clean, professional layout
- Print-optimized design

### 2. `colloquium-journal` (New!)
Professional academic template with modern journal branding.

**Usage:**
```
@markdown-renderer render template="colloquium-journal"
@markdown-renderer render template="colloquium-journal" output="both"
```

**Features:**
- Modern typography (Crimson Text + Source Sans Pro)
- Professional journal branding
- Structured sections with clear hierarchy
- Responsive and print-optimized
- Enhanced styling for abstracts and metadata
- Colloquium branding in footer

### 3. `minimal`
Clean, minimal template with modern typography.

**Usage:**
```
@markdown-renderer render template="minimal"
```

**Features:**
- Modern sans-serif typography
- Minimal, clean design
- Good for informal articles or drafts

## Example Conversational Workflow

Here's an example of how editors would use the new Colloquium Journal template:

```
Editor: We have a new manuscript submission. Let me see what templates are available.

Editor: @markdown-renderer templates

Bot: 📝 **Available Journal Templates**

**Academic Standard** (`academic-standard`)
Clean, professional academic journal template

**Colloquium Journal Style** (`colloquium-journal`)
Professional academic template with journal branding and structured sections

**Minimal** (`minimal`)
Clean, minimal template with modern typography

💡 **Usage Examples:**
• `@markdown-renderer render template="academic-standard"` - Built-in template
• `@markdown-renderer render template="file:my-template"` - File-based template
• `@markdown-renderer render template="minimal" output="pdf"` - Generate PDF

Editor: Let me try the Colloquium journal template to see how it looks.

Editor: @markdown-renderer render template="colloquium-journal"

Bot: ✅ **Markdown Rendered Successfully**

**Source:** manuscript.md
**Template:** Colloquium Journal Style
**Output:** manuscript.html
**Size:** 45.2 KB

📎 **Assets Processed:** 3 files linked

🔗 **[View Rendered File](http://localhost:4000/api/files/123/download)**

Editor: Perfect! The branding looks great. Now let me generate both HTML and PDF versions for the final publication.

Editor: @markdown-renderer render template="colloquium-journal" output="both"

Bot: ✅ **Markdown Rendered Successfully**

**Source:** manuscript.md
**Template:** Colloquium Journal Style
**Outputs Generated:**
• HTML: manuscript.html (45.2 KB)
• PDF: manuscript.pdf (234.1 KB)

📎 **Assets Processed:** 3 files linked

**Download Links:**
🔗 [HTML](http://localhost:4000/api/files/123/download)
🔗 [PDF](http://localhost:4000/api/files/124/download)
```

## Template Features Comparison

| Feature | academic-standard | colloquium-journal | minimal |
|---------|------------------|-------------------|---------|
| Typography | Times New Roman | Crimson Text + Source Sans Pro | System Sans |
| Branding | Generic | Colloquium branded | None |
| Print Styles | ✅ | ✅ Enhanced | Basic |
| Responsive | ✅ | ✅ | ✅ |
| Abstract Styling | Basic highlight | Enhanced gradient box | Simple |
| Header Layout | Simple | Professional with metadata | Minimal |
| Code Highlighting | Basic | Enhanced with dark theme | Basic |
| Table Styling | Basic | Professional | Modern |

## Custom CSS Examples

You can enhance any template with custom CSS:

```
@markdown-renderer render template="colloquium-journal" customCss="
.journal-name { 
  color: #dc2626; 
}
.article-title { 
  font-size: 32px; 
}
"
```

## Template Metadata

Each template includes metadata for processing:

- **academic-standard**: `type: 'academic', responsive: true, printOptimized: true`
- **colloquium-journal**: `type: 'academic-journal', responsive: true, printOptimized: true, features: ['typography', 'branding', 'structured-sections']`
- **minimal**: `type: 'modern', responsive: true`

This metadata helps the bot apply appropriate rendering settings and optimizations.