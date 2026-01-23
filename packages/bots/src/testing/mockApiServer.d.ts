/**
 * Mock API Server for bot testing
 *
 * Intercepts fetch calls and returns mocked responses
 */
import { MockFile } from './mockFiles';
export interface MockRequest {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: any;
}
export interface MockResponse {
    ok: boolean;
    status: number;
    json?: () => Promise<any>;
    text?: () => Promise<string>;
    blob?: () => Promise<Blob>;
    arrayBuffer?: () => Promise<ArrayBuffer>;
}
export interface MockEndpoint {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    path: string | RegExp;
    response: (req: MockRequest) => MockResponse | Promise<MockResponse>;
}
export interface MockManuscriptData {
    id?: string;
    title?: string;
    abstract?: string;
    authors?: string[] | {
        name: string;
        email?: string;
        isCorresponding?: boolean;
    }[];
    status?: string;
    submittedAt?: string;
    reviewAssignments?: any[];
    actionEditors?: any[];
}
/**
 * Mock API server that intercepts fetch calls
 */
export declare class MockApiServer {
    private endpoints;
    private originalFetch;
    private files;
    private manuscriptData;
    private requestLog;
    /**
     * Creates a MockApiServer pre-configured with manuscript data
     */
    static withManuscript(data: MockManuscriptData): MockApiServer;
    /**
     * Creates a MockApiServer pre-configured with files
     */
    static withFiles(files: MockFile[]): MockApiServer;
    /**
     * Creates a MockApiServer with both manuscript data and files
     */
    static withManuscriptAndFiles(data: MockManuscriptData, files: MockFile[]): MockApiServer;
    /**
     * Sets up default endpoints for common API calls
     */
    private setupDefaultEndpoints;
    /**
     * Adds a custom endpoint
     */
    addEndpoint(endpoint: MockEndpoint): this;
    /**
     * Sets files available through the mock server
     */
    setFiles(files: MockFile[]): this;
    /**
     * Sets manuscript data
     */
    setManuscriptData(data: MockManuscriptData): this;
    /**
     * Installs the mock fetch interceptor
     */
    install(): void;
    /**
     * Uninstalls the mock fetch interceptor
     */
    uninstall(): void;
    /**
     * Gets the log of all requests made
     */
    getRequestLog(): MockRequest[];
    /**
     * Clears the request log
     */
    clearRequestLog(): void;
    /**
     * Creates a Response object from MockResponse
     */
    private createFetchResponse;
}
//# sourceMappingURL=mockApiServer.d.ts.map