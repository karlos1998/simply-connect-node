export interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  protocol?: string;
  socket?: { remoteAddress?: string };
}

export interface ResponseLike {
  setHeader?: (name: string, value: string) => unknown;
  header?: (name: string, value: string) => unknown;
  status?: (status: number) => unknown;
  code?: (status: number) => unknown;
}

export function header(
  response: ResponseLike,
  name: string,
  value: string,
): void {
  if (response.setHeader) response.setHeader(name, value);
  else response.header?.(name, value);
}

export function status(response: ResponseLike, value: number): void {
  if (response.status) response.status(value);
  else response.code?.(value);
}

export function requestHeader(
  request: RequestLike,
  name: string,
): string | undefined {
  const value = request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

export function isSecure(request: RequestLike): boolean {
  const forwarded = requestHeader(request, "x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  return request.protocol === "https" || forwarded === "https";
}

export function remoteAddress(request: RequestLike): string {
  return request.ip ?? request.socket?.remoteAddress ?? "unknown";
}

export function secureHeaders(response: ResponseLike): void {
  header(response, "Cache-Control", "no-store, max-age=0");
  header(response, "Pragma", "no-cache");
  header(response, "X-Frame-Options", "DENY");
  header(response, "X-Content-Type-Options", "nosniff");
  header(response, "Referrer-Policy", "no-referrer");
  header(
    response,
    "Content-Security-Policy",
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  );
  header(response, "Content-Type", "text/html; charset=utf-8");
}
