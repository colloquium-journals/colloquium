# Section Management Guide

This guide explains how journal administrators can create and manage custom content sections in Colloquium, giving you full control over your website's structure and navigation.

## Overview

The section management system allows you to:
- Create custom content sections beyond the default "About" section
- Control which sections appear in navigation
- Set section order, visibility, and access permissions
- Customize section icons and descriptions
- Manage section content through markdown files

## Section Configuration File

All sections are configured through the `content/sections.json` file. This file defines which sections exist, their properties, and how they appear in your journal.

### Configuration Structure

```json
{
  "sections": [
    {
      "id": "about",
      "title": "About",
      "description": "Learn about our journal, policies, and community",
      "path": "/about",
      "contentPath": "about",
      "icon": "IconFileText",
      "order": 1,
      "visible": true,
      "showInNavigation": true,
      "allowAnonymous": true
    }
  ],
  "configuration": {
    "version": "1.0",
    "lastUpdated": "2025-07-03",
    "defaultIcon": "IconFileText",
    "allowCustomSections": true,
    "maxSections": 10
  }
}
```

### Section Properties

#### Required Properties
- **id**: Unique identifier for the section (alphanumeric, hyphens, underscores only)
- **title**: Display name shown in navigation and section headers
- **description**: Brief description for SEO and section pages
- **path**: URL path where the section will be accessible (e.g., "/policies")
- **contentPath**: Directory name under `content/` where markdown files are stored
- **icon**: Icon name from the available icon set (see Icon Reference below)
- **order**: Numeric ordering for navigation (lower numbers appear first)
- **visible**: Boolean - whether the section is active
- **showInNavigation**: Boolean - whether to include in main navigation menu
- **allowAnonymous**: Boolean - whether non-logged-in users can access

#### Configuration Properties
- **version**: Configuration format version
- **lastUpdated**: Date of last configuration update
- **defaultIcon**: Fallback icon for sections without custom icons
- **allowCustomSections**: Whether admins can create new sections
- **maxSections**: Maximum number of sections allowed

## Creating New Sections

### Step 1: Add Section to Configuration

Edit `content/sections.json` and add a new section object to the `sections` array:

```json
{
  "id": "policies",
  "title": "Editorial Policies",
  "description": "Our editorial guidelines and publication policies",
  "path": "/policies",
  "contentPath": "policies",
  "icon": "IconShield",
  "order": 2,
  "visible": true,
  "showInNavigation": true,
  "allowAnonymous": true
}
```

### Step 2: Create Content Directory

Create a new directory under `content/` matching your `contentPath`:

```
content/
├── about/
├── policies/    # New section directory
└── sections.json
```

### Step 3: Add Content Files

Create markdown files in your new section directory:

```
content/policies/
├── index.md           # Main section page (required)
├── editorial-process.md
├── peer-review.md
└── publication-ethics.md
```

### Step 4: Configure Index Page

Create `index.md` with appropriate frontmatter:

```markdown
---
title: "Editorial Policies"
description: "Comprehensive guide to our editorial standards and processes"
order: 1
visible: true
lastUpdated: "2025-07-03"
icon: "IconShield"
---

# Editorial Policies

This section outlines our editorial standards and publication processes...
```

## Managing Existing Sections

### Hiding Sections
To temporarily hide a section, set `visible: false` in `sections.json`:

```json
{
  "id": "policies",
  "visible": false,
  "showInNavigation": false
}
```

### Removing Navigation Items
To keep a section accessible but remove it from navigation:

```json
{
  "id": "policies",
  "visible": true,
  "showInNavigation": false
}
```

### Reordering Sections
Change the `order` property to reposition sections in navigation:

```json
[
  {"id": "about", "order": 1},
  {"id": "policies", "order": 2},
  {"id": "help", "order": 3}
]
```

### Restricting Access
Control who can access sections:

```json
{
  "id": "internal-docs",
  "allowAnonymous": false  // Requires login
}
```

## Section Content Management

### File Organization
Each section should have its content organized in a dedicated directory:

```
content/
├── about/
│   ├── index.md
│   ├── mission.md
│   └── team.md
├── policies/
│   ├── index.md
│   ├── submission-guidelines.md
│   └── review-process.md
└── help/
    ├── index.md
    ├── author-guide.md
    └── reviewer-guide.md
```

### Page Structure
Each page should follow the standard frontmatter format:

```markdown
---
title: "Page Title"
description: "Page description for navigation"
order: 1
visible: true
lastUpdated: "2025-07-03"
icon: "IconFileText"
---

# Page Content

Your markdown content here...
```

## Available Icons

Choose from these predefined icons for your sections and pages:

### Document & Content
- `IconFileText` - General documents, policies
- `IconBook` - Guides, handbooks
- `IconPencil` - Writing, editing guidelines

