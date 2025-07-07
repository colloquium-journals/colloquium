declare const router: import("express-serve-static-core").Router;
export declare function broadcastToConversation(conversationId: string, eventData: any, manuscriptId?: string): Promise<void>;
export declare function getConnectionCount(conversationId?: string): number;
export declare function closeAllConnections(): void;
export default router;
//# sourceMappingURL=events.d.ts.map