import { prisma } from '@colloquium/database';
import { WorkflowConfig } from '@colloquium/types';

let cachedConfig: WorkflowConfig | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

export async function getWorkflowConfig(): Promise<WorkflowConfig | null> {
  const now = Date.now();
  if (cachedConfig !== null && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedConfig;
  }

  try {
    const settings = await prisma.journal_settings.findFirst({
      where: { id: 'singleton' },
      select: { settings: true }
    });

    if (settings?.settings && typeof settings.settings === 'object') {
      const journalSettings = settings.settings as any;
      cachedConfig = journalSettings.workflowConfig || null;
    } else {
      cachedConfig = null;
    }
    cacheTimestamp = now;
    return cachedConfig;
  } catch (error) {
    console.error('Failed to get workflow config:', error);
    return null;
  }
}

export function invalidateWorkflowConfigCache(): void {
  cachedConfig = null;
  cacheTimestamp = 0;
}
