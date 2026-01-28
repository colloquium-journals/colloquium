# Author Templating Guide

The Markdown Renderer Bot provides rich author data to templates, giving developers fine-grained control over how authors are displayed. This guide explains the available data structures and provides examples.

## Author Data Structure

Templates receive author information in several formats to accommodate different use cases:

### 1. Legacy Simple Format (Backward Compatibility)

```handlebars
{{authors}} <!-- "John Doe, Jane Smith, Bob Wilson" -->
```

### 2. Rich Author Array (Recommended)

```handlebars
{{#each authorList}}
  <!-- Each author object contains: -->
  {{name}}            <!-- Author's full name -->
  {{email}}           <!-- Email address (if available) -->
  {{orcidId}}         <!-- ORCID identifier -->
  {{affiliation}}     <!-- Institution/organization -->
  {{bio}}             <!-- Author biography -->
  {{website}}         <!-- Personal/professional website -->
  {{isCorresponding}} <!-- Boolean: is this the corresponding author? -->
  {{order}}           <!-- Author order (0-indexed) -->
  {{isRegistered}}    <!-- Boolean: is this a registered user? -->
{{/each}}
```

### 3. Aggregate Data

```handlebars
{{authorCount}}       <!-- Number of authors -->
{{correspondingAuthor}} <!-- Full corresponding author object -->
```

## Template Examples

### Basic Author List

```html
{{#if authorList}}
<div class="authors">
  {{#each authorList}}
  <span class="author">{{name}}</span>{{#unless @last}}, {{/unless}}
  {{/each}}
</div>
{{else}}
<!-- Fallback to simple string -->
<div class="authors">{{authors}}</div>
{{/if}}
```

### Professional Author Display

```html
{{#if authorList}}
<div class="author-section">
  {{#each authorList}}
  <div class="author">
    <h4 class="author-name">
      {{name}}
      {{#if isCorresponding}}<sup>*</sup>{{/if}}
    </h4>
    
    {{#if affiliation}}
    <div class="affiliation">{{affiliation}}</div>
    {{/if}}
    
    {{#if orcidId}}
    <div class="orcid">
      <a href="https://orcid.org/{{orcidId}}" target="_blank">
        <img src="https://orcid.org/sites/default/files/images/orcid_16x16.png" alt="ORCID">
        {{orcidId}}
      </a>
    </div>
    {{/if}}
    
    {{#if website}}
    <div class="website">
      <a href="{{website}}" target="_blank">{{website}}</a>
    </div>
    {{/if}}
  </div>
  {{/each}}
  
  {{#if correspondingAuthor}}
  <div class="corresponding-info">
    <sup>*</sup> Corresponding author: 
    {{#if correspondingAuthor.email}}
    <a href="mailto:{{correspondingAuthor.email}}">{{correspondingAuthor.email}}</a>
    {{else}}
    {{correspondingAuthor.name}}
    {{/if}}
  </div>
  {{/if}}
</div>
{{/if}}
```

### Compact Academic Format

```html
{{#if authorList}}
<div class="authors-compact">
  {{#each authorList}}
  <span class="author">
    {{name}}{{#if affiliation}} ({{affiliation}}){{/if}}{{#if isCorresponding}}<sup>*</sup>{{/if}}
  </span>{{#unless @last}}, {{/unless}}
  {{/each}}
</div>
{{/if}}
```

### ORCID-Enhanced Display

```html
{{#if authorList}}
<div class="authors-with-orcid">
  {{#each authorList}}
  <div class="author-card">
    <div class="author-header">
      <span class="name">{{name}}</span>
      {{#if orcidId}}
      <a href="https://orcid.org/{{orcidId}}" class="orcid-link" target="_blank" rel="noopener">
        <img src="https://orcid.org/sites/default/files/images/orcid_16x16.png" alt="ORCID iD" />
      </a>
      {{/if}}
    </div>
    
    {{#if affiliation}}
    <div class="affiliation">{{affiliation}}</div>
    {{/if}}
    
    {{#if bio}}
    <div class="bio">{{bio}}</div>
    {{/if}}
  </div>
  {{/each}}
</div>
{{/if}}
```

