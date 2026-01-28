# Crossref DOI Integration

This document describes Colloquium's integration with Crossref for DOI (Digital Object Identifier) registration.

## Overview

Crossref is a DOI registration agency that provides persistent identifiers for scholarly content. Colloquium can automatically register DOIs with Crossref when manuscripts are published, making your articles discoverable and citable.

## Features

- **Automatic DOI Registration**: DOIs are automatically registered when articles are published
- **Test Mode Support**: Test with Crossref's sandbox before going to production
- **Structured Author Names**: Supports both parsed names and explicit givenNames/surname fields
- **ORCID Integration**: Author ORCID iDs are included in metadata
- **Funding Information**: FundRef program element with funder DOIs and grant numbers
- **Google Scholar Compatibility**: Rendered HTML includes proper citation meta tags

## Configuration

### Admin Settings

Configure Crossref integration in **Admin → Settings → Publishing**:

| Setting | Description | Example |
|---------|-------------|---------|
| Enable Crossref | Master toggle for DOI registration | On/Off |
| Crossref Username | Your Crossref account username | `myjournal` |
| Crossref Password | Your Crossref account password | `••••••••` |
| Test Mode | Use Crossref sandbox for testing | On (recommended for setup) |
| DOI Prefix | Your assigned DOI prefix | `10.12345` |
| Electronic ISSN | Your journal's e-ISSN | `1234-5678` |
| Abbreviated Title | Short journal title for citations | `J. Exp. Psychol.` |

### Getting Crossref Credentials

