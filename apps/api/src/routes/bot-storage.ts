import { Router, Request, Response } from 'express';
import { prisma } from '@colloquium/database';
import { authenticateWithBots } from '../middleware/auth';
import { requireBotPermission, requireBotOnly } from '../middleware/botPermissions';
import { BotApiPermission } from '@colloquium/types';

const router = Router();

// GET /api/bot-storage - List all keys for bot+manuscript
router.get('/', authenticateWithBots, requireBotPermission(BotApiPermission.BOT_STORAGE), async (req: Request, res: Response) => {
  const ctx = requireBotOnly(req, res);
  if (!ctx) return;

  const entries = await prisma.bot_storage.findMany({
    where: { botId: ctx.botId, manuscriptId: ctx.manuscriptId },
    select: { key: true, updatedAt: true },
    orderBy: { key: 'asc' },
  });

  res.json(entries);
});

// GET /api/bot-storage/:key - Get value for key
router.get('/:key', authenticateWithBots, requireBotPermission(BotApiPermission.BOT_STORAGE), async (req: Request, res: Response) => {
  const ctx = requireBotOnly(req, res);
  if (!ctx) return;

  const entry = await prisma.bot_storage.findUnique({
    where: {
      botId_manuscriptId_key: {
        botId: ctx.botId,
        manuscriptId: ctx.manuscriptId,
        key: req.params.key,
      },
    },
  });

  if (!entry) {
    return res.status(404).json({ error: 'Key not found' });
  }

  res.json({ key: entry.key, value: entry.value, updatedAt: entry.updatedAt });
});

// PUT /api/bot-storage/:key - Set value (upsert)
router.put('/:key', authenticateWithBots, requireBotPermission(BotApiPermission.BOT_STORAGE), async (req: Request, res: Response) => {
  const ctx = requireBotOnly(req, res);
  if (!ctx) return;

  const { value } = req.body;
  if (value === undefined) {
    return res.status(400).json({ error: 'value is required in request body' });
  }

  const entry = await prisma.bot_storage.upsert({
    where: {
      botId_manuscriptId_key: {
        botId: ctx.botId,
        manuscriptId: ctx.manuscriptId,
        key: req.params.key,
      },
    },
    update: { value },
    create: {
      botId: ctx.botId,
      manuscriptId: ctx.manuscriptId,
      key: req.params.key,
      value,
    },
  });

  res.json({ key: entry.key, value: entry.value, updatedAt: entry.updatedAt });
});

// DELETE /api/bot-storage/:key - Delete key
router.delete('/:key', authenticateWithBots, requireBotPermission(BotApiPermission.BOT_STORAGE), async (req: Request, res: Response) => {
  const ctx = requireBotOnly(req, res);
  if (!ctx) return;

  try {
    await prisma.bot_storage.delete({
      where: {
        botId_manuscriptId_key: {
          botId: ctx.botId,
          manuscriptId: ctx.manuscriptId,
          key: req.params.key,
        },
      },
    });
    res.status(204).send();
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2025') {
      return res.status(404).json({ error: 'Key not found' });
    }
    throw error;
  }
});

export default router;
