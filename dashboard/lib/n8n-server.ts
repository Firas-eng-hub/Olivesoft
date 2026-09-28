import { timingSafeEqual } from "node:crypto";

export function n8nConfig() {
  const uploadUrl = process.env.OLIVESOFT_N8N_UPLOAD_URL;
  const apiKey = process.env.OLIVESOFT_N8N_UPLOAD_API_KEY;
  const teamPassword = process.env.OLIVESOFT_UPLOAD_TEAM_PASSWORD;
  if (!uploadUrl || !apiKey || !teamPassword) return null;
  let parsed: URL;
  try { parsed = new URL(uploadUrl); } catch { return null; }
  if (parsed.protocol !== "https:" || !parsed.pathname.endsWith("/webhook/olivesoft/v1/knowledge/upload")) return null;
  return { origin: parsed.origin, apiKey, teamPassword };
}

export function authorized(request: Request, expected: string) {
  const actual = Buffer.from(request.headers.get("x-olivesoft-upload-password") ?? "");
  const target = Buffer.from(expected);
  return actual.length === target.length && timingSafeEqual(actual, target);
}

export class N8nRequestError extends Error {
  constructor(public readonly path: string, public readonly status: number) {
    super(`n8n ${path} returned ${status}`);
  }
}

export async function n8nRequest(origin: string, apiKey: string, path: string, init: RequestInit = {}) {
  const response = await fetch(new URL(`/webhook/${path}`, origin), {
    ...init,
    headers: { "api-key": apiKey, ...init.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new N8nRequestError(path, response.status);
  return response.json() as Promise<unknown>;
}
