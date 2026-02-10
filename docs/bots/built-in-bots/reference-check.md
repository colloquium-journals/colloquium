# bot-reference-check

Validates DOIs and checks reference integrity against CrossRef and DataCite registries.

**Package:** `@colloquium/bot-reference-check`
**Category:** quality
**Default:** Yes (installed automatically)

## Commands

### check-doi

Analyze all references in the manuscript for DOI presence and validity.

```
@bot-reference-check check-doi [detailed=false] [timeout=30]
```

Parameters:
- `detailed` (boolean) - Include full metadata (authors, journal, year) for resolved DOIs
- `timeout` (number, 5-60) - Maximum seconds for DOI resolution

The bot:
1. Finds a `.bib` file (preferred) or markdown source with a References section
2. Extracts references and DOIs
3. Validates each DOI via `doi.org` HEAD request
4. Optionally fetches metadata from CrossRef/DataCite
5. Generates a report with statistics and per-reference results

Output includes:
- Summary statistics (total refs, DOI coverage, resolution rate)
- Per-reference status: resolved, no DOI, or not found
- JSON report attachment for programmatic use

## Reference Sources

Priority order:
1. `.bib` / `.bibtex` files (BibTeX parsing)
2. Markdown source files with a `## References` section (DOI extraction)

## Permissions

- `read_manuscript`
- `read_manuscript_files`
- `access_external_apis`
