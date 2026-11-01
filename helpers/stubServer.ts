import http from 'node:http';
import type { AddressInfo } from 'node:net';

/** One scripted reply. `reset` destroys the socket instead of answering. */
export type StubStep = { status: number; headers?: Record<string, string>; body?: unknown } | { reset: true };

export interface ReceivedRequest {
  method: string;
  path: string;
  headers: http.IncomingHttpHeaders;
}

/** A local server that replays scripted responses. Binds to 127.0.0.1 only. */
export class StubServer {
  readonly received: ReceivedRequest[] = [];
  private readonly scripts = new Map<string, StubStep[]>();
  private readonly server = http.createServer((req, res) => this.handle(req, res));
  private baseUrl = '';

  get url(): string {
    return this.baseUrl;
  }

  /** Replies with the steps in order; the last step repeats. */
  script(method: string, path: string, steps: StubStep[]): void {
    this.scripts.set(`${method} ${path}`, [...steps]);
  }

  requestsTo(method: string, path: string): ReceivedRequest[] {
    return this.received.filter((r) => r.method === method && r.path === path);
  }

  async start(): Promise<void> {
    await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));
    const { port } = this.server.address() as AddressInfo;
    this.baseUrl = `http://127.0.0.1:${port}`;
  }

  async stop(): Promise<void> {
    this.server.closeAllConnections();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  private handle(req: http.IncomingMessage, res: http.ServerResponse): void {
    const method = req.method ?? 'GET';
    const path = new URL(req.url ?? '/', this.baseUrl).pathname;
    this.received.push({ method, path, headers: req.headers });

    const steps = this.scripts.get(`${method} ${path}`);
    const step = steps && steps.length > 1 ? steps.shift() : steps?.[0];
    req.resume();
    req.on('end', () => {
      if (!step) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ message: `No stub scripted for ${method} ${path}` }));
      } else if ('reset' in step) {
        req.socket.destroy();
      } else {
        res.writeHead(step.status, { 'content-type': 'application/json', ...step.headers });
        res.end(JSON.stringify(step.body ?? {}));
      }
    });
  }
}
