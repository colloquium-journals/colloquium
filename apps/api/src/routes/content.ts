import { Router } from 'express';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { marked } from 'marked';
import matter from 'gray-matter';
import { z } from 'zod';
import { prisma } from '@colloquium/database';

const router = Router();

// Content directory path
const CONTENT_DIR = join(process.cwd(), '../../content');
const SECTIONS_CONFIG_PATH = join(CONTENT_DIR, 'sections.json');

// Validation schemas
const contentPathSchema = z.object({
  section: z.string().regex(/^[a-zA-Z0-9-_]+$/, 'Invalid section name'),
  page: z.string().regex(/^[a-zA-Z0-9-_]+$/, 'Invalid page name').optional()
});

// Configure marked for security
marked.setOptions({
  gfm: true,
  breaks: false,
  pedantic: false
});

// Section configuration schema
const sectionConfigSchema = z.object({
  sections: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    path: z.string(),
    contentPath: z.string(),
    icon: z.string(),
    order: z.number(),
    visible: z.boolean(),
    showInNavigation: z.boolean(),
    allowAnonymous: z.boolean()
  })),
  configuration: z.object({
    version: z.string(),
    lastUpdated: z.string(),
    defaultIcon: z.string(),
    allowCustomSections: z.boolean(),
    maxSections: z.number()
  })
});

// Helper function to load section configuration
function loadSectionConfig() {
  try {
    if (!existsSync(SECTIONS_CONFIG_PATH)) {
      // Return default configuration if file doesn't exist
      return {
        sections: [
          {
            id: "about",
            title: "About",
            description: "Learn about our journal, policies, and community",
            path: "/about",
            contentPath: "about",
            icon: "IconFileText",
            order: 1,
            visible: true,
            showInNavigation: true,
            allowAnonymous: true
          }
        ],
        configuration: {
          version: "1.0",
          lastUpdated: new Date().toISOString().split('T')[0],
          defaultIcon: "IconFileText",
          allowCustomSections: true,
          maxSections: 10
        }
      };
    }

    const configContent = readFileSync(SECTIONS_CONFIG_PATH, 'utf-8');
    const config = JSON.parse(configContent);
    
    // Validate the configuration
    const validation = sectionConfigSchema.safeParse(config);
    if (!validation.success) {
      console.error('Invalid sections configuration:', validation.error);
      throw new Error('Invalid sections configuration');
    }
    
    return validation.data;
  } catch (error) {
    console.error('Error loading section configuration:', error);
    // Return minimal default configuration on error
    return {
      sections: [
        {
          id: "about",
          title: "About",
          description: "Learn about our journal",
          path: "/about", 
          contentPath: "about",
          icon: "IconFileText",
          order: 1,
          visible: true,
          showInNavigation: true,
          allowAnonymous: true
        }
      ],
      configuration: {
        version: "1.0",
        lastUpdated: new Date().toISOString().split('T')[0],
        defaultIcon: "IconFileText",
        allowCustomSections: false,
        maxSections: 10
      }
    };
  }
}

