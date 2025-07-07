import { BotAction } from '@colloquium/types';
export interface ActionContext {
    manuscriptId: string;
    userId: string;
    conversationId: string;
}
export declare class BotActionProcessor {
    processActions(actions: BotAction[], context: ActionContext): Promise<void>;
    private processAction;
    private handleAssignReviewer;
    private handleUpdateManuscriptStatus;
    private handleCreateConversation;
    private handleRespondToReview;
    private handleSubmitReview;
    private handleMakeEditorialDecision;
    private sendDecisionEmail;
    private createRevisionConversation;
    private handleAssignActionEditor;
}
export declare const botActionProcessor: BotActionProcessor;
//# sourceMappingURL=botActionProcessor.d.ts.map