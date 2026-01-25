# Document Rendering and Templating System Plan

**Status: 🟡 Partially Implemented**

Core Markdown rendering with multi-engine templates (HTML, LaTeX, Typst) is complete via the `markdown-renderer-bot` and Pandoc microservice. Extended format support (Quarto, R Markdown, Jupyter) remains future work.

## Overview

This plan outlines a comprehensive document rendering and templating system for Colloquium that supports multiple input formats (Markdown, Quarto, R Markdown, LaTeX, etc.) and provides flexible, editor-friendly templating with progressive enhancement through bot-powered rendering.

## Core Philosophy

- **Progressive Enhancement**: Start with simple formats, progressively add complexity
- **Editor-Friendly**: Non-technical editors can manage templates using simple formats
- **Bot-Powered Flexibility**: Bots provide sophisticated rendering for different use cases
- **Format Agnostic**: Support any document format through extensible bot architecture
- **Template Inheritance**: Hierarchical template system from simple to complex

## Architecture Overview

### 1. Document Processing Pipeline

```
Input Document → Editor Calls Bot → Bot Processes → Template Applied → Output Generated
     ↓                ↓                   ↓                ↓                ↓
Markdown/LaTeX    @markdown-renderer  Image/Data/Code     Bot-Selected      HTML/PDF/DOCX
Quarto/RMD       @latex-publisher    Reference Links     Template Config   Print/Web/Archive
Custom Format    @quarto-processor   Asset Validation    Bot-Enhanced      Distribution
```

### 2. Template Configuration Files

```
Template Configurations (Static Files)
├── Markdown Templates
│   ├── article-basic.yaml
│   ├── review-simple.yaml
│   └── editorial-plain.yaml
├── LaTeX Templates  
│   ├── ieee-journal.yaml
│   ├── nature-style.yaml
│   └── apa-format.yaml
└── Specialized Templates
    ├── quarto-scientific.yaml
    ├── rmarkdown-stats.yaml
    └── jupyter-computational.yaml

Bot Commands (How Editors Use Them)
├── @markdown-renderer publish with article-basic
├── @latex-publisher convert to ieee-journal  
└── @quarto-processor render with scientific-template
```

## Template System Design

### 1. Editor-Friendly Base Templates

**Technology Choice: Enhanced Markdown with YAML Front Matter**

Why this choice:
- Readable by non-technical editors
- Widely supported and understood
- Easy to version control and diff
- Can be progressively enhanced
- Works well with existing tools

**Template Structure:**
```yaml
---
# Template Metadata
template_id: "article-basic"
template_name: "Basic Article Template"
template_version: "1.0"
journal_compatibility: ["colloquium-default", "open-science"]
editor_friendly: true

# Template Configuration
sections:
  - title
  - abstract
  - keywords
  - body
  - references
  - author_info

# Styling Options
style:
  font_family: "Times New Roman, serif"
  font_size: "12pt"
  line_spacing: "1.5"
  margin: "1in"
  citation_style: "apa"

# Bot Enhancement Options
bots:
  - name: "reference-formatter"
    required: false
    config:
      style: "apa"
  - name: "latex-converter"
    required: false
    config:
      template: "ieee-journal"
---

# {{title}}

## Authors
{{#each authors}}
**{{name}}**{{#if affiliation}} ({{affiliation}}){{/if}}{{#if email}} - {{email}}{{/if}}
{{/each}}

## Abstract
{{abstract}}

## Keywords
{{#each keywords}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}

## Introduction
{{body.introduction}}

## Methods
{{body.methods}}

## Results
{{body.results}}

## Discussion
{{body.discussion}}

## Conclusion
{{body.conclusion}}

## References
{{#each references}}
{{@index}}. {{this}}
{{/each}}

---
*Manuscript submitted to {{journal_name}} on {{submission_date}}*
```

### 2. Progressive Enhancement Levels

