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

// GET /api/content/editorial-board - Get editorial board members (special route)
router.get('/editorial-board', async (req, res, next) => {
  try {
    // Get users with EDITOR or ADMIN roles
    const { GlobalRole } = require('@colloquium/database');
    const editors = await prisma.user.findMany({
      where: {
        role: {
          in: [GlobalRole.EDITOR_IN_CHIEF, GlobalRole.ADMIN]
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
            authoredManuscripts: true,
            reviewAssignments: true
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
        publishedPapers: editor._count.authoredManuscripts,
        completedReviews: editor._count.reviewAssignments
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
    
    const parsed = parseMarkdownFile(filePath);
    
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
    const content = parseMarkdownFile(filePath);
    
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