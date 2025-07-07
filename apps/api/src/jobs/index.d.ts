import Queue from 'bull';
export declare const getBotQueue: () => Queue.Queue<any>;
export interface BotProcessingJob {
    messageId: string;
    conversationId: string;
    userId: string;
    manuscriptId?: string;
}
export declare const getQueueHealth: () => Promise<{
    status: string;
    message: string;
    waiting?: undefined;
    active?: undefined;
    completed?: undefined;
    failed?: undefined;
    redis?: undefined;
    error?: undefined;
} | {
    status: string;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    redis: string;
    message?: undefined;
    error?: undefined;
} | {
    status: string;
    error: string;
    redis: string;
    message?: undefined;
    waiting?: undefined;
    active?: undefined;
    completed?: undefined;
    failed?: undefined;
}>;
export declare const closeQueues: () => Promise<void>;
export default getBotQueue;
//# sourceMappingURL=index.d.ts.map