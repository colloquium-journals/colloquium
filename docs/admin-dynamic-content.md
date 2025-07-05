# Dynamic Content Inserts

This guide explains how to use dynamic content inserts in your markdown files to automatically include live data from your Colloquium journal.

## Overview

Dynamic content inserts allow you to embed live data directly into your markdown content. Instead of manually maintaining lists or statistics, you can use special syntax that automatically pulls current information from your journal's database.

## Editorial Board Inserts

The most powerful dynamic insert is the editorial board system, which automatically includes current editorial team members in your content.

### Basic Syntax

Use double curly braces with the insert type:

```markdown
{{editorial-board}}
```

This will insert the editorial board using the default "cards" template.

### Template Options

You can specify different display templates:

```markdown
{{editorial-board:cards}}    <!-- Card layout (default) -->
{{editorial-board:list}}     <!-- Simple list format -->
{{editorial-board:compact}}  <!-- Inline compact format -->
{{editorial-board:stats}}    <!-- Statistics overview -->
```

### Template Examples

#### Cards Template (Default)
```markdown
{{editorial-board:cards}}
```

Creates individual cards for each board member showing:
- Name and affiliation
- Bio excerpt (first 150 characters)
- Publication and review statistics
- Links to ORCID and personal websites

#### List Template
```markdown
{{editorial-board:list}}
```

Creates organized lists with sections for:
- Editors-in-Chief
- Editorial Board Members
- Names, affiliations, and ORCID links

#### Compact Template
```markdown
{{editorial-board:compact}}
```

Creates a single paragraph with comma-separated names and affiliations. Perfect for footer or brief mentions.

#### Stats Template
```markdown
{{editorial-board:stats}}
```

Creates a statistics dashboard showing:
- Total board members
- Number of editors-in-chief
- Number of board members
- Total published papers by board
- Total completed reviews by board

## Using Multiple Inserts

You can use multiple inserts in the same document:

```markdown
# Editorial Board

Our distinguished editorial team leads our peer review process.

## Current Team

{{editorial-board:cards}}

## Quick Stats

{{editorial-board:stats}}

## Board Members

For a simple list, see our {{editorial-board:compact}} roster.
```

## Real-World Examples

### About Page Enhancement
```markdown
# About Our Journal

We maintain the highest editorial standards through our team of expert researchers.

## Editorial Leadership

{{editorial-board:list}}

Learn more about our [editorial process](/about/editorial-process).
```

### Editorial Process Page
```markdown
# Editorial Process

Our peer review process is overseen by our editorial board.

{{editorial-board:stats}}

Each manuscript is assigned to an appropriate board member based on expertise.

## Current Editorial Team

{{editorial-board:cards}}
```

### Simple Acknowledgment
```markdown
# Acknowledgments

We thank our editorial board: {{editorial-board:compact}} for their dedication to maintaining our journal's quality.
```

## Data Sources

Editorial board inserts automatically pull data from:

### User Information
- **Name**: Display name from user profile
- **Affiliation**: Institutional affiliation
- **Bio**: User biography/description
- **ORCID ID**: ORCID identifier with automatic linking
- **Website**: Personal or professional website
- **Role**: Editorial role (Editor-in-Chief, Board Member)

### Statistics
- **Published Papers**: Articles authored by the board member in your journal
- **Completed Reviews**: Reviews completed by the board member
- **Join Date**: When they became a board member

### Role Mapping
- **ADMIN role** → Displayed as "Editor-in-Chief"
- **EDITOR_IN_CHIEF role** → Displayed as "Editorial Board Member"

## Styling and Customization

### Built-in Styling
The templates include inline CSS styling that works with most themes:
- Responsive grid layouts
- Professional card designs
- Accessible color schemes
- Mobile-friendly displays

### Custom CSS
You can add custom CSS to your site to override default styling:

```css
.editorial-board-cards {
  /* Customize card layout */
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
}

.editorial-stats {
  /* Customize statistics display */
  background: var(--your-theme-background);
  border: 1px solid var(--your-theme-border);
}
```

## Best Practices

### Placement Guidelines
- **About pages**: Use `cards` template for full profiles
- **Homepage**: Use `stats` for quick overview
- **Footer**: Use `compact` for simple acknowledgment
- **Process pages**: Use `list` for role clarity

### Content Organization
```markdown
<!-- Good: Clear context -->
## Editorial Leadership
{{editorial-board:cards}}

<!-- Good: Multiple views -->
{{editorial-board:stats}}
Our editorial board consists of {{editorial-board:compact}}.

<!-- Avoid: Multiple identical inserts -->
{{editorial-board:cards}}
{{editorial-board:cards}}  <!-- Redundant -->
```

### Performance Considerations
- Inserts are processed server-side, so they don't slow down page loading
- Data is fetched fresh each time (no caching), ensuring accuracy
- Multiple inserts on one page share the same data query

## Troubleshooting

### No Board Members Displayed
If you see "No editorial board members found":
1. Verify users have ADMIN or EDITOR_IN_CHIEF roles
2. Ensure users have completed their name in their profile
3. Check that users are active (not deactivated)

### Styling Issues
If inserts don't display correctly:
1. Check that your theme supports the HTML structure
2. Verify no conflicting CSS is overriding styles
3. Test with different templates to isolate the issue

### Insert Not Processing
If the `{{editorial-board}}` text appears literally:
1. Verify the syntax uses double curly braces
2. Check there are no extra spaces around the colons
3. Ensure the template name is spelled correctly

### Common Syntax Errors
```markdown
<!-- Correct -->
{{editorial-board:cards}}

<!-- Incorrect -->
{ {editorial-board:cards} }  <!-- Extra spaces -->
{{editorial-board : cards}}  <!-- Spaces around colon -->
{{editorial_board:cards}}    <!-- Underscore instead of hyphen -->
{{editorialboard:cards}}     <!-- Missing hyphen -->
```

## Future Enhancements

The dynamic content system is extensible. Future inserts might include:

- `{{recent-articles:5}}` - Recent published articles
- `{{submission-stats}}` - Submission and acceptance statistics
- `{{review-metrics}}` - Review turnaround times
- `{{author-stats}}` - Top authors and contributors

## Technical Notes

### Processing Pipeline
1. Markdown files are parsed for insert patterns
2. Database queries are executed for requested data
3. HTML templates are generated with current data
4. Processed content is returned to the client

### Security
- All data is sanitized before HTML generation
- User permissions are respected (only public profile data)
- SQL injection protection through Prisma ORM
- XSS prevention through proper HTML escaping

### Performance
- Database queries are optimized for editorial board data
- Results include necessary joins to minimize queries
- Error handling ensures graceful fallbacks

## Getting Help

If you need assistance with dynamic content inserts:
- Review the syntax examples in this guide
- Check the troubleshooting section for common issues
- Test with simple inserts before using complex layouts
- Contact your technical administrator for custom requirements

Remember: Dynamic inserts make your content live and always current, but they require users to have proper roles and complete profiles to display effectively.