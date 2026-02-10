export class BotApiError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly body: string;

  constructor(status: number, statusText: string, body: string) {
    super(`Bot API request failed: ${status} ${statusText}`);
    this.name = 'BotApiError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}
