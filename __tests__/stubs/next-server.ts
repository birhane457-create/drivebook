/**
 * Lightweight next/server stub for Vitest integration tests.
 *
 * The real next/server module bootstraps Next.js App Router internals that
 * depend on the Next.js runtime environment.  Importing it directly inside a
 * bare Vitest worker crashes the worker silently ("No test suite found").
 *
 * This stub exports compatible types and minimal implementations that let
 * route-handler tests construct requests and inspect responses without
 * the full Next.js runtime.
 */

export class NextRequest {
  public readonly method: string;
  public readonly url:    string;
  public readonly headers: Headers;
  private _body: unknown;

  constructor(input: string | URL | Request, init?: RequestInit) {
    if (typeof input === 'string' || input instanceof URL) {
      this.url    = String(input);
      this.method = (init?.method ?? 'GET').toUpperCase();
      this.headers = new Headers(init?.headers);
      this._body   = init?.body;
    } else {
      // Request object
      this.url     = input.url;
      this.method  = input.method;
      this.headers = input.headers;
      this._body   = null;
    }
  }

  async json(): Promise<unknown> {
    if (typeof this._body === 'string') {
      return JSON.parse(this._body);
    }
    return this._body;
  }

  async text(): Promise<string> {
    return typeof this._body === 'string' ? this._body : JSON.stringify(this._body);
  }

  get nextUrl() {
    const u = new URL(this.url);
    return Object.assign(u, { searchParams: u.searchParams });
  }
}

export class NextResponse<T = unknown> extends Response {
  constructor(body?: BodyInit | null, init?: ResponseInit) {
    super(body, init);
  }

  static json<T>(data: T, init?: ResponseInit): NextResponse<T> {
    const body = JSON.stringify(data);
    const headers = new Headers(init?.headers);
    headers.set('content-type', 'application/json');
    return new NextResponse<T>(body, { ...init, headers });
  }

  static redirect(url: string | URL, status = 307): NextResponse {
    return new NextResponse(null, {
      status,
      headers: { Location: String(url) },
    });
  }

  static rewrite(url: string | URL): NextResponse {
    return new NextResponse(null, {
      status: 200,
      headers: { 'x-middleware-rewrite': String(url) },
    });
  }

  static next(): NextResponse {
    return new NextResponse(null, { status: 200 });
  }

  async json(): Promise<T> {
    const text = await this.text();
    return JSON.parse(text) as T;
  }
}

// Re-export types that route handlers commonly use
export type { NextRequest as NextRequestType };
export type { NextResponse as NextResponseType };
