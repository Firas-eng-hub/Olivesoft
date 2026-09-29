import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { renderBundle } from './service.js';

const port = Number(process.env.PORT ?? 8080);
const token = process.env.OLIVESOFT_RENDERER_TOKEN;
if (!token || token.length < 24) throw new Error('OLIVESOFT_RENDERER_TOKEN must be set');
function authenticated(value) {
  const actual = Buffer.from((value ?? '').replace(/^Bearer /i, ''));
  const expected = Buffer.from(token);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
function respond(response, status, data) {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  response.end(JSON.stringify(data));
}
createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') return respond(response, 200, { status: 'ok' });
  if (request.method !== 'POST' || request.url !== '/render') return respond(response, 404, { code: 'NOT_FOUND' });
  if (!authenticated(request.headers.authorization)) return respond(response, 401, { code: 'UNAUTHORIZED' });
  try {
    let size = 0; const parts = [];
    for await (const part of request) { size += part.length; if (size > 256 * 1024) return respond(response, 413, { code: 'REQUEST_TOO_LARGE' }); parts.push(part); }
    const bundle = await renderBundle(JSON.parse(Buffer.concat(parts).toString('utf8')));
    return respond(response, 200, bundle);
  } catch (error) {
    console.error('Render failed', String(error?.message ?? error).slice(0, 200));
    return respond(response, 422, { code: 'RENDER_FAILED', message: String(error?.message ?? error).slice(0, 200) });
  }
}).listen(port, '0.0.0.0');
