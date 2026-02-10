import { BotApiError } from './errors';

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | FormData;
  timeout?: number;
}

export function createHttpClient(apiUrl: string, serviceToken: string) {
  async function request(path: string, options: RequestOptions = {}): Promise<Response> {
    const url = path.startsWith('http') ? path : `${apiUrl}${path}`;

    const headers: Record<string, string> = {
      'x-bot-token': serviceToken,
      ...options.headers,
    };

    if (options.body && typeof options.body === 'string') {
      headers['content-type'] = 'application/json';
    }

    const fetchOptions: RequestInit = {
      method: options.method || 'GET',
      headers,
    };

    if (options.body) {
      fetchOptions.body = options.body;
    }

    if (options.timeout) {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), options.timeout);
      fetchOptions.signal = controller.signal;
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      let body = '';
      try {
        body = await response.text();
      } catch {
        // ignore read errors
      }
      throw new BotApiError(response.status, response.statusText, body);
    }

    return response;
  }

  async function getJSON<T>(path: string): Promise<T> {
    const response = await request(path);
    return response.json() as Promise<T>;
  }

  async function postJSON<T>(path: string, data: unknown): Promise<T> {
    const response = await request(path, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.json() as Promise<T>;
  }

  async function putJSON<T>(path: string, data: unknown): Promise<T> {
    const response = await request(path, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.json() as Promise<T>;
  }

  async function deleteRequest(path: string): Promise<void> {
    await request(path, { method: 'DELETE' });
  }

  return { request, getJSON, postJSON, putJSON, deleteRequest };
}

export type HttpClient = ReturnType<typeof createHttpClient>;
