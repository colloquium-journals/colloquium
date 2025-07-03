# Managing About Section Content

This guide explains how journal administrators can modify the content in the About section of your Colloquium journal.

## Overview

The About section uses a file-based content management system with Markdown files. This allows for easy editing without requiring technical knowledge or database access.

## Content Structure

### File Location
All about page content is stored in:
```
content/about/
```

### File Format
Each page is a Markdown file (`.md`) with frontmatter metadata at the top:

```markdown
---
title: "Page Title"
description: "Brief description for navigation and SEO"
order: 1
visible: true
lastUpdated: "2025-06-13"
---

# Your Content Here

Write your content using standard Markdown formatting.
```

## Editing Content

### 1. Edit Existing Pages

To modify an existing page:

1. Navigate to the `content/about/` directory
2. Open the desired `.md` file in any text editor
3. Edit the content using Markdown syntax
4. Update the `lastUpdated` field in the frontmatter
5. Save the file

**Example**: To edit the main about page, modify `content/about/index.md`

### 2. Create New Pages

To add a new about page:

1. Create a new `.md` file in `content/about/`
2. Use a descriptive filename (e.g., `privacy-policy.md`)
3. Add the required frontmatter at the top
4. Write your content in Markdown

**Example new page**:
```markdown
---
title: "Privacy Policy"
description: "Our commitment to protecting your privacy"
order: 10
visible: true
lastUpdated: "2025-07-03"
---

# Privacy Policy

Your privacy policy content here...
```

### 3. Remove Pages

To hide or remove a page:

- **Hide**: Set `visible: false` in the frontmatter
- **Remove**: Delete the `.md` file entirely

## Frontmatter Fields

### Required Fields
- `title`: Page title (appears in navigation and page header)
- `description`: Brief description (appears in navigation and SEO)
- `order`: Numeric ordering for navigation (lower numbers appear first)
- `visible`: Boolean to show/hide the page
- `lastUpdated`: ISO date string (YYYY-MM-DD format)

### Optional Fields
- `icon`: Custom icon name (see Available Icons section below)

## Available Icons

You can customize the icon for each about page by adding an `icon` field to the frontmatter. Here are the available icon options:

### Document & Content Icons
- `IconFileText` - General documents, text content
- `IconBook` - Books, guides, comprehensive documentation
- `IconPencil` - Writing, editing, authoring

### User & Community Icons
- `IconUsers` - Teams, groups, editorial boards
- `IconHeart` - Community, values, mission statements

### Policy & Guidelines Icons
- `IconGavel` - Rules, policies, code of conduct
- `IconShield` - Security, ethics, protection
- `IconLicense` - Licensing, legal information
- `IconFlag` - Important notices, announcements

### Academic & Research Icons
- `IconCertificate` - Credentials, qualifications, standards
- `IconTarget` - Goals, objectives, scope
- `IconBulb` - Innovation, ideas, research

### Contact & Communication Icons
- `IconMail` - Email, contact information
- `IconPhone` - Phone contact, support
- `IconWorld` - Website, online presence

### Technical & Settings Icons
- `IconSettings` - Configuration, technical information
- `IconQuestionMark` - Help, FAQ, unknown content

### Usage Example
```markdown
---
title: "Code of Conduct"
description: "Our community standards and behavioral expectations"
order: 3
visible: true
lastUpdated: "2025-07-03"
icon: "IconGavel"
---
```

### Fallback Behavior
- If no `icon` is specified, the system will use a default icon based on the page slug
- If an invalid icon name is provided, it will fallback to `IconFileText`
- Icon names are case-sensitive and must match exactly

## Markdown Formatting

You can use standard Markdown syntax in your content:

### Headers
```markdown
# Main Header
## Sub Header
### Sub-sub Header
```

### Text Formatting
```markdown
**Bold text**
*Italic text*
`Code text`
```

