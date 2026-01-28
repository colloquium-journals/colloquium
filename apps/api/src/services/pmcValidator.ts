import { JatsValidationError, JatsValidationResult } from '@colloquium/types';

/**
 * Validate JATS XML against PMC requirements
 *
 * This performs basic structural validation. For full PMC validation,
 * use the official PMC Style Checker: https://pmc.ncbi.nlm.nih.gov/pub/validation/
 */
export function validateJatsForPmc(xml: string): JatsValidationResult {
  const errors: JatsValidationError[] = [];
  const warnings: JatsValidationError[] = [];

  // Check for valid XML structure
  if (!xml || !xml.trim()) {
    errors.push({
      code: 'EMPTY_DOCUMENT',
      message: 'JATS XML document is empty'
    });
    return { valid: false, errors, warnings };
  }

  // Check for XML declaration
  if (!xml.includes('<?xml')) {
    warnings.push({
      code: 'MISSING_XML_DECLARATION',
      message: 'XML declaration is missing (recommended)'
    });
  }

  // Check for DOCTYPE declaration (PMC prefers JATS DTD)
  if (!xml.includes('<!DOCTYPE')) {
    warnings.push({
      code: 'MISSING_DOCTYPE',
      message: 'DOCTYPE declaration is missing (recommended for PMC)'
    });
  }

  // Required elements for PMC
  const requiredElements = [
    { element: 'article', code: 'MISSING_ARTICLE', message: 'Root <article> element is required' },
    { element: 'front', code: 'MISSING_FRONT', message: '<front> element is required' },
    { element: 'journal-meta', code: 'MISSING_JOURNAL_META', message: '<journal-meta> element is required' },
    { element: 'article-meta', code: 'MISSING_ARTICLE_META', message: '<article-meta> element is required' },
    { element: 'title-group', code: 'MISSING_TITLE_GROUP', message: '<title-group> element is required' },
    { element: 'article-title', code: 'MISSING_ARTICLE_TITLE', message: '<article-title> element is required' },
    { element: 'contrib-group', code: 'MISSING_CONTRIB_GROUP', message: '<contrib-group> element (authors) is required' },
    { element: 'pub-date', code: 'MISSING_PUB_DATE', message: '<pub-date> element is required' },
    { element: 'permissions', code: 'MISSING_PERMISSIONS', message: '<permissions> element (copyright/license) is required' }
  ];

  for (const { element, code, message } of requiredElements) {
    if (!xml.includes(`<${element}`)) {
      errors.push({ code, message, element });
    }
  }

  // Check for journal title
  if (!xml.includes('<journal-title')) {
    errors.push({
      code: 'MISSING_JOURNAL_TITLE',
      message: '<journal-title> element is required within <journal-meta>',
      element: 'journal-title'
    });
  }

  // Recommended elements (warnings)
  const recommendedElements = [
    { element: 'article-id pub-id-type="doi"', code: 'MISSING_DOI', message: 'Article DOI is recommended for PMC' },
    { element: 'abstract', code: 'MISSING_ABSTRACT', message: 'Abstract is recommended for PMC' },
    { element: 'kwd-group', code: 'MISSING_KEYWORDS', message: 'Keywords (<kwd-group>) are recommended' },
    { element: 'body', code: 'MISSING_BODY', message: '<body> element (article content) is recommended' }
  ];

  for (const { element, code, message } of recommendedElements) {
    if (!xml.includes(`<${element}`)) {
      warnings.push({ code, message, element });
    }
  }

  // Check for ISSN
  if (!xml.includes('<issn')) {
    warnings.push({
      code: 'MISSING_ISSN',
      message: 'Journal ISSN is recommended',
      element: 'issn'
    });
  }

  // Check for license element within permissions
  if (xml.includes('<permissions') && !xml.includes('<license')) {
    warnings.push({
      code: 'MISSING_LICENSE',
      message: '<license> element within <permissions> is recommended',
      element: 'license'
    });
  }

  // Check for author information
  if (xml.includes('<contrib-group') && !xml.includes('<name')) {
    warnings.push({
      code: 'MISSING_AUTHOR_NAMES',
      message: 'Author names (<name> within <contrib>) are recommended',
      element: 'name'
    });
  }

  // Check for ORCIDs (becoming increasingly expected)
  if (!xml.includes('contrib-id-type="orcid"')) {
    warnings.push({
      code: 'MISSING_ORCID',
      message: 'Author ORCIDs (<contrib-id contrib-id-type="orcid">) are recommended',
      element: 'contrib-id'
    });
  }

  // Check for affiliations
  if (!xml.includes('<aff')) {
    warnings.push({
      code: 'MISSING_AFFILIATIONS',
      message: 'Author affiliations (<aff>) are recommended',
      element: 'aff'
    });
  }

  // Check for funding information (if applicable)
  // This is just a warning since not all articles have funding
  if (!xml.includes('<funding-group') && !xml.includes('<funding-statement')) {
    warnings.push({
      code: 'NO_FUNDING_INFO',
      message: 'Consider adding funding information if applicable',
      element: 'funding-group'
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Get a summary of validation results
 */
export function getValidationSummary(result: JatsValidationResult): string {
  const lines: string[] = [];

  if (result.valid) {
    lines.push('JATS XML passes basic PMC validation checks.');
  } else {
    lines.push(`JATS XML has ${result.errors.length} error(s) that must be fixed for PMC submission.`);
  }

  if (result.warnings.length > 0) {
    lines.push(`${result.warnings.length} warning(s) found (recommended improvements).`);
  }

  if (result.errors.length > 0) {
    lines.push('\nErrors:');
    for (const error of result.errors) {
      lines.push(`  - ${error.message}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push('\nWarnings:');
    for (const warning of result.warnings) {
      lines.push(`  - ${warning.message}`);
    }
  }

  lines.push('\nFor full PMC validation, use:');
  lines.push('  - PMC Style Checker: https://pmc.ncbi.nlm.nih.gov/pub/validation/');
  lines.push('  - JATS4R Validator: https://jats4r.niso.org/jats4r-validator/');

  return lines.join('\n');
}
