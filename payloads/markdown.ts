export interface MarkdownRequest {
  text: string;
  mode?: 'markdown' | 'gfm';
  /** owner/repo, used to resolve references in gfm mode. */
  context?: string;
}

export function buildMarkdownRequest(text: string, options: Omit<MarkdownRequest, 'text'> = {}): MarkdownRequest {
  return { text, mode: 'markdown', ...options };
}