**Level 1: Basic Markdown (Editor-Friendly)**
- Simple Markdown syntax
- YAML front matter for metadata
- Handlebar templates for content insertion
- Human-readable and editable

**Level 2: Enhanced Markdown (Bot-Assisted)**
- Advanced Markdown features (tables, math, citations)
- Automated reference formatting
- Figure and table management
- Cross-reference resolution

**Level 3: Academic Formats (Bot-Powered)**
- LaTeX for mathematical content
- Quarto for reproducible research
- R Markdown for statistical analysis
- Jupyter notebooks for computational work

**Level 4: Custom Formats (Specialized Bots)**
- Domain-specific formats
- Custom renderers
- Specialized academic formats
- Integration with external tools

## Bot Architecture for Rendering

### 1. Conversational Rendering Bots

Editors call bots directly in conversations using `@bot-name command template-config` syntax.

**Markdown Renderer Bot**
```typescript
interface MarkdownRendererBot {
  // Called via: @markdown-renderer publish with article-basic
  // Called via: @markdown-renderer convert to html using nature-style
  
  publish(templateConfig: string): Promise<BotResponse>;
  preview(templateConfig: string): Promise<BotResponse>;
  listTemplates(): Promise<BotResponse>; // Show available templates
}
```

**LaTeX Publisher Bot**
```typescript
interface LaTeXPublisherBot {
  // Called via: @latex-publisher convert to ieee-journal
  // Called via: @latex-publisher compile with custom-style
  
  convert(templateConfig: string): Promise<BotResponse>;
  compile(templateConfig: string): Promise<BotResponse>;
  validate(): Promise<BotResponse>; // Check LaTeX syntax
}
```

**Format Converter Bot**
```typescript
interface FormatConverterBot {
  // Called via: @format-converter detect format
  // Called via: @format-converter markdown to latex
  // Called via: @format-converter latex to pdf using ieee-style
  
  detectFormat(): Promise<BotResponse>;
  convertTo(targetFormat: string, templateConfig?: string): Promise<BotResponse>;
  listSupportedFormats(): Promise<BotResponse>;
}
```

### 2. Content Processing Bots

**Reference Manager Bot**
```typescript
interface ReferenceManagerBot {
  // Called via: @reference-manager format citations apa
  // Called via: @reference-manager validate references
  // Called via: @reference-manager generate bibliography
  
  formatCitations(style: string): Promise<BotResponse>;
  validateReferences(): Promise<BotResponse>;
  generateBibliography(style: string): Promise<BotResponse>;
  fetchMetadata(doi: string): Promise<BotResponse>;
}
```

**Asset Manager Bot**
```typescript
interface AssetManagerBot {
  // Called via: @asset-manager optimize images
  // Called via: @asset-manager validate links
  // Called via: @asset-manager generate thumbnails
  
  optimizeAssets(options?: string): Promise<BotResponse>;
  validateLinks(): Promise<BotResponse>;
  generateThumbnails(): Promise<BotResponse>;
  checkAssets(): Promise<BotResponse>;
}
```

### 3. Specialized Format Bots

**Quarto Processor Bot**
```typescript
interface QuartoProcessorBot {
  // Called via: @quarto-processor render with scientific-template
  // Called via: @quarto-processor validate document
  // Called via: @quarto-processor export to pdf
  
  render(templateConfig: string): Promise<BotResponse>;
  validate(): Promise<BotResponse>;
  exportTo(format: string): Promise<BotResponse>;
}
```

**R Markdown Bot**
```typescript
interface RMarkdownBot {
  // Called via: @rmarkdown-processor run analysis
  // Called via: @rmarkdown-processor generate report with stats-template
  
  runAnalysis(): Promise<BotResponse>;
  generateReport(templateConfig: string): Promise<BotResponse>;
  validateCode(): Promise<BotResponse>;
}
```

## Template Configuration System

Templates are static configuration files that bots read. Editors manage templates through file uploads or a simple admin interface.

### 1. Template Storage Structure

