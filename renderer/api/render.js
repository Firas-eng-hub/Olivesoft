import { timingSafeEqual } from 'node:crypto';
import { renderBundle } from '../service.js';

const MAX_INPUT = 256 * 1024;
function authenticated(value, token) {
  const actual = Buffer.from((value ?? '').replace(/^Bearer /i, ''));
  const expected = Buffer.from(token);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'GET') return res.status(200).json({ status: 'ok' });
  if (req.method !== 'POST') return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
  const token = process.env.OLIVESOFT_RENDERER_TOKEN;
  if (!token || token.length < 24) return res.status(503).json({ code: 'NOT_CONFIGURED' });
  if (!authenticated(req.headers.authorization, token)) return res.status(401).json({ code: 'UNAUTHORIZED' });
  try {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
    if (Buffer.byteLength(raw) > MAX_INPUT) return res.status(413).json({ code: 'REQUEST_TOO_LARGE' });
    const bundle = await renderBundle(JSON.parse(raw));
    return res.status(200).json(bundle);
  } catch (error) {
    console.error('Proposal rendering failed', String(error?.message ?? error).slice(0, 200));
    return res.status(422).json({ code: 'RENDER_FAILED', message: String(error?.message ?? error).slice(0, 200) });
  }
}
