import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "simply_connect_panel";

export class PanelSession {
  readonly #key: Buffer;

  constructor(
    password: string,
    readonly ttlMs: number,
  ) {
    this.#key = createHmac("sha256", "simply-connect-panel-v1")
      .update(password)
      .digest();
  }

  create(now = Date.now()): string {
    const payload = `${now}.${now + this.ttlMs}.${randomBytes(18).toString("base64url")}`;
    return `${payload}.${this.#sign(payload)}`;
  }

  validate(cookieHeader: string | undefined, now = Date.now()): string | null {
    const token = parseCookies(cookieHeader)[COOKIE_NAME];
    if (!token) return null;
    const pieces = token.split(".");
    if (pieces.length !== 4) return null;
    const payload = pieces.slice(0, 3).join(".");
    const signature = pieces[3]!;
    if (!constantEqual(signature, this.#sign(payload))) return null;
    const issuedAt = Number(pieces[0]);
    const expiresAt = Number(pieces[1]);
    if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) return null;
    if (
      issuedAt > now + 30_000 ||
      expiresAt <= now ||
      expiresAt - issuedAt > this.ttlMs
    )
      return null;
    return token;
  }

  csrf(session: string, action: string): string {
    return this.#sign(`csrf.${session}.${action}`);
  }

  verifyCsrf(session: string, action: string, token: unknown): boolean {
    return (
      typeof token === "string" &&
      constantEqual(token, this.csrf(session, action))
    );
  }

  cookie(value: string, secure: boolean, path = "/"): string {
    const maxAge = Math.floor(this.ttlMs / 1000);
    return `${COOKIE_NAME}=${value}; Path=${path}; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
  }

  #sign(value: string): string {
    return createHmac("sha256", this.#key).update(value).digest("base64url");
  }
}

function parseCookies(header: string | undefined): Record<string, string> {
  const values: Record<string, string> = {};
  for (const part of header?.split(";") ?? []) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    values[part.slice(0, separator).trim()] = part.slice(separator + 1).trim();
  }
  return values;
}

function constantEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
