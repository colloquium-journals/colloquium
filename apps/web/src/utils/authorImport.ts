export interface ImportedAuthor {
  email: string;
  name: string;
  affiliation: string;
  isCorresponding: boolean;
}

export interface ParseResult {
  authors: ImportedAuthor[];
  errors: string[];
}

const TEMPLATE_HEADERS = ['email', 'name', 'affiliation', 'corresponding'];
const EXAMPLE_ROW = ['author@example.edu', 'Jane Doe', 'University of Example', 'true'];

/**
 * Generates CSV content for the author template
 */
export function generateAuthorTemplateCSV(): string {
  const rows = [
    TEMPLATE_HEADERS.join(','),
    EXAMPLE_ROW.join(',')
  ];
  return rows.join('\n');
}

/**
 * Downloads a template file in the specified format
 */
export async function downloadTemplate(format: 'csv' | 'xlsx'): Promise<void> {
  if (format === 'csv') {
    const content = generateAuthorTemplateCSV();
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, 'author_template.csv');
  } else {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, EXAMPLE_ROW]);

    // Set column widths for better readability
    ws['!cols'] = [
      { wch: 25 }, // email
      { wch: 20 }, // name
      { wch: 30 }, // affiliation
      { wch: 15 }  // corresponding
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Authors');
    XLSX.writeFile(wb, 'author_template.xlsx');
  }
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Validates an email address format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Normalizes header names to lowercase and trims whitespace
 */
function normalizeHeader(header: string): string {
  return header.toLowerCase().trim();
}

/**
 * Parses a boolean value from various string representations
 */
function parseBoolean(value: string | boolean | number | undefined | null): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (!value) return false;
  const normalized = String(value).toLowerCase().trim();
  return normalized === 'true' || normalized === 'yes' || normalized === '1' || normalized === 'x';
}

/**
 * Parses an uploaded CSV or XLSX file and returns author data
 */
export async function parseAuthorFile(file: File): Promise<ParseResult> {
  const errors: string[] = [];
  const authors: ImportedAuthor[] = [];

  try {
    const XLSX = await import('xlsx');
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { authors: [], errors: ['No sheets found in the file'] };
    }

    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<Record<string, string | number | boolean>>(sheet, {
      defval: '',
      raw: false
    });

    if (data.length === 0) {
      return { authors: [], errors: ['No data rows found in the file'] };
    }

    // Get headers from first row keys and normalize them
    const rawHeaders = Object.keys(data[0]);
    const headerMap: Record<string, string> = {};

    for (const header of rawHeaders) {
      headerMap[normalizeHeader(header)] = header;
    }

    // Check for required columns
    const hasEmail = 'email' in headerMap;
    const hasName = 'name' in headerMap;

    if (!hasEmail) {
      errors.push('Missing required column: "email"');
    }
    if (!hasName) {
      errors.push('Missing required column: "name"');
    }

    if (!hasEmail || !hasName) {
      return { authors: [], errors };
    }

    // Parse each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // +2 because row 1 is headers, and we're 1-indexed

      const email = String(row[headerMap['email']] || '').trim();
      const name = String(row[headerMap['name']] || '').trim();
      const affiliation = headerMap['affiliation']
        ? String(row[headerMap['affiliation']] || '').trim()
        : '';
      const corresponding = headerMap['corresponding']
        ? parseBoolean(row[headerMap['corresponding']])
        : false;

      // Skip empty rows
      if (!email && !name) {
        continue;
      }

      // Validate required fields
      if (!email) {
        errors.push(`Row ${rowNum}: Missing email address`);
        continue;
      }

      if (!name) {
        errors.push(`Row ${rowNum}: Missing name`);
        continue;
      }

      // Validate email format
      if (!isValidEmail(email)) {
        errors.push(`Row ${rowNum}: Invalid email format "${email}"`);
        continue;
      }

      // Check for duplicate emails in the import
      const duplicateIndex = authors.findIndex(a => a.email.toLowerCase() === email.toLowerCase());
      if (duplicateIndex !== -1) {
        errors.push(`Row ${rowNum}: Duplicate email "${email}" (first seen in row ${duplicateIndex + 2})`);
        continue;
      }

      authors.push({
        email,
        name,
        affiliation,
        isCorresponding: corresponding
      });
    }

    // Handle corresponding author logic - only first one marked true is used
    const correspondingAuthors = authors.filter(a => a.isCorresponding);
    if (correspondingAuthors.length > 1) {
      // Keep only the first one as corresponding
      let foundFirst = false;
      for (const author of authors) {
        if (author.isCorresponding) {
          if (foundFirst) {
            author.isCorresponding = false;
          } else {
            foundFirst = true;
          }
        }
      }
      errors.push(`Multiple authors marked as corresponding. Only the first one ("${correspondingAuthors[0].email}") will be set as corresponding.`);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    errors.push(`Failed to parse file: ${errorMessage}`);
  }

  return { authors, errors };
}