```
/templates/
├── markdown/
│   ├── article-basic.yaml
│   ├── review-format.yaml
│   └── editorial-style.yaml
├── latex/
│   ├── ieee-journal.yaml
│   ├── nature-style.yaml
│   └── apa-format.yaml
└── specialized/
    ├── quarto-scientific.yaml
    ├── rmarkdown-stats.yaml
    └── jupyter-notebook.yaml
```

### 1. Template Discovery via Bots

Instead of a central registry, bots help editors discover and use templates:

```
Editor: @markdown-renderer list templates
Bot: Available templates: article-basic, review-format, editorial-style

Editor: @markdown-renderer preview with article-basic  
Bot: [Shows preview of current document with template applied]

Editor: @markdown-renderer publish with article-basic
Bot: [Renders final document and uploads to manuscript files]
```

### 2. Template Definition Schema

```typescript
interface TemplateDefinition {
  // Basic metadata
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  
  // Compatibility
  supportedFormats: string[];
  journalCompatibility: string[];
  editorFriendly: boolean;
  
  // Template content
  baseTemplate: string; // Markdown with handlebars
  styles: StyleDefinition;
  metadata: MetadataSchema;
  
  // Bot configuration
  requiredBots: BotRequirement[];
  optionalBots: BotOption[];
  
  // Template inheritance
  parentTemplate?: string;
  templateOverrides?: TemplateOverrides;
}

interface StyleDefinition {
  css?: string;
  latex?: string;
  typography: TypographyConfig;
  layout: LayoutConfig;
  colors: ColorConfig;
}

interface MetadataSchema {
  required: string[];
  optional: string[];
  fields: Record<string, FieldDefinition>;
}
```

## Implementation Strategy

### Phase 1: Foundation (Weeks 1-2)

**Template Configuration System**
- [ ] Create simple file-based template storage (/templates/ directory)
- [ ] Define YAML template configuration schema
- [ ] Build template loading utilities for bots
- [ ] Create basic template validation

**Basic Rendering Bot**
- [ ] Extend existing bot system for document processing
- [ ] Implement basic Markdown renderer bot with conversational interface
- [ ] Add template discovery commands (list, preview, publish)
- [ ] Add file access capabilities for bots to read manuscripts and upload outputs

### Phase 2: Template Library & Enhancement (Weeks 3-4)

**Template Library**
- [ ] Create starter template collection (article-basic, review-format, etc.)
- [ ] Template documentation and examples
- [ ] Simple template upload interface for admins
- [ ] Template versioning through file system

**Markdown Enhancement**
- [ ] Enhanced Markdown parser with academic features
- [ ] Math equation support (KaTeX/MathJax)
- [ ] Citation parsing and basic formatting
- [ ] Table and figure enhancement

### Phase 3: Bot-Powered Rendering (Weeks 5-6)

**Advanced Rendering Bots**
- [ ] Reference manager bot for citation processing (conversational interface)
- [ ] Asset manager bot for image and file handling
- [ ] LaTeX publisher bot for mathematical content
- [ ] Format converter bot for multi-format output

**Bot Conversational Features**
- [ ] Natural language command parsing for bot interactions
- [ ] Rich bot responses with file attachments and status updates
- [ ] Error handling and user-friendly error messages
- [ ] Bot help system (e.g., `@bot-name help`)

### Phase 4: Advanced Formats (Weeks 7-8)

**Extended Format Support**
- [ ] Quarto renderer bot
- [ ] R Markdown processor bot
- [ ] Jupyter notebook converter bot
- [ ] Custom format plugin system

**Production Features**
- [ ] Template performance optimization
- [ ] Batch processing capabilities
- [ ] Error handling and recovery
- [ ] Comprehensive testing suite

## Template Examples

### 1. Basic Article Template (Editor-Friendly)

