import { marked } from 'marked';
import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';

// Create DOMPurify instance
const window = new JSDOM('').window;
const purify = DOMPurify(window);

const DEFAULT_API_URL = process.env.API_URL || 'http://localhost:4000';

export function findAssetFile(files: any[], filename: string): any | null {
  // Remove leading ./ or / from filename
  const cleanFilename = filename.replace(/^\.?\//, '');

  return files.find(file =>
    file.fileType === 'ASSET' &&
    (file.originalName === cleanFilename ||
     file.originalName.endsWith('/' + cleanFilename) ||
     file.path?.endsWith(cleanFilename))
  );
}

export async function processMarkdownContent(
  content: string,
  manuscriptFiles: any[],
  includeAssets: boolean
): Promise<{ html: string; markdown: string; processedAssets: number; warnings: string[] }> {
  const warnings: string[] = [];
  let processedAssets = 0;

  // Configure marked with security and academic features
  marked.setOptions({
    breaks: true,
    gfm: true
  });

  // Process asset links if requested
  if (includeAssets) {
    // Find image and link references in markdown
    const assetPattern = /!\[([^\]]*)\]\(([^)]+)\)|(?<!\!)\[([^\]]*)\]\(([^)]+)\)/g;

    content = content.replace(assetPattern, (match, imageAlt, imageUrl, linkText, linkUrl) => {
      if (imageAlt !== undefined) {
        // It's an image
        const asset = findAssetFile(manuscriptFiles, imageUrl);
        if (asset) {
          processedAssets++;
          // Add inline=true parameter for images to enable public viewing
          const imageUrl = asset.downloadUrl.includes('?')
            ? `${asset.downloadUrl}&inline=true`
            : `${asset.downloadUrl}?inline=true`;
          return `![${imageAlt}](${imageUrl})`;
        } else {
          warnings.push(`Image not found: ${imageUrl}`);
        }
      } else if (linkText !== undefined) {
        // It's a regular link
        const asset = findAssetFile(manuscriptFiles, linkUrl);
        if (asset) {
          processedAssets++;
          return `[${linkText}](${asset.downloadUrl})`;
        }
      }
      return match;
    });
  }

  // Convert markdown to HTML
  const html = marked.parse(content);

  // Sanitize HTML for security
  const cleanHtml = purify.sanitize(html);

  return { html: cleanHtml, markdown: content, processedAssets, warnings };
}

export async function collectAssetFiles(
  markdownContent: string,
  manuscriptFiles: any[],
  serviceToken: string,
  apiUrl: string = DEFAULT_API_URL
): Promise<Array<{filename: string; content: string; encoding: string}>> {
  const assetFiles: Array<{filename: string; content: string; encoding: string}> = [];

  try {
    // Find all image references in the markdown
    const imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const imageMatches = [...markdownContent.matchAll(imagePattern)];

    for (const match of imageMatches) {
      const imagePath = match[2];
      const cleanFilename = imagePath.replace(/^\.?\//, '');

      // Find the corresponding asset file
      const assetFile = manuscriptFiles.find(file =>
        file.fileType === 'ASSET' &&
        (file.originalName === cleanFilename ||
         file.originalName.endsWith('/' + cleanFilename) ||
         file.path?.endsWith(cleanFilename))
      );

      if (assetFile) {
        try {
          // Download the asset file
          const downloadUrl = assetFile.downloadUrl.startsWith('http') ?
            assetFile.downloadUrl :
            `${apiUrl}${assetFile.downloadUrl}`;

          const response = await fetch(downloadUrl, {
            headers: {
              'x-bot-token': serviceToken
            }
          });

          if (response.ok) {
            const buffer = await response.arrayBuffer();
            const base64Content = Buffer.from(buffer).toString('base64');

            assetFiles.push({
              filename: cleanFilename,
              content: base64Content,
              encoding: 'base64'
            });
          } else {
            console.warn(`Failed to download asset ${cleanFilename}: ${response.status} ${response.statusText}`);
          }
        } catch (downloadError) {
          console.warn(`Error downloading asset ${cleanFilename}:`, downloadError);
        }
      }
    }
  } catch (error) {
    console.warn('Error collecting asset files:', error);
  }

  return assetFiles;
}

/**
 * Parse a full name into given names and surname.
 * Handles common name formats like "John Smith", "John A. Smith", "Smith, John"
 */
export function parseNameParts(fullName: string): { givenNames: string; surname: string } {
  if (!fullName || fullName.trim() === '') {
    return { givenNames: '', surname: '' };
  }

  const trimmedName = fullName.trim();

  // Check for "Surname, Given Names" format
  if (trimmedName.includes(',')) {
    const parts = trimmedName.split(',').map(p => p.trim());
    return {
      surname: parts[0] || '',
      givenNames: parts.slice(1).join(' ').trim() || ''
    };
  }

  // Otherwise assume "Given Names Surname" format (last word is surname)
  const words = trimmedName.split(/\s+/);
  if (words.length === 1) {
    // Single name - treat as surname
    return { givenNames: '', surname: words[0] };
  }

  return {
    givenNames: words.slice(0, -1).join(' '),
    surname: words[words.length - 1]
  };
}

export async function prepareAuthorData(metadata: any): Promise<{
  authorsString: string;
  authorList: any[];
  authorCount: number;
  correspondingAuthor: any | null;
}> {
  // Initialize with empty/default values
  let authorList: any[] = [];
  let correspondingAuthor: any | null = null;

  try {
    // Check if we have detailed author relations
    if (metadata.authorRelations && Array.isArray(metadata.authorRelations)) {
      // Sort authors by order field
      const sortedAuthors = metadata.authorRelations.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

      authorList = sortedAuthors.map((authorRel: any) => {
        const author = authorRel.user || {};
        const fullName = author.name || 'Unknown Author';

        // Use structured names if available, otherwise parse from full name
        let givenNames = author.givenNames || '';
        let surname = author.surname || '';

        if (!givenNames && !surname) {
          const parsed = parseNameParts(fullName);
          givenNames = parsed.givenNames;
          surname = parsed.surname;
        }

        return {
          id: author.id || null,
          name: fullName,
          givenNames,
          surname,
          email: author.email || null,
          orcid: author.orcidId || null,
          orcidId: author.orcidId || null,
          affiliation: author.affiliation || null,
          bio: author.bio || null,
          website: author.website || null,
          isCorresponding: authorRel.isCorresponding || false,
          order: authorRel.order || 0,
          isRegistered: !!author.id
        };
      });

      // Find corresponding author
      correspondingAuthor = authorList.find(author => author.isCorresponding) || null;
    }
    // Fallback to simple author array if no detailed relations
    else if (metadata.authors && Array.isArray(metadata.authors)) {
      authorList = metadata.authors.map((name: string, index: number) => {
        const trimmedName = name.trim();
        const parsed = parseNameParts(trimmedName);

        return {
          id: null,
          name: trimmedName,
          givenNames: parsed.givenNames,
          surname: parsed.surname,
          email: null,
          orcid: null,
          orcidId: null,
          affiliation: null,
          bio: null,
          website: null,
          isCorresponding: index === 0,
          order: index,
          isRegistered: false
        };
      });

      correspondingAuthor = authorList[0] || null;
    }
  } catch (error) {
    console.warn('Error processing author data:', error);
  }

  // Generate backward-compatible authors string
  const authorsString = authorList.length > 0
    ? authorList.map(author => author.name).join(', ')
    : '';

  return {
    authorsString,
    authorList,
    authorCount: authorList.length,
    correspondingAuthor
  };
}
