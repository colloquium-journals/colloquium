# DOI Assignment, Crossref Integration, and Indexing Services Plan

## Overview

This document outlines the requirements and implementation plan for DOI registration, Crossref integration, metadata submission, and indexing service compatibility for Colloquium journals.

**Key Principle**: Journal creators must handle individual registration with Crossref and indexing services, but Colloquium should automate and simplify the technical integration as much as possible.

---

## 1. DOI Registration via Crossref

### Membership Model

Each journal publisher (or parent organization) must become a [Crossref member](https://www.crossref.org/membership/) or work through a [Sponsoring Member](https://www.crossref.org/membership/about-sponsors/).

### Fee Structure (effective 2026)

| Publishing Revenue/Expenses | Annual Fee |
|---|---|
| < $1,000 | $200 |
| $1,000–$1M | $275 |
| $1M–$5M | $550 |
| $5M–$10M | $1,650 |
| $10M–$25M | $3,900 |

**Per-DOI fees**: $1.00 for journal articles (current), $0.15 for back-content

### What Journal Creators Must Do

1. Obtain their own [ISSN](https://www.issn.org/) (free, through national ISSN center)
2. Apply for Crossref membership in the name of the publishing organization
3. Receive a DOI prefix (e.g., `10.12345`)
4. Configure credentials in Colloquium

### What Colloquium Automates

- DOI suffix generation on publication
- Crossref XML metadata generation
- Automated deposit via HTTPS POST API
- Metadata updates when article info changes

---

## 2. Crossref XML Metadata Submission

### Technical Integration

Crossref accepts metadata via [HTTPS POST to their deposit endpoint](https://www.crossref.org/documentation/register-maintain-records/direct-deposit-xml/https-post/):

```
POST https://doi.crossref.org/servlet/deposit
Content-Type: multipart/form-data
```

### Required Metadata for Journal Articles

From [Crossref schema v5.4.0](https://www.crossref.org/documentation/schema-library/markup-guide-record-types/journals-and-articles/):

**Required**:
- Journal title & ISSN
- Article title
- At least one author
- Publication date
- DOI and landing page URL

**Recommended**:
- Authors with ORCID
- Abstract
- References/citations
- License/rights information
- Funding information

---

## 3. Alternative: DataCite

[DataCite](https://datacite.org/) is better suited for datasets and institutional repositories. For journals, **Crossref is the standard choice** as it:
- Powers citation linking across scholarly literature
- Integrates with Dimensions, Web of Science, Scopus
- Is expected by most indexing services

DataCite may be useful if journals also publish datasets alongside articles.

---

## 4. JATS XML Standard

[JATS (Journal Article Tag Suite)](https://jats.nlm.nih.gov/) is the industry standard XML format for scholarly articles.

### Where JATS is Required/Accepted

- PubMed Central (required)
- Library of Congress
- Portico, JSTOR
- Many national libraries and archives
- 25+ countries worldwide

### Relevance to Colloquium

The markdown-renderer-bot can be extended to produce JATS XML output, enabling compatibility with PMC and other archives.

---

## 5. Indexing Services

### Google Scholar

- **Process**: [Automatic crawling](https://scholar.google.com/intl/en/scholar/publishers.html) (no application needed)
- **Requirements**:
  - Proper HTML meta tags (`citation_title`, `citation_author`, `citation_pdf_url`, etc.)
  - Stable URLs per article
  - PDF files with searchable text
  - Content primarily scholarly articles
- **Timeline**: 4-8 weeks after meeting requirements
- **Colloquium Action**: Emit proper `<meta>` tags in published article HTML

### DOAJ (Directory of Open Access Journals)

- **Process**: [Manual application](https://doaj.org/publishers)
- **Requirements**:
  - Open access with no delay
  - Publishing history of 1+ years OR 10+ articles
  - Clear editorial/peer review policies
  - ISSN required
- **API**: [DOAJ API v4](https://doaj.org/api/v4/docs) supports automated article deposits
- **Colloquium Action**: Provide DOAJ XML export, optional API integration

### PubMed Central (Life Sciences only)

- **Process**: [Application via PMC Publisher Portal](https://pmc.ncbi.nlm.nih.gov/pub/addjournal/)
- **Requirements**:
  - Minimum 25 peer-reviewed articles
  - 2+ year publishing history
  - Life sciences/biomedical scope
  - Full-text XML (JATS format)
- **Note**: 24-month waiting period if rejected
- **Colloquium Action**: JATS XML export capability

---

## 6. Data Requirements for JATS XML

### Current Data in Colloquium vs. JATS Requirements

| Category | Currently Collected | Needed for JATS | Status |
|----------|---------------------|-----------------|--------|
| **Journal** | name, description | ISSN, publisher, abbreviated title | Missing |
| **Article** | title, abstract, keywords, doi | volume, issue, pages, article-type, dates | Partial |
| **Authors** | name, email, orcid, affiliation (string) | surname/given-names, structured affiliation, CRediT roles | Partial |
| **Funding** | — | funder name, grant ID, funder DOI | Missing |
| **License** | — | license type, copyright holder/year | Missing |
| **References** | via bibliography files | structured citation data | Requires parsing |

---

## 7. Schema Changes Required

### 7.1 Journal-Level Settings

Extend `journal_settings`:

```prisma
model journal_settings {
  // Existing fields...

  // JATS-required fields
  issn            String?    // Print ISSN (e.g., "1234-5678")
  eissn           String?    // Electronic ISSN
  publisherName   String?    // e.g., "University Press"
  publisherLoc    String?    // e.g., "New York, NY"
  abbrevTitle     String?    // e.g., "J. Exp. Psychol."
  journalDoi      String?    // Journal-level DOI if registered

  // Crossref integration
  crossrefUsername String?
  crossrefPassword String?   // Encrypted
  doiPrefix        String?   // e.g., "10.12345"
}
```

### 7.2 Article/Manuscript Metadata

Extend `manuscripts`:

```prisma
model manuscripts {
  // Existing fields...

  // Publication metadata
  volume          String?    // e.g., "42"
  issue           String?    // e.g., "3"
  fpage           String?    // First page (e.g., "125")
  lpage           String?    // Last page (e.g., "142")
  elocationId     String?    // For online-only: e.g., "e12345"
  articleType     String?    // research-article, review-article, editorial, etc.

  // Key dates (JATS history element)
  receivedDate    DateTime?  // Date manuscript received
  acceptedDate    DateTime?  // Date accepted for publication
  // publishedAt already exists

  // Licensing
  licenseType     String?    // e.g., "CC-BY-4.0", "CC-BY-NC-4.0"
  licenseUrl      String?    // e.g., "https://creativecommons.org/licenses/by/4.0/"
  copyrightHolder String?    // e.g., "The Authors" or "Publisher Name"
  copyrightYear   Int?       // e.g., 2025

  // Subject classification
  subjects        String[]   // e.g., ["Psychology", "Cognitive Science"]

  // Relations
  manuscript_funding manuscript_funding[]
}
```

### 7.3 Enhanced Author Information

Extend `users` for structured names:

```prisma
model users {
  // Existing fields...

  // Structured name (for JATS)
  givenNames      String?    // e.g., "John Michael"
  surname         String?    // e.g., "Smith"
  suffix          String?    // e.g., "Jr.", "III"
  // Keep existing 'name' as display name

  affiliations    affiliations[]
}
```

Extend `manuscript_authors` for per-article data:

```prisma
model manuscript_authors {
  // Existing fields...

  // CRediT contributor roles (array of role codes)
  creditRoles     String[]   // e.g., ["conceptualization", "writing-original-draft"]

  // Per-article affiliation override (if different from user profile)
  affiliationOverride String?
}
```

New structured affiliations model:

```prisma
model affiliations {
  id              String   @id @default(cuid())
  userId          String
  institution     String   // e.g., "Stanford University"
  department      String?  // e.g., "Department of Psychology"
  city            String?  // e.g., "Stanford"
  state           String?  // e.g., "CA"
  country         String   // e.g., "USA"
  countryCode     String?  // ISO 3166-1 alpha-2, e.g., "US"
  ror             String?  // ROR identifier, e.g., "https://ror.org/00f54p054"
  isPrimary       Boolean  @default(false)
  users           users    @relation(fields: [userId], references: [id])

  @@index([userId])
}
```

### 7.4 Funding Information

```prisma
model manuscript_funding {
  id              String      @id @default(cuid())
  manuscriptId    String
  funderName      String      // e.g., "National Science Foundation"
  funderDoi       String?     // Crossref Funder Registry DOI, e.g., "10.13039/100000001"
  funderRor       String?     // ROR ID
  awardId         String?     // Grant number, e.g., "BCS-1234567"
  awardTitle      String?     // Grant title
  recipientId     String?     // User ID of PI (links to ORCID)
  manuscripts     manuscripts @relation(fields: [manuscriptId], references: [id], onDelete: Cascade)
  users           users?      @relation(fields: [recipientId], references: [id])

  @@index([manuscriptId])
}
```

---

## 8. Reference Data: CRediT Roles, Article Types, Licenses

### CRediT Taxonomy (14 standard roles)

| Code | Display Label |
|------|---------------|
| `conceptualization` | Conceptualization |
| `data-curation` | Data curation |
| `formal-analysis` | Formal analysis |
| `funding-acquisition` | Funding acquisition |
| `investigation` | Investigation |
| `methodology` | Methodology |
| `project-administration` | Project administration |
| `resources` | Resources |
| `software` | Software |
| `supervision` | Supervision |
| `validation` | Validation |
| `visualization` | Visualization |
| `writing-original-draft` | Writing – original draft |
| `writing-review-editing` | Writing – review & editing |

### JATS Article Types

| Code | Description |
|------|-------------|
| `research-article` | Original research |
| `review-article` | Literature review |
| `brief-report` | Short communication |
| `case-report` | Clinical case study |
| `editorial` | Editorial/opinion |
| `letter` | Letter to editor |
| `correction` | Erratum/correction |
| `retraction` | Retraction notice |
| `book-review` | Book review |
| `reply` | Author reply |

### License Types

| Code | Name | URL |
|------|------|-----|
| `CC-BY-4.0` | CC Attribution 4.0 | `https://creativecommons.org/licenses/by/4.0/` |
| `CC-BY-SA-4.0` | CC Attribution-ShareAlike 4.0 | `https://creativecommons.org/licenses/by-sa/4.0/` |
| `CC-BY-NC-4.0` | CC Attribution-NonCommercial 4.0 | `https://creativecommons.org/licenses/by-nc/4.0/` |
| `CC-BY-NC-ND-4.0` | CC Attribution-NonCommercial-NoDerivs 4.0 | `https://creativecommons.org/licenses/by-nc-nd/4.0/` |
| `CC0-1.0` | Public Domain | `https://creativecommons.org/publicdomain/zero/1.0/` |

---

## 9. Data Collection Points in Workflow

| Stage | Data to Collect | UI Location |
|-------|-----------------|-------------|
| **User Registration** | Given name, surname, ORCID | Profile setup |
| **User Profile** | Structured affiliations (institution, dept, location, ROR) | Profile page |
| **Submission** | Article type, subjects, funding sources | Submission form |
| **Author Assignment** | Author order, corresponding author, CRediT roles, affiliation per article | Author management UI |
| **Acceptance** | Received/accepted dates (auto-captured), license selection | Editorial workflow |
| **Publication** | Volume, issue, pages/elocation-id, copyright holder | Publication form |
| **Journal Setup** | ISSN, publisher, Crossref credentials, DOI prefix | Admin settings |

---

## 10. Pandoc Integration for JATS Export

Pandoc [natively supports JATS output](https://pandoc.org/jats.html). Generate JATS from article metadata + content:

```bash
pandoc article.md -o article.xml \
  --to jats_publishing \
  --metadata-file=article-meta.yaml
```

### Metadata YAML Structure (generated from database)

```yaml
title: "Effects of Sleep on Memory Consolidation"
subtitle: "A Meta-Analysis"
author:
  - name:
      given-names: "Sarah"
      surname: "Johnson"
    email: "sjohnson@stanford.edu"
    orcid: "0000-0001-2345-6789"
    cor-id: true
    affiliation:
      - id: "aff1"
        organization: "Stanford University"
        department: "Department of Psychology"
        city: "Stanford"
        region: "CA"
        country: "USA"
    role:
      - Conceptualization
      - Writing – original draft
  - name:
      given-names: "Michael"
      surname: "Chen"
    affiliation:
      - ref: "aff1"
    role:
      - Formal analysis
      - Software

abstract: |
  Background: Sleep plays a critical role...

keywords:
  - sleep
  - memory
  - consolidation

article:
  type: research-article
  heading: "Original Research"

journal:
  title: "Journal of Experimental Psychology"
  abbrev-title: "J. Exp. Psychol."
  pissn: "1234-5678"
  eissn: "1234-5679"
  publisher:
    name: "Colloquium Press"
    loc: "Online"

volume: "42"
issue: "3"
elocation-id: "e2025001"

date:
  received: "2024-06-15"
  accepted: "2024-11-20"
  published: "2025-01-15"

doi: "10.12345/jep.2025.001"

copyright:
  holder: "The Authors"
  year: 2025

license:
  type: "CC-BY-4.0"
  link: "https://creativecommons.org/licenses/by/4.0/"

funding:
  - funder:
      name: "National Science Foundation"
      doi: "10.13039/100000001"
    award:
      id: "BCS-2012345"
```

---

## 11. Implementation Phases

### Phase 1: Core JATS/Crossref (enables DOI registration)

1. **Journal settings**: ISSN, publisher, DOI prefix, Crossref credentials
2. **Manuscript metadata**: volume, issue, elocation-id, license, copyright, article dates
3. **User names**: givenNames, surname (parse from existing name field as migration)
4. **Crossref XML generator**: Build XML from database, submit via API
5. **Google Scholar meta tags**: Emit proper `<meta>` tags in published HTML

### Phase 2: Enhanced Metadata (improves discoverability)

6. **Structured affiliations model** with ROR support
7. **CRediT roles** on manuscript_authors
8. **Funding sources model** with Crossref Funder Registry integration
9. **DOAJ XML export** and optional API integration

### Phase 3: Full JATS Compliance (enables PMC submission)

10. **JATS XML export** via Pandoc or custom generator
11. **Reference parsing** from bibliography files to structured format
12. **Subject classification** with controlled vocabularies
13. **PMC validation tools** integration

---

## 12. Sponsoring Member Option

Colloquium could potentially become a Crossref Sponsoring Member to simplify onboarding for very small journals (those under $1M revenue):

**Benefits**:
- Handle DOI registration on behalf of member journals
- Single point of contact with Crossref
- Simplified billing for small publishers

**Considerations**:
- Requires Crossref approval
- Administrative overhead for Colloquium
- Fee pass-through arrangement needed

---

## 13. Architecture Summary

```
Publication Workflow:

Article PUBLISHED → Generate DOI suffix
                  → Build Crossref XML
                  → POST to Crossref API
                  → Update article with DOI
                  → Emit meta tags for Google Scholar

Admin Settings (per journal):
├── Crossref credentials (username, password)
├── DOI prefix
├── ISSN (print and electronic)
├── Publisher name and location
├── Default license type
└── DOAJ API key (optional)

Export Capabilities:
├── Crossref XML (automatic on publish)
├── DOAJ XML (on demand or automatic)
├── JATS XML (on demand)
└── Google Scholar meta tags (automatic)
```

---

## 14. Testing and Validation Tools

### JATS Validators

| Tool | URL | Use Case |
|------|-----|----------|
| **JATS4R Validator** | https://jats4r.niso.org/jats4r-validator/ | General JATS validation + best practices |
| **PMC Style Checker** | https://pmc.ncbi.nlm.nih.gov/pub/validation/ | PMC submission preparation |
| **PMC Article Previewer** | https://pmc.ncbi.nlm.nih.gov/tools/article-previewer-intro/ | Preview how article renders |
| **NLM StyleChecker (download)** | https://pmc.ncbi.nlm.nih.gov/pub/stylechecker-info/ | Local/CI integration |
| **PeerJ jats-conversion** | https://github.com/PeerJ/jats-conversion | GitHub-based validation pipeline |

### Crossref Testing

| Tool | URL | Use Case |
|------|-----|----------|
| **Test Admin Console** | https://test.crossref.org/ | Test deposit workflows |
| **Sandbox API** | `sandbox.api.crossref.org` | API integration testing |
| **XML Parser** | Via Crossref documentation | Pre-submission schema validation |

**Verify DOI registration**: Enter `https://doi.org/YOUR-DOI` in browser to confirm resolution.

---

## Sources

- [Crossref Membership](https://www.crossref.org/membership/)
- [Crossref Fees](https://www.crossref.org/fees/)
- [Crossref XML Deposit](https://www.crossref.org/documentation/register-maintain-records/direct-deposit-xml/https-post/)
- [Crossref Schema Library](https://www.crossref.org/documentation/schema-library/)
- [DOAJ Publisher Guide](https://doaj.org/publishers)
- [DOAJ API v4](https://doaj.org/api/v4/docs)
- [PMC Application Process](https://pmc.ncbi.nlm.nih.gov/pub/addjournal/)
- [PMC File Specifications](https://pmc.ncbi.nlm.nih.gov/pub/filespec/)
- [Google Scholar Publisher Support](https://scholar.google.com/intl/en/scholar/publishers.html)
- [JATS Tag Library](https://jats.nlm.nih.gov/publishing/tag-library/1.3/)
- [JATS4R Recommendations](https://jats4r.niso.org/)
- [JATS4R CRediT Taxonomy](https://jats4r.niso.org/credit-taxonomy/)
- [JATS4R Funding](https://jats4r.niso.org/funding/)
- [Pandoc JATS Support](https://pandoc.org/jats.html)
- [CRediT Taxonomy (NISO)](https://credit.niso.org/)
- [Taylor & Francis JATS Guide](https://jats.taylorandfrancis.com/jats-guide/topics/authors-and-affiliations/)