### Lists
```markdown
- Bullet point
- Another point
  - Sub-point

1. Numbered list
2. Another item
```

### Links
```markdown
[Link text](https://example.com)
[Email link](mailto:contact@example.com)
```

### Images
```markdown
![Alt text](path/to/image.jpg)
```

### Code Blocks
```markdown
```javascript
// Code example
console.log("Hello world");
```
```

### Tables
```markdown
| Column 1 | Column 2 |
|----------|----------|
| Data 1   | Data 2   |
```

## Managing About Pages

### Current Default Pages

The system comes with these default pages:

1. **index.md** - Main about page
2. **submission-scope.md** - Submission guidelines
3. **code-of-conduct.md** - Community standards
4. **ethics-guidelines.md** - Research ethics
5. **licensing.md** - License information
6. **editorial-board.md** - Editorial board (dynamically generated)

### Customizing the Page Structure

You have complete control over which pages appear in your about section:

#### Adding New Pages
1. Create a new `.md` file in the `content/about/` directory
2. Choose a descriptive filename (e.g., `privacy-policy.md`, `submission-fees.md`)
3. Add appropriate frontmatter with `order` to control positioning
4. Set `visible: true` to make it appear in navigation

#### Removing/Hiding Pages
- **Hide temporarily**: Set `visible: false` in the frontmatter
- **Remove permanently**: Delete the `.md` file
- **Reorder**: Change the `order` values in frontmatter

#### Customizing Default Pages
All default pages can be fully customized:
- Edit the content using Markdown
- Change titles and descriptions in frontmatter
- Modify icons to better match your journal's style
- Reorder pages to match your priorities

#### Example Custom Page Structure
```
content/about/
├── index.md (order: 1)
├── our-mission.md (order: 2)
├── submission-guidelines.md (order: 3)
├── review-process.md (order: 4)
├── ethics-policy.md (order: 5)
├── open-access.md (order: 6)
├── editorial-board.md (order: 7)
├── contact.md (order: 8)
└── privacy-policy.md (order: 9)
```

## Special Pages

### Editorial Board
The `editorial-board.md` file is special - it combines markdown content with dynamically generated data from your user database. You can edit the static content, but the member list is automatically populated from current editors and admins.

## Best Practices

### Content Guidelines
- Keep descriptions concise (under 100 characters)
- Use clear, descriptive titles
- Maintain consistent tone and style
- Update the `lastUpdated` field when making changes

### Organization
- Use logical `order` numbers with gaps (1, 5, 10, 15...) to allow easy insertion
- Keep related content together in the ordering
- Use descriptive filenames that match the content

### SEO Considerations
- Write meaningful descriptions for each page
- Use proper header hierarchy (H1, H2, H3)
- Include relevant keywords naturally in content

## Troubleshooting

### Content Not Appearing
- Check that `visible: true` is set in frontmatter
- Verify the file is saved in the correct location
- Ensure the frontmatter format is correct (proper YAML syntax)

### Formatting Issues
- Verify Markdown syntax is correct
- Check that code blocks are properly closed
- Ensure frontmatter has proper `---` delimiters

### Navigation Order
- Check `order` values in frontmatter
- Lower numbers appear first in navigation
- Ensure no duplicate order numbers

## Technical Notes

### File Encoding
- Use UTF-8 encoding for all files
- Avoid special characters in filenames
- Use hyphens instead of spaces in filenames

### Performance
- Content is cached for performance
- Changes may take a few moments to appear
- Clear browser cache if changes don't appear immediately

### Backup
- Keep regular backups of your content files
- Consider using version control (Git) for tracking changes
- Test changes in a development environment first

## Getting Help

If you need assistance with content management:

1. Consult this documentation
2. Check the example files in `content/about/`
3. Contact your technical administrator
4. Review the Colloquium documentation

Remember: The about section is often the first place visitors learn about your journal, so keep content clear, professional, and up-to-date.