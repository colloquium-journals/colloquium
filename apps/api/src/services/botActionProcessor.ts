import { BotAction } from '@colloquium/types';
import { handleAssignReviewer } from './botActions/reviewerActions';
import { handleRespondToReview, handleSubmitReview } from './botActions/reviewActions';
import {
  handleMakeEditorialDecision,
  handleAssignActionEditor,
  handleUpdateWorkflowPhase,
  handleSendManualReminder
} from './botActions/editorialActions';
import { handleExecutePublicationWorkflow } from './botActions/publicationActions';
import { handleCreateConversation, handleUpdateManuscriptStatus } from './botActions/conversationActions';

export interface ActionContext {
  manuscriptId: string;
  userId: string;
  conversationId: string;
}

export class BotActionProcessor {
  async processActions(actions: BotAction[], context: ActionContext): Promise<void> {
    for (const action of actions) {
      try {
        await this.processAction(action, context);
      } catch (error) {
        console.error(`Failed to process bot action ${action.type}:`, error);
      }
    }
  }

  private async processAction(action: BotAction, context: ActionContext): Promise<void> {
    switch (action.type) {
      case 'ASSIGN_REVIEWER':
        await handleAssignReviewer(action.data, context);
        break;

      case 'UPDATE_MANUSCRIPT_STATUS':
        await handleUpdateManuscriptStatus(action.data, context);
        break;

      case 'CREATE_CONVERSATION':
        await handleCreateConversation(action.data, context);
        break;

      case 'RESPOND_TO_REVIEW':
        await handleRespondToReview(action.data, context);
        break;

      case 'SUBMIT_REVIEW':
        await handleSubmitReview(action.data, context);
        break;

      case 'MAKE_EDITORIAL_DECISION':
        await handleMakeEditorialDecision(action.data, context);
        break;

      case 'ASSIGN_ACTION_EDITOR':
        await handleAssignActionEditor(action.data, context);
        break;

      case 'EXECUTE_PUBLICATION_WORKFLOW':
        await handleExecutePublicationWorkflow(action.data, context);
        break;

      case 'UPDATE_WORKFLOW_PHASE':
        await handleUpdateWorkflowPhase(action.data, context);
        break;

      case 'SEND_MANUAL_REMINDER':
        await handleSendManualReminder(
          action.data as { reviewer: string; customMessage?: string; triggeredBy?: string },
          context
        );
        break;

      default:
        console.warn(`Unknown bot action type: ${action.type}`);
    }
  }
}

export const botActionProcessor = new BotActionProcessor();