### Conditional Display Based on Data Availability

```html
{{#if authorList}}
<!-- Rich author data available -->
<div class="authors-detailed">
  {{#each authorList}}
  <div class="author {{#if isCorresponding}}corresponding{{/if}} {{#if isRegistered}}registered{{/if}}">
    <h5>{{name}}</h5>
    
    {{#if isRegistered}}
    <!-- Full profile available for registered users -->
    {{#if affiliation}}<p class="affiliation">{{affiliation}}</p>{{/if}}
    {{#if orcidId}}<p class="orcid">ORCID: {{orcidId}}</p>{{/if}}
    {{#if website}}<p class="website"><a href="{{website}}">{{website}}</a></p>{{/if}}
    {{else}}
    <!-- Limited info for non-registered authors -->
    <p class="note">Guest author</p>
    {{/if}}
  </div>
  {{/each}}
</div>
{{else}}
<!-- Fallback to simple display -->
<div class="authors-simple">
  <p>Authors: {{authors}}</p>
</div>
{{/if}}
```

## Data Sources

The bot handles both data formats from the Colloquium API:

### 1. Simple Author Array (Basic Submissions)
```json
{
  "authors": ["John Doe", "Jane Smith", "Bob Wilson"]
}
```

### 2. Detailed Author Relations (Full Submissions)
```json
{
  "authorRelations": [
    {
      "order": 0,
      "isCorresponding": true,
      "user": {
        "id": "user123",
        "name": "John Doe",
        "email": "john@university.edu",
        "orcidId": "0000-0000-0000-0000",
        "affiliation": "University of Science",
        "bio": "Professor of Computer Science",
        "website": "https://johndoe.com"
      }
    },
    {
      "order": 1,
      "isCorresponding": false,
      "user": {
        "name": "Jane Smith",
        "affiliation": "Tech Institute"
      }
    }
  ]
}
```

## CSS Styling Examples

### Professional Author Cards

```css
.author-section {
  margin: 2rem 0;
  border-top: 1px solid #e2e8f0;
  padding-top: 1.5rem;
}

.author {
  margin-bottom: 1.5rem;
  padding: 1rem;
  border-left: 3px solid #3b82f6;
  background: #f8fafc;
}

.author-name {
  margin: 0 0 0.5rem 0;
  color: #1e293b;
  font-weight: 600;
}

.affiliation {
  color: #64748b;
  font-style: italic;
  margin-bottom: 0.5rem;
}

.orcid {
  font-size: 0.875rem;
}

.orcid a {
  color: #16a34a;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.orcid .verified {
  color: #16a34a;
  font-weight: bold;
}

.corresponding-info {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #fef3c7;
  border-left: 4px solid #f59e0b;
  font-size: 0.875rem;
}
```

### Compact Inline Display

```css
.authors-compact {
  text-align: center;
  margin: 1rem 0;
  font-size: 1.1rem;
}

.authors-compact .author {
  display: inline;
}

.authors-compact sup {
  color: #dc2626;
  font-weight: bold;
}
```

## Handlebars Helpers Available

- `{{#each}}` - Iterate over author arrays
- `{{#if}}` - Conditional display
- `{{#unless}}` - Negative conditional
- `{{@index}}` - Current loop index
- `{{@last}}` - True if last item in loop

## Migration from Simple Templates

If you have existing templates using the simple `{{authors}}` format, they will continue to work. To upgrade:

1. **Keep compatibility**: Test that `{{authors}}` still works as fallback
2. **Add rich display**: Wrap new author features in `{{#if authorList}}` blocks
3. **Enhance gradually**: Add ORCID, affiliations, etc. as needed
4. **Test thoroughly**: Verify with both simple and detailed author data

This approach ensures templates work with both legacy simple author data and new rich author information.