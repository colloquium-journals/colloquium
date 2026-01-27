# Academic Journal Template Improvements

This document outlines research findings and recommendations for improving the markdown-renderer-bot templates based on academic publishing standards and online-first journal capabilities.

## Current Template Summary

| Template | Engines | Focus | Key Strength |
|----------|---------|-------|--------------|
| **academic-standard** | HTML, LaTeX, Typst | Print/PDF output | Multi-format, Times serif typography |
| **colloquium-journal** | HTML only | Web-first with branding | Rich author metadata (ORCID, affiliations) |
| **minimal** | HTML, LaTeX, Typst | Clean modern look | System fonts, no frills |

### Current Gaps

- Only `colloquium-journal` supports structured author metadata (ORCID, affiliations)
- No schema.org structured data for search engine discoverability
- Missing standard academic metadata fields (DOI, funding, ethics statements)
- Limited accessibility features
- No interactive element support for online-first publishing
- `colloquium-journal` lacks LaTeX/Typst engines

---

## Recommended Improvements

### 1. Standardize Metadata Schema Across Templates

Currently, only `colloquium-journal` supports rich author metadata. All templates should support:

```json
{
  "authors": [
    {
      "name": "Jane Smith",
      "givenName": "Jane",
      "familyName": "Smith",
      "affiliation": "Department of Psychology, University Example",
      "orcid": "0000-0002-1234-5678",
      "email": "jsmith@example.edu",
      "isCorresponding": true,
      "roles": ["Conceptualization", "Writing - Original Draft"]
    }
  ]
}
```

**Rationale**: JATS XML and Crossref require structured author data for indexing. ORCID disambiguates authors, and CRediT roles (Contributor Roles Taxonomy) are increasingly required by journals.

### 2. Add Schema.org Structured Data

