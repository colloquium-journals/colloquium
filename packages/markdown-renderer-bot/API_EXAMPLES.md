# API Response Examples

This document shows examples of how the Colloquium API provides author data to the Markdown Renderer Bot.

## Simple Author Submission

For basic manuscript submissions with just author names:

```json
{
  "id": "manuscript_123",
  "title": "Novel Approaches to Machine Learning",
  "abstract": "This paper presents...",
  "authors": ["Dr. John Doe", "Jane Smith", "Prof. Bob Wilson"],
  "submittedAt": "2024-01-15T10:30:00Z",
  "status": "SUBMITTED"
}
```

**Template receives:**
```javascript
{
  authors: "Dr. John Doe, Jane Smith, Prof. Bob Wilson",
  authorList: [
    {
      name: "Dr. John Doe",
      email: null,
      orcidId: null,
      affiliation: null,
      isCorresponding: true,  // First author assumed corresponding
      order: 0,
      isRegistered: false
    },
    // ... other authors
  ],
  authorCount: 3,
  correspondingAuthor: { name: "Dr. John Doe", ... }
}
```

## Detailed Author Submission

For manuscripts with registered authors and full metadata:

```json
{
  "id": "manuscript_456",
  "title": "Advanced Research in Computer Science",
  "abstract": "This comprehensive study...",
  "authors": ["Dr. Alice Johnson", "Dr. Bob Smith"],
  "authorRelations": [
    {
      "order": 0,
      "isCorresponding": true,
      "user": {
        "id": "user_789",
        "name": "Dr. Alice Johnson",
        "email": "alice.johnson@university.edu",
        "orcidId": "0000-0002-1825-0097",
        "orcidVerified": true,
        "affiliation": "Department of Computer Science, University of Technology",
        "bio": "Professor of Machine Learning and AI. Research interests include neural networks and deep learning applications.",
        "website": "https://alicejohnson.cs.university.edu"
      }
    },
    {
      "order": 1,
      "isCorresponding": false,
      "user": {
        "id": "user_790",
        "name": "Dr. Bob Smith",
        "email": "bob.smith@techcorp.com",
        "orcidId": "0000-0003-1234-5678",
        "orcidVerified": false,
        "affiliation": "TechCorp Research Division",
        "bio": null,
        "website": null
      }
    }
  ],
  "submittedAt": "2024-01-20T14:22:00Z",
  "status": "UNDER_REVIEW"
}
```

**Template receives:**
```javascript
{
  authors: "Dr. Alice Johnson, Dr. Bob Smith",
  authorList: [
    {
      id: "user_789",
      name: "Dr. Alice Johnson",
      email: "alice.johnson@university.edu",
      orcidId: "0000-0002-1825-0097",
      orcidVerified: true,
      affiliation: "Department of Computer Science, University of Technology",
      bio: "Professor of Machine Learning and AI. Research interests include neural networks and deep learning applications.",
      website: "https://alicejohnson.cs.university.edu",
      isCorresponding: true,
      order: 0,
      isRegistered: true
    },
    {
      id: "user_790",
      name: "Dr. Bob Smith",
      email: "bob.smith@techcorp.com",
      orcidId: "0000-0003-1234-5678",
      orcidVerified: false,
      affiliation: "TechCorp Research Division",
      bio: null,
      website: null,
      isCorresponding: false,
      order: 1,
      isRegistered: true
    }
  ],
  authorCount: 2,
  correspondingAuthor: {
    id: "user_789",
    name: "Dr. Alice Johnson",
    email: "alice.johnson@university.edu",
    // ... full corresponding author data
  }
}
```

## Mixed Registration Scenario

Some authors registered, some not:

```json
{
  "id": "manuscript_789",
  "title": "Collaborative Research Study",
  "authors": ["Dr. Registered User", "Guest Author Name"],
  "authorRelations": [
    {
      "order": 0,
      "isCorresponding": false,
      "user": {
        "id": "user_100",
        "name": "Dr. Registered User",
        "email": "registered@university.edu",
        "orcidId": "0000-0001-2345-6789",
        "orcidVerified": true,
        "affiliation": "Research University"
      }
    },
    {
      "order": 1,
      "isCorresponding": true,
      "user": null  // Guest author - no user account
    }
  ],
  "submittedAt": "2024-01-25T09:15:00Z"
}
```

**Template receives:**
```javascript
{
  authors: "Dr. Registered User, Guest Author Name",
  authorList: [
    {
      id: "user_100",
      name: "Dr. Registered User",
      email: "registered@university.edu",
      orcidId: "0000-0001-2345-6789",
      orcidVerified: true,
      affiliation: "Research University",
      bio: null,
      website: null,
      isCorresponding: false,
      order: 0,
      isRegistered: true
    },
    {
      id: null,
      name: "Guest Author Name",  // Fallback from authors array
      email: null,
      orcidId: null,
      orcidVerified: false,
      affiliation: null,
      bio: null,
      website: null,
      isCorresponding: true,
      order: 1,
      isRegistered: false
    }
  ],
  authorCount: 2,
  correspondingAuthor: {
    name: "Guest Author Name",
    // ... guest author data
  }
}
```

## Template Usage Examples

### Basic Display (All Scenarios)

```handlebars
<!-- Always works - falls back gracefully -->
<div class="authors">{{authors}}</div>
```

### Rich Display (When Available)

```handlebars
{{#if authorList}}
<div class="author-section">
  {{#each authorList}}
  <div class="author {{#if isRegistered}}registered{{else}}guest{{/if}}">
    <h4>{{name}} {{#if isCorresponding}}*{{/if}}</h4>
    
    {{#if isRegistered}}
    <!-- Full data available -->
    {{#if affiliation}}<p class="affiliation">{{affiliation}}</p>{{/if}}
    {{#if orcidId}}
    <p class="orcid">
      ORCID: <a href="https://orcid.org/{{orcidId}}">{{orcidId}}</a>
      {{#if orcidVerified}}<span class="verified">✓</span>{{/if}}
    </p>
    {{/if}}
    {{#if website}}<p><a href="{{website}}">Website</a></p>{{/if}}
    {{#if bio}}<p class="bio">{{bio}}</p>{{/if}}
    {{else}}
    <!-- Guest author -->
    <p class="guest-note">Guest contributor</p>
    {{/if}}
  </div>
  {{/each}}
  
  {{#if correspondingAuthor}}
  <p class="corresponding">
    * Corresponding author: {{correspondingAuthor.name}}
    {{#if correspondingAuthor.email}}
    (<a href="mailto:{{correspondingAuthor.email}}">{{correspondingAuthor.email}}</a>)
    {{/if}}
  </p>
  {{/if}}
</div>
{{else}}
<!-- Fallback for simple data -->
<div class="authors-simple">Authors: {{authors}}</div>
{{/if}}
```

## Bot Processing Logic

The `prepareAuthorData` function in the bot:

1. **Checks for detailed relations first**: `metadata.authorRelations`
2. **Falls back to simple array**: `metadata.authors`
3. **Handles mixed scenarios**: Some authors registered, some not
4. **Maintains order**: Uses `order` field from relations
5. **Identifies corresponding author**: Uses `isCorresponding` flag
6. **Provides compatibility**: Always generates simple `authors` string

This ensures templates work with any combination of author data complexity.