// Helper function to read and parse markdown files
function parseMarkdownFile(filePath: string) {
  try {
    const fileContent = readFileSync(filePath, 'utf-8');
    const { data: frontmatter, content } = matter(fileContent);
    const html = marked(content);
    
    return {
      frontmatter,
      content,
      html,
      lastModified: require('fs').statSync(filePath).mtime
    };
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

// Helper function to read and parse markdown files with dynamic content processing
async function parseMarkdownFileWithDynamicContent(filePath: string) {
  try {
    const fileContent = readFileSync(filePath, 'utf-8');
    const { data: frontmatter, content } = matter(fileContent);
    
    // Process dynamic content inserts
    const processedContent = await processDynamicContent(content);
    const html = marked(processedContent);
    
    return {
      frontmatter,
      content: processedContent,
      html,
      lastModified: require('fs').statSync(filePath).mtime
    };
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

// Helper function to list content files in a directory
function listContentFiles(dirPath: string) {
  try {
    if (!existsSync(dirPath)) {
      return [];
    }
    
    const files = readdirSync(dirPath)
      .filter(file => file.endsWith('.md'))
      .map(file => {
        const filePath = join(dirPath, file);
        const parsed = parseMarkdownFile(filePath);
        
        if (!parsed) return null;
        
        return {
          slug: file.replace('.md', ''),
          title: parsed.frontmatter.title || file.replace('.md', ''),
          description: parsed.frontmatter.description || '',
          order: parsed.frontmatter.order || 999,
          visible: parsed.frontmatter.visible !== false,
          lastUpdated: parsed.frontmatter.lastUpdated || parsed.lastModified,
          wordCount: parsed.content.split(/\s+/).length
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a?.order || 999) - (b?.order || 999));
    
    return files;
  } catch (error) {
    console.error(`Error listing directory ${dirPath}:`, error);
    return [];
  }
}

// Dynamic content processing functions
async function getEditorialBoardMembers() {
  try {
    const { GlobalRole } = require('@colloquium/database');
    const editors = await prisma.users.findMany({
      where: {
        role: {
          in: [GlobalRole.EDITOR_IN_CHIEF, GlobalRole.MANAGING_EDITOR, GlobalRole.ADMIN]
        },
        name: {
          not: null
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        bio: true,
        orcidId: true,
        affiliation: true,
        website: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            manuscript_authors: true,
            review_assignments: true
          }
        }
      }
    });

    return editors.map(editor => ({
      ...editor,
      publishedPapers: editor._count.manuscript_authors,
      completedReviews: editor._count.review_assignments
    }));
  } catch (error) {
    console.error('Error fetching editorial board members:', error);
    return [];
  }
}

// Template functions for different editorial board displays
function generateEditorialBoardHTML(members: any[], template: string = 'cards') {
  if (members.length === 0) {
    return '<p><em>No editorial board members found.</em></p>';
  }

  switch (template) {
    case 'list':
      return generateEditorialList(members);
    case 'cards':
      return generateEditorialCards(members);
    case 'compact':
      return generateEditorialCompact(members);
    case 'stats':
      return generateEditorialStats(members);
    default:
      return generateEditorialCards(members);
  }
}

function generateEditorialList(members: any[]) {
  const { GlobalRole } = require('@colloquium/database');
  
  const admins = members.filter(m => m.role === GlobalRole.ADMIN);
  const editors = members.filter(m => m.role === GlobalRole.EDITOR_IN_CHIEF);

  let html = '';

  if (admins.length > 0) {
    html += '<h3>Editors-in-Chief</h3>\n<ul>\n';
    admins.forEach(admin => {
      html += `<li><strong>${admin.name}</strong>`;
      if (admin.affiliation) html += ` - ${admin.affiliation}`;
      if (admin.orcidId) html += ` (<a href="https://orcid.org/${admin.orcidId}" target="_blank">ORCID</a>)`;
      html += '</li>\n';
    });
    html += '</ul>\n';
  }

  if (editors.length > 0) {
    html += '<h3>Editorial Board Members</h3>\n<ul>\n';
    editors.forEach(editor => {
      html += `<li><strong>${editor.name}</strong>`;
      if (editor.affiliation) html += ` - ${editor.affiliation}`;
      if (editor.orcidId) html += ` (<a href="https://orcid.org/${editor.orcidId}" target="_blank">ORCID</a>)`;
      html += '</li>\n';
    });
    html += '</ul>\n';
  }

  return html;
}

function generateEditorialCards(members: any[]) {
  let html = '<div class="editorial-board-cards" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; margin: 1rem 0;">\n';
  
  members.forEach(member => {
    html += `
    <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 1rem; background: #fafafa;">
      <h4 style="margin: 0 0 0.5rem 0; color: #333;">${member.name}</h4>
      ${member.affiliation ? `<p style="margin: 0 0 0.5rem 0; color: #666; font-size: 0.9rem;"><em>${member.affiliation}</em></p>` : ''}
      ${member.bio ? `<p style="margin: 0 0 0.5rem 0; font-size: 0.9rem;">${member.bio.substring(0, 150)}${member.bio.length > 150 ? '...' : ''}</p>` : ''}
      <div style="display: flex; gap: 1rem; margin-top: 0.5rem; font-size: 0.8rem; color: #666;">
        ${member.publishedPapers > 0 ? `<span>📄 ${member.publishedPapers} papers</span>` : ''}
        ${member.completedReviews > 0 ? `<span>📝 ${member.completedReviews} reviews</span>` : ''}
      </div>
      ${member.orcidId || member.website ? `
      <div style="margin-top: 0.5rem;">
        ${member.orcidId ? `<a href="https://orcid.org/${member.orcidId}" target="_blank" style="font-size: 0.8rem; margin-right: 0.5rem;">ORCID</a>` : ''}
        ${member.website ? `<a href="${member.website}" target="_blank" style="font-size: 0.8rem;">Website</a>` : ''}
      </div>` : ''}
    </div>`;
  });
  
  html += '</div>\n';
  return html;
}

function generateEditorialCompact(members: any[]) {
  let html = '<div class="editorial-compact">\n';
  
  members.forEach((member, index) => {
    html += `<span><strong>${member.name}</strong>`;
    if (member.affiliation) html += ` (${member.affiliation})`;
    if (index < members.length - 1) html += ', ';
    html += '</span>';
  });
  
  html += '</div>\n';
  return html;
}

function generateEditorialStats(members: any[]) {
  const { GlobalRole } = require('@colloquium/database');
  
  const totalMembers = members.length;
  const admins = members.filter(m => m.role === GlobalRole.ADMIN).length;
  const editors = members.filter(m => m.role === GlobalRole.EDITOR_IN_CHIEF).length;
  const totalPapers = members.reduce((sum, m) => sum + m.publishedPapers, 0);
  const totalReviews = members.reduce((sum, m) => sum + m.completedReviews, 0);

  return `
<div class="editorial-stats" style="background: #f5f5f5; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
  <h4 style="margin: 0 0 1rem 0;">Editorial Board Statistics</h4>
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
    <div style="text-align: center;">
      <div style="font-size: 2rem; font-weight: bold; color: #2563eb;">${totalMembers}</div>
      <div style="font-size: 0.9rem; color: #666;">Total Members</div>
    </div>
    <div style="text-align: center;">
      <div style="font-size: 2rem; font-weight: bold; color: #059669;">${admins}</div>
      <div style="font-size: 0.9rem; color: #666;">Editors-in-Chief</div>
    </div>
    <div style="text-align: center;">
      <div style="font-size: 2rem; font-weight: bold; color: #dc2626;">${editors}</div>
      <div style="font-size: 0.9rem; color: #666;">Board Members</div>
    </div>
    <div style="text-align: center;">
      <div style="font-size: 2rem; font-weight: bold; color: #7c3aed;">${totalPapers}</div>
      <div style="font-size: 0.9rem; color: #666;">Published Papers</div>
    </div>
    <div style="text-align: center;">
      <div style="font-size: 2rem; font-weight: bold; color: #ea580c;">${totalReviews}</div>
      <div style="font-size: 0.9rem; color: #666;">Completed Reviews</div>
    </div>
  </div>
</div>`;
}

// Process dynamic content inserts in markdown
async function processDynamicContent(content: string): Promise<string> {
  // Match patterns like {{editorial-board:template}} or {{editorial-board}}
  const insertPattern = /\{\{editorial-board(?::([^}]+))?\}\}/g;
  
  let processedContent = content;
  const matches = Array.from(content.matchAll(insertPattern));
  
  for (const match of matches) {
    const fullMatch = match[0];
    const template = match[1] || 'cards'; // Default to 'cards' template
    
    try {
      const members = await getEditorialBoardMembers();
      const htmlContent = generateEditorialBoardHTML(members, template);
      processedContent = processedContent.replace(fullMatch, htmlContent);
    } catch (error) {
      console.error('Error processing editorial board insert:', error);
      processedContent = processedContent.replace(fullMatch, '<p><em>Error loading editorial board data.</em></p>');
    }
  }
  
  return processedContent;
}

// GET /api/content/editorial-board - Get editorial board members (special route)
router.get('/editorial-board', async (req, res, next) => {
  try {
    // Get users with EDITOR or ADMIN roles
    const { GlobalRole } = require('@colloquium/database');
    const editors = await prisma.users.findMany({
      where: {
        role: {
          in: [GlobalRole.EDITOR_IN_CHIEF, GlobalRole.MANAGING_EDITOR, GlobalRole.ADMIN]
        },
        // Only include users with names (more professional presentation)
        name: {
          not: null
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        bio: true,
        affiliation: true,
        website: true,
        orcidId: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            manuscript_authors: true,
            review_assignments: true
          }
        }
      },
      orderBy: [
        { role: 'desc' }, // ADMIN first, then EDITOR
        { name: 'asc' }   // Alphabetical within role
      ]
    });

    // Format the response
    const boardMembers = editors.map(editor => ({
      id: editor.id,
      name: editor.name,
      email: editor.email,
      bio: editor.bio,
      affiliation: editor.affiliation,
      website: editor.website,
      orcidId: editor.orcidId,
      role: editor.role,
      memberSince: editor.createdAt,
      stats: {
        publishedPapers: editor._count.manuscript_authors,
        completedReviews: editor._count.review_assignments
      },
      profileUrl: `/users/${editor.id}`
    }));

    // Try to get editorial board content from markdown file
    const boardContentPath = join(CONTENT_DIR, 'about', 'editorial-board.md');
    let boardContent = null;
    
    if (existsSync(boardContentPath)) {
      boardContent = parseMarkdownFile(boardContentPath);
    }

    res.json({
      title: boardContent?.frontmatter.title || 'Editorial Board',
      description: boardContent?.frontmatter.description || 'Our editorial team',
      content: boardContent?.html || '',
      lastUpdated: boardContent?.frontmatter.lastUpdated || new Date().toISOString().split('T')[0],
      members: boardMembers,
      totalMembers: boardMembers.length,
      roles: {
        admins: boardMembers.filter(m => m.role === GlobalRole.ADMIN).length,
        editors: boardMembers.filter(m => m.role === GlobalRole.EDITOR_IN_CHIEF).length
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/content/sections/config - Get section configuration
router.get('/sections/config', async (req, res, next) => {
  try {
    const config = loadSectionConfig();
    res.json(config);
  } catch (error) {
    next(error);
  }
});

// GET /api/content/sections - List configured content sections with metadata
router.get('/sections', async (req, res, next) => {
  try {
    const config = loadSectionConfig();
    
    // Combine configuration with filesystem data
    const sections = config.sections
      .filter(sectionConfig => sectionConfig.visible)
      .map(sectionConfig => {
        const sectionPath = join(CONTENT_DIR, sectionConfig.contentPath);
        const pages = existsSync(sectionPath) ? listContentFiles(sectionPath) : [];
        const visiblePages = pages.filter(page => page?.visible);
        
        return {
          ...sectionConfig,
          pageCount: visiblePages.length,
          hasContent: existsSync(sectionPath),
          lastUpdated: visiblePages.length > 0 
            ? Math.max(...visiblePages.map(p => new Date(p?.lastUpdated || 0).getTime()))
            : new Date().getTime()
        };
      })
      .sort((a, b) => a.order - b.order);

    res.json({
      sections,
      total: sections.length,
      configuration: config.configuration
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/content/:section - List all pages in a section
router.get('/:section', async (req, res, next) => {
  try {
    const validation = contentPathSchema.safeParse(req.params);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid Path',
        message: 'Invalid section name',
        details: validation.error.issues
      });
    }

    const { section } = validation.data;
    const sectionPath = join(CONTENT_DIR, section);
    
    const pages = listContentFiles(sectionPath);
    
    // Filter visible pages for non-admin users
    // TODO: Check if user is admin when authentication is integrated
    const visiblePages = pages.filter(page => page?.visible);
    
    res.json({
      section,
      pages: visiblePages,
      total: visiblePages.length
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/content/:section/:page - Get specific page content
router.get('/:section/:page', async (req, res, next) => {
  try {
    const validation = contentPathSchema.safeParse(req.params);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid Path',
        message: 'Invalid section or page name',
        details: validation.error.issues
      });
    }

    const { section, page } = validation.data;
    const fileName = page === 'index' ? 'index.md' : `${page}.md`;
    const filePath = join(CONTENT_DIR, section, fileName);
    
    const parsed = await parseMarkdownFileWithDynamicContent(filePath);
    
    if (!parsed) {
      return res.status(404).json({
        error: 'Content Not Found',
        message: `Page "${page}" not found in section "${section}"`
      });
    }

    // Check if page is visible (for non-admin users)
    if (parsed.frontmatter.visible === false) {
      // TODO: Check if user is admin when authentication is integrated
      return res.status(404).json({
        error: 'Content Not Found',
        message: 'Page not found'
      });
    }

    const response = {
      section,
      page,
      title: parsed.frontmatter.title || page,
      description: parsed.frontmatter.description || '',
      lastUpdated: parsed.frontmatter.lastUpdated || parsed.lastModified,
      frontmatter: parsed.frontmatter,
      content: parsed.content,
      html: parsed.html,
      wordCount: parsed.content.split(/\s+/).length,
      readingTime: Math.ceil(parsed.content.split(/\s+/).length / 200) // Assume 200 WPM
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/content/:section/index - Get section index page (alias for index.md)
router.get('/:section/index', async (req, res, next) => {
  try {
    const { section } = req.params;
    const validation = contentPathSchema.safeParse({ section, page: 'index' });
    
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid Path',
        message: 'Section name contains invalid characters'
      });
    }

    const filePath = join(CONTENT_DIR, section, 'index.md');
    const content = await parseMarkdownFileWithDynamicContent(filePath);
    
    if (!content) {
      return res.status(404).json({
        error: 'Content Not Found',
        message: `No index page found for section: ${section}`
      });
    }

    res.json({
      section,
      page: 'index',
      title: content.frontmatter.title || 'Index',
      content: content.html,
      metadata: content.frontmatter,
      lastModified: content.lastModified || new Date()
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/content - List all content sections (legacy, now uses configuration)
router.get('/', async (req, res, next) => {
  try {
    if (!existsSync(CONTENT_DIR)) {
      return res.json({
        sections: [],
        total: 0
      });
    }

    const config = loadSectionConfig();
    
    // Return configured sections for legacy compatibility
    const sections = config.sections
      .filter(sectionConfig => sectionConfig.visible)
      .map(sectionConfig => {
        const sectionPath = join(CONTENT_DIR, sectionConfig.contentPath);
        const pages = existsSync(sectionPath) ? listContentFiles(sectionPath) : [];
        const visiblePages = pages.filter(page => page?.visible);
        
        return {
          slug: sectionConfig.id,
          name: sectionConfig.title,
          description: sectionConfig.description,
          pageCount: visiblePages.length,
          lastUpdated: visiblePages.length > 0 
            ? Math.max(...visiblePages.map(p => new Date(p?.lastUpdated || 0).getTime()))
            : new Date().getTime()
        };
      })
      .filter(section => section.pageCount > 0)
      .sort((a, b) => {
        const aConfig = config.sections.find(s => s.id === a.slug);
        const bConfig = config.sections.find(s => s.id === b.slug);
        return (aConfig?.order || 999) - (bConfig?.order || 999);
      });

    res.json({
      sections,
      total: sections.length
    });
  } catch (error) {
    next(error);
  }
});

export default router;