### Organization & People
- `IconUsers` - Teams, editorial boards
- `IconHeart` - Mission, values, community

### Policies & Guidelines  
- `IconGavel` - Rules, code of conduct
- `IconShield` - Security, ethics, protection
- `IconLicense` - Licensing, legal information
- `IconFlag` - Important notices

### Academic & Research
- `IconCertificate` - Standards, qualifications
- `IconTarget` - Goals, scope, objectives
- `IconBulb` - Innovation, ideas, research

### Communication & Support
- `IconMail` - Contact, email information
- `IconPhone` - Support, phone contact
- `IconWorld` - Website, external links
- `IconQuestionMark` - Help, FAQ, unknown

### Technical
- `IconSettings` - Configuration, technical docs

## Example Section Configurations

### Help & Support Section
```json
{
  "id": "help",
  "title": "Help & Support",
  "description": "Documentation and support for authors and reviewers",
  "path": "/help",
  "contentPath": "help",
  "icon": "IconQuestionMark",
  "order": 3,
  "visible": true,
  "showInNavigation": true,
  "allowAnonymous": true
}
```

### News & Updates Section
```json
{
  "id": "news",
  "title": "News & Updates",
  "description": "Latest news and platform updates",
  "path": "/news",
  "contentPath": "news",
  "icon": "IconBulb",
  "order": 4,
  "visible": true,
  "showInNavigation": true,
  "allowAnonymous": true
}
```

### Internal Documentation (Staff Only)
```json
{
  "id": "internal",
  "title": "Internal Documentation",
  "description": "Staff-only documentation and procedures",
  "path": "/internal",
  "contentPath": "internal",
  "icon": "IconSettings",
  "order": 10,
  "visible": true,
  "showInNavigation": false,
  "allowAnonymous": false
}
```

## Best Practices

### Section Design
- **Keep sections focused**: Each section should have a clear, specific purpose
- **Use descriptive titles**: Make it obvious what users will find in each section
- **Logical ordering**: Order sections by importance or user journey
- **Consistent structure**: Use similar page structures within sections

### Content Organization
- **Always include index.md**: This serves as the main page for each section
- **Use clear page ordering**: Number pages logically (1, 5, 10, 15...)
- **Descriptive filenames**: Use clear, hyphenated filenames (e.g., `submission-guidelines.md`)
- **Update timestamps**: Keep `lastUpdated` current when making changes

### Navigation Design
- **Limit navigation items**: Too many items make navigation cluttered
- **Prioritize key sections**: Put most important sections first
- **Consider user types**: Think about what different users need to find

### Access Control
- **Default to open**: Most content should be accessible to anonymous users
- **Restrict selectively**: Only limit access for truly sensitive content
- **Clear access indicators**: Make it obvious when content requires login

## Troubleshooting

### Section Not Appearing
1. Check `visible: true` in `sections.json`
2. Verify `showInNavigation: true` for nav items
3. Ensure JSON syntax is valid
4. Check that content directory exists
5. Verify at least one visible page exists in the section

### Navigation Issues
1. Check section `order` values for proper sorting
2. Verify `showInNavigation` settings
3. Ensure `allowAnonymous` matches intended access
4. Clear browser cache if changes don't appear

### Content Not Loading
1. Verify content directory matches `contentPath`
2. Check that `index.md` exists in the section directory
3. Validate markdown frontmatter syntax
4. Ensure file permissions allow reading

### Icon Problems
1. Verify icon name matches available icons exactly
2. Check icon name is properly quoted in JSON
3. Use `IconFileText` as fallback for testing

## API Endpoints

The section system exposes these API endpoints:

- `GET /api/content/sections/config` - Full section configuration
- `GET /api/content/sections` - Active sections with metadata
- `GET /api/content/{sectionId}` - Pages in a specific section
- `GET /api/content/{sectionId}/{page}` - Specific page content

## Advanced Configuration

### Custom Section Types
You can create specialized sections by:
1. Using specific icon combinations
2. Creating template page structures
3. Establishing naming conventions
4. Setting up content workflows

### Integration with Authentication
For authenticated sections:
- Set `allowAnonymous: false`
- Users will be redirected to login
- Consider role-based access for future versions

### SEO Optimization
- Use descriptive section descriptions
- Include relevant keywords naturally
- Maintain clean URL structures
- Keep page titles concise but informative

## Backup and Versioning

### Configuration Backup
Always backup `sections.json` before making changes:
```bash
cp content/sections.json content/sections.json.backup
```

### Content Versioning
Consider using Git to track changes to section configuration and content files.

### Testing Changes
1. Test configuration changes in a development environment first
2. Verify all sections load correctly
3. Check navigation functionality
4. Test on mobile devices

Remember: The section management system gives you complete control over your journal's content structure. Start with simple sections and expand based on your community's needs.