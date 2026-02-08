/**
 * Mock API Server for bot testing
 *
 * Intercepts fetch calls and returns mocked responses
 */

import { MockFile } from './mockFiles';

const DEFAULT_API_URL = process.env.API_URL || 'http://localhost:4000';

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
  authors?: string[] | { name: string; email?: string; isCorresponding?: boolean }[];
  status?: string;
  submittedAt?: string;
  reviewAssignments?: any[];
  actionEditors?: any[];
}

/**
 * Mock API server that intercepts fetch calls
 */
export class MockApiServer {
  private endpoints: MockEndpoint[] = [];
  private originalFetch: typeof fetch | null = null;
  private files: MockFile[] = [];
  private manuscriptData: MockManuscriptData = {};
  private requestLog: MockRequest[] = [];

  /**
   * Creates a MockApiServer pre-configured with manuscript data
   */
  static withManuscript(data: MockManuscriptData): MockApiServer {
    const server = new MockApiServer();
    server.manuscriptData = data;
    server.setupDefaultEndpoints();
    return server;
  }

  /**
   * Creates a MockApiServer pre-configured with files
   */
  static withFiles(files: MockFile[]): MockApiServer {
    const server = new MockApiServer();
    server.files = files;
    server.setupDefaultEndpoints();
    return server;
  }

  /**
   * Creates a MockApiServer with both manuscript data and files
   */
  static withManuscriptAndFiles(data: MockManuscriptData, files: MockFile[]): MockApiServer {
    const server = new MockApiServer();
    server.manuscriptData = data;
    server.files = files;
    server.setupDefaultEndpoints();
    return server;
  }

  /**
   * Sets up default endpoints for common API calls
   */
  private setupDefaultEndpoints(): void {
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
          blob: async () => typeof content === 'string'
            ? new Blob([content])
            : new Blob([new Uint8Array(content) as BlobPart]),
          arrayBuffer: async (): Promise<ArrayBuffer> => {
            if (typeof content === 'string') {
              return new TextEncoder().encode(content).buffer as ArrayBuffer;
            }
            return content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer;
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
            downloadUrl: `${DEFAULT_API_URL}/api/articles/test/files/uploaded/download`,
            size: 1024
          }]
        })
      })
    });
  }

  /**
   * Adds a custom endpoint
   */
  addEndpoint(endpoint: MockEndpoint): this {
    this.endpoints.push(endpoint);
    return this;
  }

  /**
   * Sets files available through the mock server
   */
  setFiles(files: MockFile[]): this {
    this.files = files;
    return this;
  }

  /**
   * Sets manuscript data
   */
  setManuscriptData(data: MockManuscriptData): this {
    this.manuscriptData = { ...this.manuscriptData, ...data };
    return this;
  }

  /**
   * Installs the mock fetch interceptor
   */
  install(): void {
    if (this.originalFetch) {
      throw new Error('MockApiServer is already installed');
    }

    this.originalFetch = global.fetch;
    this.requestLog = [];

    global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = (init?.method ?? 'GET').toUpperCase();
      const headers: Record<string, string> = {};

      if (init?.headers) {
        if (init.headers instanceof Headers) {
          init.headers.forEach((value, key) => {
            headers[key] = value;
          });
        } else if (Array.isArray(init.headers)) {
          init.headers.forEach(([key, value]) => {
            headers[key] = value;
          });
        } else {
          Object.assign(headers, init.headers);
        }
      }

      const request: MockRequest = {
        url,
        method,
        headers,
        body: init?.body
      };

      this.requestLog.push(request);

      // Find matching endpoint
      for (const endpoint of this.endpoints) {
        if (endpoint.method !== method) continue;

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
  uninstall(): void {
    if (this.originalFetch) {
      global.fetch = this.originalFetch;
      this.originalFetch = null;
    }
  }

  /**
   * Gets the log of all requests made
   */
  getRequestLog(): MockRequest[] {
    return [...this.requestLog];
  }

  /**
   * Clears the request log
   */
  clearRequestLog(): void {
    this.requestLog = [];
  }

  /**
   * Creates a Response object from MockResponse
   */
  private createFetchResponse(mock: MockResponse): Response {
    const response = {
      ok: mock.ok,
      status: mock.status,
      statusText: mock.ok ? 'OK' : 'Error',
      headers: new Headers(),
      url: '',
      redirected: false,
      type: 'basic' as ResponseType,
      body: null,
      bodyUsed: false,
      clone: () => response,
      json: mock.json ?? (async () => ({})),
      text: mock.text ?? (async () => ''),
      blob: mock.blob ?? (async () => new Blob()),
      arrayBuffer: mock.arrayBuffer ?? (async () => new ArrayBuffer(0)),
      formData: async () => new FormData()
    } as Response;

    return response;
  }
}
