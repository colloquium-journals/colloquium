jest.mock('@colloquium/database', () => ({
  prisma: {
    journal_settings: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../../src/jobs/index', () => ({
  addPipelineStepJob: jest.fn(),
}));

import { prisma } from '@colloquium/database';
import { addPipelineStepJob } from '../../src/jobs/index';
import { getPipelineConfig, eventNameToPipelineKey, dispatchPipeline } from '../../src/services/pipelineExecutor';

describe('pipelineExecutor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('eventNameToPipelineKey', () => {
    it('should map manuscript.submitted to on-submission', () => {
      expect(eventNameToPipelineKey('manuscript.submitted')).toBe('on-submission');
    });

    it('should map manuscript.statusChanged to on-status-changed', () => {
      expect(eventNameToPipelineKey('manuscript.statusChanged')).toBe('on-status-changed');
    });

    it('should return undefined for unknown events', () => {
      expect(eventNameToPipelineKey('unknown.event')).toBeUndefined();
    });
  });

  describe('getPipelineConfig', () => {
    it('should return parsed pipeline config', async () => {
      (prisma.journal_settings.findFirst as jest.Mock).mockResolvedValue({
        settings: {
          pipelines: {
            'on-submission': [{ bot: 'bot-reference-check', command: 'check' }],
          },
        },
      });

      const config = await getPipelineConfig();
      expect(config).toBeDefined();
      expect(config!.pipelines!['on-submission']).toHaveLength(1);
    });

    it('should return null when no settings exist', async () => {
      (prisma.journal_settings.findFirst as jest.Mock).mockResolvedValue(null);

      const config = await getPipelineConfig();
      expect(config).toBeNull();
    });
  });

  describe('dispatchPipeline', () => {
    it('should queue pipeline step for matching event', async () => {
      (prisma.journal_settings.findFirst as jest.Mock).mockResolvedValue({
        settings: {
          pipelines: {
            'on-submission': [
              { bot: 'bot-reference-check', command: 'check' },
              { bot: 'bot-reviewer-checklist', command: 'generate' },
            ],
          },
        },
      });

      await dispatchPipeline('manuscript.submitted', 'ms-1');

      expect(addPipelineStepJob).toHaveBeenCalledWith({
        manuscriptId: 'ms-1',
        steps: [
          { bot: 'bot-reference-check', command: 'check' },
          { bot: 'bot-reviewer-checklist', command: 'generate' },
        ],
        stepIndex: 0,
      });
    });

    it('should not queue anything for unmapped events', async () => {
      await dispatchPipeline('unknown.event', 'ms-1');
      expect(addPipelineStepJob).not.toHaveBeenCalled();
    });

    it('should not queue anything when no pipelines are configured', async () => {
      (prisma.journal_settings.findFirst as jest.Mock).mockResolvedValue({
        settings: {},
      });

      await dispatchPipeline('manuscript.submitted', 'ms-1');
      expect(addPipelineStepJob).not.toHaveBeenCalled();
    });
  });
});
