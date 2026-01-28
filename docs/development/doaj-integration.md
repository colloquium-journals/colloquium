# DOAJ Integration

This document describes Colloquium's integration with DOAJ (Directory of Open Access Journals) for indexing and discoverability.

## Overview

DOAJ is a community-curated index of open access journals. By submitting article metadata to DOAJ, your articles become discoverable through their search interface and are included in their OAI-PMH feed, increasing visibility across scholarly databases.

## Features

- **Article XML Generation**: Generate DOAJ-compatible XML for published articles
- **API Submission**: Submit articles directly to DOAJ's article-level API
- **Auto-Submit Option**: Automatically submit when articles are published
- **Structured Metadata**: Includes authors, affiliations, keywords, and license information

## Configuration

### Admin Settings

Configure DOAJ integration in **Admin → Settings → Publishing**:

| Setting | Description | Example |
|---------|-------------|---------|
| Enable DOAJ | Master toggle for DOAJ submission | On/Off |
| DOAJ API Key | Your DOAJ API key | `••••••••` |
| Auto-Submit | Automatically submit on publish | On/Off |
| License URL | Default license URL for articles | `https://creativecommons.org/licenses/by/4.0/` |

### Getting DOAJ API Credentials

1. **Apply for DOAJ**: Your journal must first be indexed in DOAJ
2. **Get Publisher Account**: Access your DOAJ publisher dashboard
3. **Generate API Key**: Create an API key from your account settings
4. **Configure in Colloquium**: Add the key in Admin Settings

## Requirements

For DOAJ submission, articles should have:

- Title and abstract
- At least one author
- Publication date
- DOI (recommended but not required)
- License information
- Keywords (recommended)

## XML Format

Colloquium generates DOAJ XML following their article metadata schema:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<record xmlns="http://doaj.org/features/oai_doaj/1.0/">
  <language>eng</language>
  <publisher>Publisher Name</publisher>
  <journalTitle>Journal Name</journalTitle>
  <issn>1234-5678</issn>
  <eissn>8765-4321</eissn>
  <publicationDate>2024-06-15</publicationDate>
  <volume>5</volume>
  <issue>2</issue>
  <startPage>e123</startPage>
  <doi>10.12345/2024.abc12345</doi>
  <documentType>research-article</documentType>
  <title language="eng">Article Title</title>
  <authors>
    <author>
      <name>John Smith</name>
      <affiliationId>1</affiliationId>
      <orcid_id>0000-0001-2345-6789</orcid_id>
    </author>
  </authors>
  <affiliations>
    <affiliation>
      <affiliationId>1</affiliationId>
      <affiliationName>Stanford University, Department of Psychology</affiliationName>
    </affiliation>
  </affiliations>
  <abstract language="eng">Article abstract...</abstract>
  <keywords>keyword1, keyword2, keyword3</keywords>
  <fullTextUrl format="html">https://journal.example.com/articles/abc123</fullTextUrl>
  <license>
    <license_ref>https://creativecommons.org/licenses/by/4.0/</license_ref>
    <license_type>CC BY 4.0</license_type>
  </license>
</record>
```

## Database Fields

### Journal Settings

The following settings affect DOAJ submissions:

```typescript
doajEnabled: boolean     // Master toggle
doajApiKey: string       // API key for submission
doajAutoSubmit: boolean  // Auto-submit on publish
licenseUrl: string       // Default license URL
licenseType: string      // License display name (e.g., "CC BY 4.0")
```

## API Reference

### DoajService

The `DoajService` class (`apps/api/src/services/doajService.ts`) provides:

```typescript
class DoajService {
  // Generate DOAJ XML for a manuscript
  generateDoajXML(manuscriptId: string): Promise<string>

  // Submit article to DOAJ API
  submitToDoaj(manuscriptId: string): Promise<DoajSubmitResult>
}

interface DoajSubmitResult {
  success: boolean;
  articleId?: string;  // DOAJ article ID if successful
  error?: string;      // Error message if failed
}
```

### Usage Example

```typescript
import { doajService } from './services/doajService';

// Generate XML for preview
const xml = await doajService.generateDoajXML('manuscript-id');
console.log(xml);

// Submit to DOAJ
const result = await doajService.submitToDoaj('manuscript-id');
if (result.success) {
  console.log(`Submitted successfully: ${result.articleId}`);
} else {
  console.error(`Submission failed: ${result.error}`);
}
```

## Validation

Before submission, ensure:

1. **Manuscript is Published**: Only published articles can be submitted
2. **Required Fields**: Title, at least one author, publication date
3. **DOAJ Enabled**: Check settings have DOAJ enabled with valid API key

## Error Handling

If DOAJ submission fails:

1. **Publication Continues**: The article remains published
2. **Error Returned**: Error details in the result object
3. **Manual Retry**: Admin can retry submission later

Common errors:
- Invalid API key
- Missing required fields
- Duplicate article
- Network timeouts

## Testing

### Running Tests

```bash
cd apps/api && npx jest tests/services/doajService.test.ts
```

### Test Coverage

The test suite covers:
- XML generation with all fields
- Author ORCID handling
- Affiliation deduplication
- XML special character escaping
- Error cases (not published, not found)
- Settings validation (disabled, no API key)

## Differences from Crossref

| Feature | Crossref | DOAJ |
|---------|----------|------|
| Purpose | DOI registration | Open access indexing |
| Required | DOI prefix, credentials | Journal indexed in DOAJ |
| Metadata | Crossref schema 5.4.0 | DOAJ article schema |
| Trigger | Publication (with DOI) | Publication (optional) |

## Future Enhancements

- [ ] Bulk submission for existing articles
- [ ] Submission status tracking in database
- [ ] Admin UI for viewing submission history
- [ ] DOAJ metadata updates for corrections