```markdown
---
template_id: "basic-article"
template_name: "Basic Scientific Article"
editor_friendly: true
sections:
  - title
  - authors
  - abstract
  - keywords
  - introduction
  - methods
  - results
  - discussion
  - conclusion
  - references
---

# {{title}}

{{#each authors}}
**{{name}}**{{#if affiliation}} - {{affiliation}}{{/if}}
{{/each}}

## Abstract
{{abstract}}

**Keywords:** {{keywords}}

## Introduction
{{introduction}}

## Methods
{{methods}}

## Results
{{results}}

## Discussion
{{discussion}}

## Conclusion
{{conclusion}}

## References
{{references}}
```

### 2. Enhanced Article Template (Bot-Assisted)

```markdown
---
template_id: "enhanced-article"
template_name: "Enhanced Scientific Article"
editor_friendly: true
parent_template: "basic-article"
bots:
  - name: "reference-formatter"
    config: { style: "apa" }
  - name: "math-processor"
    config: { engine: "katex" }
  - name: "figure-manager"
    config: { auto_caption: true }
---

# {{title}}

{{> author_block}}

## Abstract
{{abstract}}

**Keywords:** {{format_keywords keywords}}

## Introduction
{{process_citations introduction}}

## Methods
{{process_math methods}}

## Results
{{process_figures results}}

## Discussion
{{process_citations discussion}}

## Conclusion
{{conclusion}}

{{> bibliography}}
```

### 3. LaTeX Template (Bot-Powered)

```latex
\documentclass[{{font_size}},{{paper_size}}]{article}
\usepackage[utf8]{inputenc}
\usepackage{amsmath,amssymb}
\usepackage{graphicx}
\usepackage{natbib}

% Template metadata
% template_id: latex-journal
% template_name: LaTeX Journal Article
% bot_powered: true

\title{ {{title}} }
\author{ {{format_latex_authors authors}} }
\date{ {{format_date submission_date}} }

\begin{document}

\maketitle

\begin{abstract}
{{abstract}}
\end{abstract}

\section{Introduction}
{{process_latex_content introduction}}

\section{Methods}
{{process_latex_content methods}}

\section{Results}
{{process_latex_figures results}}

\section{Discussion}
{{process_latex_content discussion}}

\section{Conclusion}
{{conclusion}}

\bibliographystyle{ {{citation_style}} }
\bibliography{ {{bibliography_file}} }

\end{document}
```

## Bot Enhancement Levels

### Level 1: Basic Processing Bots
- **Markdown Parser**: Basic Markdown to HTML conversion
- **Template Applicator**: Apply simple templates with variable substitution
- **Asset Linker**: Link and validate basic assets

### Level 2: Content Enhancement Bots
- **Reference Formatter**: Format citations and generate bibliographies
- **Math Processor**: Render mathematical equations
- **Figure Manager**: Process and optimize images and figures
- **Table Formatter**: Enhanced table formatting and styling

### Level 3: Advanced Rendering Bots
- **LaTeX Compiler**: Full LaTeX document compilation
- **PDF Generator**: High-quality PDF generation with custom styling
- **Interactive Content**: Generate interactive web content
- **Multi-format Exporter**: Export to multiple output formats

### Level 4: Specialized Bots
- **Domain-Specific Processors**: Field-specific formatting (chemistry, biology, etc.)
- **Reproducible Research**: Integration with computational environments
- **Accessibility Enhancer**: Generate accessible versions
- **Archive Formatter**: Long-term preservation formatting

## User Experience Flow

### For Editors (Publication Workflow)
1. **Review Submission**: Access manuscript conversation thread
2. **Call Rendering Bot**: Type `@markdown-renderer list templates` to see options
3. **Preview Output**: Type `@markdown-renderer preview with article-basic`
4. **Publish Document**: Type `@markdown-renderer publish with article-basic`
5. **Handle Updates**: Authors revise, editor calls bot again for updated version

### For Authors (Document Submission)
1. **Upload Document**: Submit via existing submission system (MD, LaTeX, etc.)
2. **Wait for Processing**: Editor or editorial bot processes submission
3. **Review Rendered Output**: See bot-generated previews in conversation
4. **Submit Revisions**: Upload revised documents as needed
5. **Final Approval**: See final published version generated by editor

