import { Router } from 'express';
import { prisma } from '@colloquium/database';

const router = Router();

// GET /api/manuscripts - List all manuscripts
router.get('/', async (req, res, next) => {
  try {
    const { 
      status = 'PUBLISHED', 
      page = '1', 
      limit = '20', 
      search,
      orderBy = 'publishedAt',
      order = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};
    
    // Filter by status - default to published for public feed
    if (status) {
      where.status = status as string;
    }

    // Search functionality
    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { abstract: { contains: search as string, mode: 'insensitive' } },
        { authors: { hasSome: [search as string] } }
      ];
    }

    // Get manuscripts with related data
    const [manuscripts, total] = await Promise.all([
      prisma.manuscript.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [orderBy as string]: order as 'asc' | 'desc' },
        include: {
          _count: {
            select: {
              conversations: true
            }
          }
        }
      }),
      prisma.manuscript.count({ where })
    ]);

    // Format response
    const formattedManuscripts = manuscripts.map(manuscript => ({
      id: manuscript.id,
      title: manuscript.title,
      abstract: manuscript.abstract,
      authors: manuscript.authors,
      keywords: manuscript.keywords,
      status: manuscript.status,
      submittedAt: manuscript.createdAt,
      publishedAt: manuscript.publishedAt,
      conversationCount: manuscript._count.conversations,
      fileUrl: manuscript.fileUrl,
      metadata: manuscript.metadata
    }));

    res.json({
      manuscripts: formattedManuscripts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/manuscripts - Submit new manuscript
router.post('/', async (req, res, next) => {
  try {
    const {
      title,
      abstract,
      content,
      authors,
      keywords = [],
      metadata = {}
    } = req.body;

    // Validate required fields
    if (!title || !abstract || !authors || authors.length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Title, abstract, and at least one author are required',
        details: {
          title: !title ? 'Title is required' : null,
          abstract: !abstract ? 'Abstract is required' : null,
          authors: !authors || authors.length === 0 ? 'At least one author is required' : null
        }
      });
    }

    // Create the manuscript
    const manuscript = await prisma.manuscript.create({
      data: {
        title: title.trim(),
        abstract: abstract.trim(),
        content: content?.trim() || null,
        authors: Array.isArray(authors) ? authors.map((author: string) => author.trim()) : [authors.trim()],
        keywords: Array.isArray(keywords) ? keywords.map((keyword: string) => keyword.trim()).filter(Boolean) : [],
        status: 'SUBMITTED',
        metadata: metadata || {}
      }
    });

    // Return the created manuscript
    const formattedManuscript = {
      id: manuscript.id,
      title: manuscript.title,
      abstract: manuscript.abstract,
      content: manuscript.content,
      authors: manuscript.authors,
      keywords: manuscript.keywords,
      status: manuscript.status,
      submittedAt: manuscript.createdAt,
      updatedAt: manuscript.updatedAt,
      metadata: manuscript.metadata
    };

    res.status(201).json({
      message: 'Manuscript submitted successfully',
      manuscript: formattedManuscript
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/manuscripts/:id - Get manuscript details
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const manuscript = await prisma.manuscript.findUnique({
      where: { id },
      include: {
        conversations: {
          include: {
            _count: {
              select: {
                messages: true,
                participants: true
              }
            }
          }
        },
        _count: {
          select: {
            conversations: true
          }
        }
      }
    });

    if (!manuscript) {
      return res.status(404).json({ 
        error: 'Manuscript not found',
        message: `No manuscript found with ID: ${id}`
      });
    }

    // Format response
    const formattedManuscript = {
      id: manuscript.id,
      title: manuscript.title,
      abstract: manuscript.abstract,
      authors: manuscript.authors,
      keywords: manuscript.keywords,
      status: manuscript.status,
      submittedAt: manuscript.createdAt,
      publishedAt: manuscript.publishedAt,
      updatedAt: manuscript.updatedAt,
      fileUrl: manuscript.fileUrl,
      metadata: manuscript.metadata,
      conversationCount: manuscript._count.conversations,
      conversations: manuscript.conversations.map(conv => ({
        id: conv.id,
        title: conv.title,
        type: conv.type,
        privacy: conv.privacy,
        messageCount: conv._count.messages,
        participantCount: conv._count.participants,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt
      }))
    };

    res.json(formattedManuscript);
  } catch (error) {
    next(error);
  }
});

// PUT /api/manuscripts/:id - Update manuscript
router.put('/:id', async (req, res, next) => {
  try {
    // TODO: Implement manuscript update
    res.json({ message: 'Manuscript updated' });
  } catch (error) {
    next(error);
  }
});

// GET /api/manuscripts/:id/conversations - List conversations for manuscript
router.get('/:id/conversations', async (req, res, next) => {
  try {
    // TODO: Implement conversation listing
    res.json([]);
  } catch (error) {
    next(error);
  }
});

// POST /api/manuscripts/:id/conversations - Create new conversation
router.post('/:id/conversations', async (req, res, next) => {
  try {
    // TODO: Implement conversation creation
    res.status(201).json({ message: 'Conversation created' });
  } catch (error) {
    next(error);
  }
});

export default router;