1. **Register with Crossref**: Visit [crossref.org](https://www.crossref.org/) to become a member
2. **Obtain DOI Prefix**: Crossref assigns a unique prefix (e.g., `10.12345`)
3. **Create API Credentials**: Get username/password from your Crossref dashboard
4. **Test First**: Always configure in test mode initially

## DOI Format

DOIs are generated in the format:

```
{prefix}/{year}.{manuscriptId}
```

Example: `10.12345/2024.abc12345`

## Publication Workflow

When a manuscript is published:

1. **DOI Generation**: A unique DOI suffix is created
2. **XML Generation**: Crossref schema 5.4.0 XML is built with manuscript metadata
3. **Deposit Submission**: XML is submitted to Crossref deposit API
4. **Status Tracking**: Result is stored in the manuscript record

### Status Values

| Status | Description |
|--------|-------------|
| `pending` | Submission in progress |
| `success` | DOI successfully registered |
| `failed` | Registration failed (see error field) |

## Database Fields

### Manuscripts Table

```prisma
// Publication metadata
volume               String?
issue                String?
elocationId          String?              // For online-only articles
articleType          String?              // research-article, review-article, etc.

// Key dates for Crossref
receivedDate         DateTime?            // Auto-set on submission
acceptedDate         DateTime?            // Set when accepted

// Crossref registration tracking
crossrefDepositId    String?
crossrefStatus       String?              // pending, success, failed
crossrefError        String?
crossrefRegisteredAt DateTime?
```

### Users Table

```prisma
// Structured name for Crossref/JATS
givenNames           String?
surname              String?
nameSuffix           String?
```

## Author Name Handling

Crossref requires structured names (given name + surname). Colloquium handles this in multiple ways:

1. **Explicit Fields**: If user has `givenNames` and `surname` set, these are used directly
2. **Parsed Names**: Otherwise, the `name` field is parsed:
   - `"John Smith"` → givenNames: "John", surname: "Smith"
   - `"Smith, John"` → givenNames: "John", surname: "Smith"
   - `"John A. Smith"` → givenNames: "John A.", surname: "Smith"

## Google Scholar Meta Tags

Published HTML includes citation meta tags for Google Scholar indexing:

```html
<meta name="citation_title" content="Article Title">
<meta name="citation_author" content="Smith, John">
<meta name="citation_author" content="Doe, Jane">
<meta name="citation_doi" content="10.12345/2024.abc12345">
<meta name="citation_publication_date" content="2024-06-15">
<meta name="citation_journal_title" content="Journal Name">
<meta name="citation_volume" content="5">
<meta name="citation_issue" content="2">
<meta name="citation_firstpage" content="e123">
<meta name="citation_issn" content="1234-5678">
<meta name="citation_pdf_url" content="https://...">
```

## Error Handling

If Crossref registration fails:

1. **Publication Continues**: The article is still published
2. **Error Logged**: Error details stored in `crossrefError` field
3. **Status Updated**: `crossrefStatus` set to `failed`
4. **Manual Retry**: Admin can retry later (future feature)

Common errors:
- Invalid credentials
- Network timeouts
- Schema validation failures
- Duplicate DOI

## XML Schema

Colloquium generates Crossref XML following schema version 5.4.0. The XML includes:

- Journal metadata (title, ISSN, abbreviated title)
- Article metadata (title, abstract, DOI)
- Contributors (authors with names, ORCID, affiliations)
- Publication dates (accepted, published)
- Resource URL (link to article)
- Funding information (FundRef program element)

Example structure:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<doi_batch xmlns="http://www.crossref.org/schema/5.4.0" version="5.4.0">
  <head>
    <doi_batch_id>colloquium-123456</doi_batch_id>
    <timestamp>123456789</timestamp>
    <depositor>
      <depositor_name>Publisher Name</depositor_name>
      <email_address>admin@journal.example.com</email_address>
    </depositor>
    <registrant>Publisher Name</registrant>
  </head>
  <body>
    <journal>
      <journal_metadata language="en">
        <full_title>Journal Name</full_title>
        <abbrev_title>J. Name</abbrev_title>
        <issn media_type="electronic">1234-5678</issn>
      </journal_metadata>
      <journal_issue>
        <journal_volume><volume>5</volume></journal_volume>
        <issue>2</issue>
      </journal_issue>
      <journal_article publication_type="full_text">
        <titles><title>Article Title</title></titles>
        <contributors>
          <person_name sequence="first" contributor_role="author">
            <given_name>John</given_name>
            <surname>Smith</surname>
            <ORCID>https://orcid.org/0000-0001-2345-6789</ORCID>
          </person_name>
        </contributors>
        <publication_date media_type="online">
          <month>06</month>
          <day>15</day>
          <year>2024</year>
        </publication_date>
        <doi_data>
          <doi>10.12345/2024.abc12345</doi>
          <resource>https://journal.example.com/articles/abc12345</resource>
        </doi_data>
      </journal_article>
    </journal>
  </body>
</doi_batch>
```

## Funding Information (FundRef)

Colloquium supports including funding information in Crossref deposits using the FundRef program element. This enables funders to track the publications resulting from their grants.

### Database Model

Funding is stored in the `manuscript_funding` table:

```prisma
model manuscript_funding {
  id           String      @id @default(cuid())
  manuscriptId String
  funderName   String      // e.g., "National Science Foundation"
  funderDoi    String?     // Crossref Funder Registry DOI, e.g., "10.13039/100000001"
  funderRor    String?     // ROR ID
  awardId      String?     // Grant number, e.g., "BCS-1234567"
  awardTitle   String?     // Grant title
  createdAt    DateTime    @default(now())
  manuscripts  manuscripts @relation(fields: [manuscriptId], references: [id], onDelete: Cascade)
}
```

### XML Format

When funding information is present, the Crossref XML includes a FundRef `<fr:program>` element:

```xml
<fr:program xmlns:fr="http://www.crossref.org/fundref.xsd">
  <fr:assertion name="fundgroup">
    <fr:assertion name="funder_name">
      National Science Foundation
      <fr:assertion name="funder_identifier">https://doi.org/10.13039/100000001</fr:assertion>
    </fr:assertion>
    <fr:assertion name="award_number">BCS-1234567</fr:assertion>
  </fr:assertion>
</fr:program>
```

### Funder Registry DOIs

The `funderDoi` field should contain a Crossref Funder Registry DOI. Common examples:

| Funder | DOI |
|--------|-----|
| National Science Foundation | `10.13039/100000001` |
| National Institutes of Health | `10.13039/100000002` |
| European Research Council | `10.13039/501100000781` |
| Wellcome Trust | `10.13039/100004440` |

You can look up funder DOIs at: https://www.crossref.org/services/funder-registry/

### Adding Funding During Submission

Authors add funding information during manuscript submission. The submission form collects:
- Funder name (required)
- Funder DOI (optional, from Crossref Funder Registry)
- Award/grant ID (optional)
- Award title (optional)

## API Reference

### CrossrefService

The `CrossrefService` class (`apps/api/src/services/crossrefService.ts`) provides:

```typescript
class CrossrefService {
  // Generate DOI suffix from manuscript ID
  generateDoiSuffix(manuscriptId: string): string

  // Build full DOI from prefix and suffix
  buildDoi(prefix: string, suffix: string): string

  // Parse name into given/surname
  parseName(name: string): { givenNames: string; surname: string }

  // Generate Crossref XML for a manuscript
  generateCrossrefXML(manuscriptId: string): Promise<string>

  // Submit deposit to Crossref API
  submitDeposit(xml: string, config: CrossrefConfig): Promise<CrossrefDepositResult>

  // Full registration workflow
  registerManuscript(manuscriptId: string): Promise<CrossrefDepositResult>
}
```

## Testing

### Test Mode

Always start with test mode enabled. This uses Crossref's test environment:
- Test endpoint: `https://test.crossref.org/servlet/deposit`
- Production endpoint: `https://doi.crossref.org/servlet/deposit`

### Validating XML

Use Crossref's XML validator to check your generated XML:
- https://www.crossref.org/02publishers/parser.html

### Running Tests

```bash
# Run Crossref service tests
cd apps/api && npx jest tests/services/crossrefService.test.ts

# Run settings schema tests
cd apps/api && npx jest tests/schemas/crossref-settings.test.ts
```

## Troubleshooting

### DOI Not Registered

1. Check `crossrefStatus` and `crossrefError` fields on manuscript
2. Verify credentials in admin settings
3. Confirm test mode is appropriate for your endpoint
4. Check Crossref dashboard for deposit status

### Invalid XML Errors

1. Check for special characters in title/abstract (should be escaped)
2. Verify author names are not empty
3. Ensure all required fields are present

### Network Errors

1. Check API connectivity from your server
2. Verify firewall allows outbound HTTPS to crossref.org
3. Check for rate limiting (Crossref has submission limits)

## Future Enhancements

- [ ] Manual retry button in admin UI
- [ ] Batch DOI registration for existing articles
- [ ] DOI metadata updates (for corrections)
- [ ] Reference DOI linking
- [ ] Crossref Event Data integration
- [ ] CRediT roles in Crossref XML (when fully supported by Crossref schema)
