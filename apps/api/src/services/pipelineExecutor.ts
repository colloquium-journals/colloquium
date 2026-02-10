import { prisma } from '@colloquium/database';
import { PipelineConfigSchema, PipelineConfig } from '@colloquium/types';
import { addPipelineStepJob } from '../jobs/index';

const eventToPipelineKey: Record<string, string> = {
  'manuscript.submitted': 'on-submission',
  'manuscript.statusChanged': 'on-status-changed',
  'file.uploaded': 'on-file-uploaded',
  'reviewer.assigned': 'on-reviewer-assigned',
  'reviewer.statusChanged': 'on-reviewer-status-changed',
  'workflow.phaseChanged': 'on-phase-changed',
  'decision.released': 'on-decision-released',
};

export function eventNameToPipelineKey(eventName: string): string | undefined {
  return eventToPipelineKey[eventName];
}

export async function getPipelineConfig(): Promise<PipelineConfig | null> {
  const settings = await prisma.journal_settings.findFirst();
  if (!settings?.settings) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = settings.settings as any;
  const parsed = PipelineConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export async function dispatchPipeline(eventName: string, manuscriptId: string): Promise<void> {
  const pipelineKey = eventNameToPipelineKey(eventName);
  if (!pipelineKey) return;

  const config = await getPipelineConfig();
  const steps = config?.pipelines?.[pipelineKey];
  if (!steps?.length) return;

  await addPipelineStepJob({
    manuscriptId,
    steps,
    stepIndex: 0,
  });
}