Embed ScholarlyArticle JSON-LD in HTML templates:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ScholarlyArticle",
  "headline": "{{title}}",
  "author": [...],
  "datePublished": "{{publishedDate}}",
  "identifier": {
    "@type": "PropertyValue",
    "propertyID": "DOI",
    "value": "{{doi}}"
  }
}
</script>
```

**Rationale**: W3C Scholarly HTML recommends schema.org vocabulary for search engine discoverability. About 26% of web pages now embed structured data, and academic publishers are early adopters.

### 3. Expand Required Metadata Fields

Add support for these commonly required fields:

| Field | Purpose | Standard |
|-------|---------|----------|
| `doi` | Permanent identifier | Crossref |
| `keywords` | Subject classification | JATS |
| `funding` | Funder acknowledgment | JATS/Crossref |
| `dataAvailability` | Data sharing statement | Journal policy |
| `conflictOfInterest` | COI disclosure | ICMJE |
| `ethicsApproval` | IRB/ethics statement | Journal policy |
| `articleType` | Research article, review, etc. | JATS |
| `license` | CC-BY, etc. | Open access |
| `receivedDate`, `acceptedDate`, `publishedDate` | Publication timeline | Standard |

### 4. Accessibility Improvements (WCAG 2.2 AA)

Research shows only 10-15% of scholarly PDFs meet accessibility standards. Add:

- **Semantic HTML**: Use `<article>`, `<section>`, `<header>`, `<nav>`, `<aside>` elements
- **ARIA landmarks**: `role="doc-abstract"`, `role="doc-bibliography"` (DPUB-ARIA)
- **Alt text placeholders**: Require `alt` for figures: `<figure><img alt="{{figure.alt}}">...</figure>`
- **Skip links**: Add "Skip to content" link for screen readers
- **Color contrast**: Ensure 4.5:1 minimum ratio
- **Reading order**: Logical tab order and heading hierarchy

### 5. Online-First Interactive Features

As an online-first journal, Colloquium can support features impossible in print:

#### 5a. Embedded Interactive Elements

- **Interactive figures**: Support `<iframe>` embeds for Plotly, Observable, or Shiny visualizations
- **Code blocks with execution**: Integration with platforms like Binder or Google Colab
- **Data tables**: Sortable/filterable tables with DataTables.js or similar
- **3D models**: Support for embedded 3D viewers (relevant for medical/engineering)

#### 5b. Annotation and Discussion

- Inline annotations (Hypothesis integration)
- Paragraph-level commenting
- Version comparison tools

#### 5c. Citation and Metrics Integration

- **Altmetrics badge**: Embed Altmetric donut showing social media attention
- **Citation counts**: Display Crossref or Semantic Scholar citation data
- **Data/code badges**: Show Open Data, Open Code badges

### 6. Template-Specific Improvements

#### academic-standard

- Add LaTeX/Typst templates for `authorList` (currently only supports string)
- Add bibliography style options (APA, Vancouver, Chicago)
- Support line numbering for review copies

#### colloquium-journal

- **Add LaTeX/Typst engines** for PDF generation consistency
- Add header/footer customization options
- Support for supplementary materials section

#### minimal

- Enable citation support (currently disabled in metadata)
- Add dark mode support for web viewing

### 7. New Metadata Sections to Support

```json
{
  "sections": {
    "dataAvailability": {
      "statement": "Data available at...",
      "repository": "OSF",
      "doi": "10.17605/osf.io/xxxxx"
    },
    "codeAvailability": {
      "statement": "Code available at...",
      "repository": "GitHub",
      "url": "https://github.com/..."
    },
    "supplementaryMaterials": [
      { "label": "Table S1", "description": "...", "file": "..." }
    ],
    "funding": [
      { "funder": "NSF", "grantNumber": "123456", "recipient": "J. Smith" }
    ],
    "acknowledgments": "We thank...",
    "authorContributions": "JS conceived the study...",
    "competingInterests": "The authors declare no competing interests."
  }
}
```

### 8. Print/PDF Improvements

- **Running headers**: Author name (left), short title (right)
- **Page numbers**: "Page X of Y" format
- **Widow/orphan control**: CSS `orphans: 3; widows: 3;`
- **Figure placement**: Support for float positioning hints
- **Two-column option**: Common for conference papers

### 9. Multi-language Support

Add i18n for labels:

```json
{
  "labels": {
    "abstract": { "en": "Abstract", "es": "Resumen", "de": "Zusammenfassung" },
    "keywords": { "en": "Keywords", "es": "Palabras clave" },
    "references": { "en": "References", "es": "Referencias" }
  }
}
```

### 10. Version and Preprint Support

Online-first journals often show version history:

- Version badge (v1, v2, etc.)
- "This is a preprint" banner
- Link to peer-reviewed version
- Revision history summary

---

## Priority Implementation Order

### High Priority (core academic requirements)

- [x] Standardized author metadata with ORCID/affiliations across all templates
- [x] DOI field and proper citation metadata
- [x] Schema.org structured data
- [x] Accessibility improvements (semantic HTML, ARIA, alt text)

### Medium Priority (differentiation for online-first)

- [x] Data/code availability sections
- [x] Interactive element support (iframes, sortable tables) - HTML container added
- [ ] Altmetrics integration - placeholder added
- [x] Typst engine for maximal template

### Lower Priority (nice-to-have)

- [ ] Multi-language support
- [x] Dark mode (in maximal template)
- [ ] Annotation integration (Hypothesis)
- [x] Version tracking UI (version/preprint banners)

---

## Implementation Status

### Completed (January 2025)

1. **Updated `academic-standard` template** with:
   - Structured author metadata (ORCID, affiliations, corresponding author)
   - DOI support with proper linking
   - Keywords field
   - Schema.org JSON-LD structured data
   - Dublin Core and Google Scholar citation metadata
   - Accessibility improvements (skip links, ARIA roles, focus states)
   - All three engines updated (HTML, Typst, LaTeX)

2. **Created `maximal` template** with all features:
   - All academic-standard features plus:
   - Dark mode support (CSS custom properties with prefers-color-scheme)
   - Version/preprint banners
   - Interactive element containers
   - Data availability section
   - Code availability section
   - Supplementary materials list
   - Funding section
   - Author contributions (CRediT roles)
   - Competing interests
   - Ethics statement
   - Acknowledgments
   - HTML and Typst engines

3. **Extended `RenderOptions` interface** to support all new metadata fields

4. **Added seed data paper** (`reproducibleResearch`) that exercises all maximal template features

5. **Updated seed process** to:
   - Support per-manuscript template configuration
   - Render papers with different templates (academic-standard, colloquium-journal, minimal, maximal)
   - Pass extended metadata for maximal template

---

## References

- [OA Journals Toolkit - Article and Journal Metadata](https://www.oajournals-toolkit.org/infrastructure/article-and-journal-metadata)
- [NYU Metadata Basics and Best Practices](https://guides.nyu.edu/journal-publishing/discovery-metadata/basics)
- [JATS: Journal Article Tag Suite](https://jats.nlm.nih.gov/)
- [Schema.org ScholarlyArticle](https://schema.org/ScholarlyArticle)
- [W3C Scholarly HTML](https://w3c.github.io/scholarly-html/)
- [WCAG 2.2 for Academic Publishers](https://kryonknowledgeworks.com/blogs/wcag-2-2-explained-for-academic-publishers)
- [Accessibility Crisis in Scholarly PDFs](https://arxiv.org/html/2410.03022v1)
- [FSU Guide to Altmetrics](https://guides.lib.fsu.edu/academicpublishing/altmetrics)
- [Nature: Data Visualization Tools](https://www.nature.com/articles/d41586-018-01322-9)
- [Manifold Publishing Platform](https://guides.nyu.edu/journal-publishing/platforms)
