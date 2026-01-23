"use strict";
/**
 * Mock API Server for bot testing
 *
 * Intercepts fetch calls and returns mocked responses
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockApiServer = void 0;
/**
 * Mock API server that intercepts fetch calls
 */
class MockApiServer {
    constructor() {
        this.endpoints = [];
        this.originalFetch = null;
        this.files = [];
        this.manuscriptData = {};
        this.requestLog = [];
    }
    /**
     * Creates a MockApiServer pre-configured with manuscript data
     */
    static withManuscript(data) {
        const server = new MockApiServer();
        server.manuscriptData = data;
        server.setupDefaultEndpoints();
        return server;
    }
    /**
     * Creates a MockApiServer pre-configured with files
     */
    static withFiles(files) {
        const server = new MockApiServer();
        server.files = files;
        server.setupDefaultEndpoints();
        return server;
    }
    /**
     * Creates a MockApiServer with both manuscript data and files
     */
    static withManuscriptAndFiles(data, files) {
        const server = new MockApiServer();
        server.manuscriptData = data;
        server.files = files;
        server.setupDefaultEndpoints();
        return server;
    }
    /**
     * Sets up default endpoints for common API calls
     */
    setupDefaultEndpoints() {
        // Files list endpoint
        this.addEndpoint({
            method: 'GET',
            path: /\/api\/articles\/[^/]+\/files$/,
            response: () => ({
                ok: true,
                status: 200,
                json: async () => ({
                    files: this.files.map(f => ({
                        id: f.id,
                        filename: f.filename,
                        originalName: f.originalName,
                        fileType: f.fileType,
                        mimetype: f.mimetype,
                        size: f.size,
                        downloadUrl: f.downloadUrl
                    }))
                })
            })
        });
        // File download endpoint
        this.addEndpoint({
            method: 'GET',
            path: /\/api\/articles\/[^/]+\/files\/[^/]+\/download/,
            response: (req) => {
                const fileIdMatch = req.url.match(/\/files\/([^/]+)\/download/);
                const fileId = fileIdMatch?.[1];
                const file = this.files.find(f => f.id === fileId);
                if (!file) {
                    return {
                        ok: false,
                        status: 404,
                        json: async () => ({ error: 'File not found' })
                    };
                }
                const content = file.content;
                return {
                    ok: true,
                    status: 200,
                    text: async () => typeof content === 'string' ? content : content.toString('utf-8'),
                    blob: async () => new Blob([content]),
                    arrayBuffer: async () => {
                        if (typeof content === 'string') {
                            return new TextEncoder().encode(content).buffer;
                        }
                        return content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength);
                    }
                };
            }
        });
        // Manuscript details endpoint
        this.addEndpoint({
            method: 'GET',
            path: /\/api\/articles\/[^/]+$/,
            response: () => ({
                ok: true,
                status: 200,
                json: async () => ({
                    id: this.manuscriptData.id ?? 'test-manuscript-id',
                    title: this.manuscriptData.title ?? 'Test Manuscript',
                    abstract: this.manuscriptData.abstract ?? 'Test abstract',
                    authors: this.manuscriptData.authors ?? [{ name: 'Test Author' }],
                    status: this.manuscriptData.status ?? 'SUBMITTED',
                    submittedAt: this.manuscriptData.submittedAt ?? new Date().toISOString(),
                    reviewAssignments: this.manuscriptData.reviewAssignments ?? [],
                    actionEditors: this.manuscriptData.actionEditors ?? []
                })
            })
        });
        // File upload endpoint
        this.addEndpoint({
            method: 'POST',
            path: /\/api\/articles\/[^/]+\/files$/,
            response: () => ({
                ok: true,
                status: 201,
                json: async () => ({
                    files: [{
                            id: `uploaded-file-${Date.now()}`,
                            filename: 'uploaded-file.html',
                            originalName: 'uploaded-file.html',
                            downloadUrl: 'http://localhost:4000/api/articles/test/files/uploaded/download',
                            size: 1024
                        }]
                })
            })
        });
    }
    /**
     * Adds a custom endpoint
     */
    addEndpoint(endpoint) {
        this.endpoints.push(endpoint);
        return this;
    }
    /**
     * Sets files available through the mock server
     */
    setFiles(files) {
        this.files = files;
        return this;
    }
    /**
     * Sets manuscript data
     */
    setManuscriptData(data) {
        this.manuscriptData = { ...this.manuscriptData, ...data };
        return this;
    }
    /**
     * Installs the mock fetch interceptor
     */
    install() {
        if (this.originalFetch) {
            throw new Error('MockApiServer is already installed');
        }
        this.originalFetch = global.fetch;
        this.requestLog = [];
        global.fetch = async (input, init) => {
            const url = typeof input === 'string' ? input : input.toString();
            const method = (init?.method ?? 'GET').toUpperCase();
            const headers = {};
            if (init?.headers) {
                if (init.headers instanceof Headers) {
                    init.headers.forEach((value, key) => {
                        headers[key] = value;
                    });
                }
                else if (Array.isArray(init.headers)) {
                    init.headers.forEach(([key, value]) => {
                        headers[key] = value;
                    });
                }
                else {
                    Object.assign(headers, init.headers);
                }
            }
            const request = {
                url,
                method,
                headers,
                body: init?.body
            };
            this.requestLog.push(request);
            // Find matching endpoint
            for (const endpoint of this.endpoints) {
                if (endpoint.method !== method)
                    continue;
                const pathMatches = typeof endpoint.path === 'string'
                    ? url.includes(endpoint.path)
                    : endpoint.path.test(url);
                if (pathMatches) {
                    const mockResponse = await endpoint.response(request);
                    return this.createFetchResponse(mockResponse);
                }
            }
            // Default response for unmatched endpoints
            console.warn(`MockApiServer: No handler for ${method} ${url}`);
            return this.createFetchResponse({
                ok: false,
                status: 404,
                json: async () => ({ error: 'Not found' })
            });
        };
    }
    /**
     * Uninstalls the mock fetch interceptor
     */
    uninstall() {
        if (this.originalFetch) {
            global.fetch = this.originalFetch;
            this.originalFetch = null;
        }
    }
    /**
     * Gets the log of all requests made
     */
    getRequestLog() {
        return [...this.requestLog];
    }
    /**
     * Clears the request log
     */
    clearRequestLog() {
        this.requestLog = [];
    }
    /**
     * Creates a Response object from MockResponse
     */
    createFetchResponse(mock) {
        const response = {
            ok: mock.ok,
            status: mock.status,
            statusText: mock.ok ? 'OK' : 'Error',
            headers: new Headers(),
            url: '',
            redirected: false,
            type: 'basic',
            body: null,
            bodyUsed: false,
            clone: () => response,
            json: mock.json ?? (async () => ({})),
            text: mock.text ?? (async () => ''),
            blob: mock.blob ?? (async () => new Blob()),
            arrayBuffer: mock.arrayBuffer ?? (async () => new ArrayBuffer(0)),
            formData: async () => new FormData()
        };
        return response;
    }
}
exports.MockApiServer = MockApiServer;