### For Reviewers (Document Review)
1. **Access Conversation**: Join manuscript review conversation
2. **View Rendered Document**: See bot-generated HTML/PDF in conversation
3. **Request Formats**: Type `@format-converter export to pdf` if needed
4. **Provide Feedback**: Comment directly in conversation thread

## Example Conversational Workflows

### Basic Publishing Workflow
```
Editor: The author has submitted a markdown file. Let me see what templates we have available.

Editor: @markdown-renderer list templates

Bot: Available Markdown templates:
- article-basic: Simple article format
- article-enhanced: With figures and citations  
- review-format: Structured review template
- editorial-style: For editorial pieces

Editor: Let me preview this with our basic article template.

Editor: @markdown-renderer preview with article-basic

Bot: Preview generated! [Uploads preview.html]
The document renders well with this template. I found:
- Title: "Novel Approaches to X"
- 3 figures properly linked
- 42 references detected
- Estimated reading time: 12 minutes

Editor: Looks good. Let's also get a PDF version for the print archive.

Editor: @format-converter markdown to pdf using article-basic

Bot: PDF generated! [Uploads formatted.pdf]  
Document converted to PDF with journal styling applied.

Editor: Perfect. Now let me publish the final version.

Editor: @markdown-renderer publish with article-basic

Bot: Final publication generated! Files uploaded:
- final-article.html (web version)
- final-article.pdf (print version)
- final-article.xml (metadata)
Document is ready for publication.
```

### Advanced LaTeX Workflow
```
Editor: We have a LaTeX submission with complex mathematics. Let me process this.

Editor: @latex-publisher validate

Bot: LaTeX validation complete:
✓ Syntax is valid
✓ All packages available  
✓ 23 equations processed
⚠ Missing reference for equation (15)
✓ Bibliography compiles correctly

Editor: Good. Let's compile with our IEEE template.

Editor: @latex-publisher compile with ieee-journal

Bot: LaTeX compilation successful! [Uploads compiled.pdf]
Document compiled with IEEE journal template:
- 12 pages total
- All mathematics rendered correctly  
- IEEE citation format applied
- High-resolution PDF ready for print

Editor: Also generate a web-friendly version.

Editor: @format-converter latex to html using ieee-style

Bot: HTML conversion complete! [Uploads article.html]
LaTeX converted to responsive HTML with:
- MathJax rendering for equations
- IEEE styling preserved
- Mobile-friendly layout
- Accessible markup generated
```

## Technical Considerations

### 1. Performance Optimization
- **Template Caching**: Cache compiled templates for reuse
- **Incremental Rendering**: Only re-render changed sections
- **Async Processing**: Background rendering for large documents
- **Resource Management**: Limit bot resource usage

### 2. Security Considerations
- **Template Sandboxing**: Isolate template execution
- **Input Validation**: Validate all template inputs
- **Bot Permissions**: Restrict bot file access
- **Output Sanitization**: Sanitize generated content

### 3. Scalability Planning
- **Horizontal Scaling**: Distribute rendering across servers
- **Queue Management**: Handle rendering job queues
- **Resource Monitoring**: Monitor bot resource usage
- **Auto-scaling**: Scale based on demand

## Success Metrics

### 1. Editor Adoption
- Number of custom templates created
- Template usage across submissions
- Editor satisfaction with template tools
- Time to create and deploy templates

### 2. Author Experience
- Submission success rate across formats
- Time from submission to rendered output
- Author satisfaction with rendering quality
- Format diversity in submissions

### 3. System Performance
- Rendering time by format and complexity
- Bot execution success rate
- System resource utilization
- Error rates and recovery times

This comprehensive plan provides a foundation for building a flexible, editor-friendly document rendering and templating system that can grow from simple Markdown templates to sophisticated, bot-powered academic publishing workflows.