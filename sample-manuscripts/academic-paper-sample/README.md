# Sample Academic Paper for Testing

This sample manuscript demonstrates various Markdown features that the markdown-renderer-bot should handle:

## Included Features

### Text Formatting
- **Bold text** and *italic text*
- Headers (H1-H3)
- Numbered and bulleted lists
- Block quotes
- Code blocks and inline `code`

### Academic Elements
- Abstract with keywords
- Structured sections (Introduction, Methods, Results, Discussion, Conclusions)
- In-text citations using pandoc format (`[@author2024]`)
- Mathematical equations (LaTeX math)
- Tables with academic data
- Figure references with actual PNG placeholder images

### Bibliography
- Complete BibTeX file (`references.bib`) with various source types:
  - Journal articles
  - Conference proceedings  
  - Books
  - Technical reports
  - Online resources

### Testing Instructions

1. Upload both `manuscript.md` and `references.bib` to a manuscript submission
2. Use `@markdown-renderer render` to test PDF generation
3. Verify that:
   - Citations are properly formatted
   - Bibliography is generated
   - Tables and math render correctly
   - Structure is maintained across engines

### Expected Outputs

- **HTML**: Web-optimized version with embedded styles
- **LaTeX**: Professional academic formatting with proper citations
- **Typst**: Modern typesetting with clean layout

This sample covers the most common elements found in academic papers across disciplines.