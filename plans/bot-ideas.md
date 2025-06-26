# editorial-bot

**Commands**

- Send request to reviewers
- Assign reviewers
- Accept or reject submissions
- Request revisions

**Configuration Options**

- Template for reviewer request emails

# reference-bot

**Commands**

- Check DOIs for all references
- Check for missing references

**Configuration Options**
- None

# reviewer-checklist-bot

**Commands**

- Generate a checklist for reviewers

**Configuration Options**

- Template for checklist

# *-renderer-bot

Different ones for different formats (e.g., markdown, LaTeX, Quarto)

**Commands**

- Render the document into the journal's template

**Configuration Options**

- Template for the journal published format

# statcheck-bot

**Commands**

- Run statcheck on the document

**Configuration Options**

- None

# link-check-bot

**Commands**
- Check all links in the document. Make sure that any OSF links are valid and that the files are accessible.

**Configuration Options**
- Check OSF privacy?
- Allow url shorteners?