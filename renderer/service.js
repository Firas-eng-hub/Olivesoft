import { createHash } from 'node:crypto';
import { renderPptx } from './render.js';
import { renderPdf } from './pdf.js';

const MAX_FILE = 2 * 1024 * 1024;
export async function renderBundle(input) {
  const pptx = await renderPptx(input);
  const pdf = await renderPdf(input);
  if (pptx.bytes.length > MAX_FILE || pdf.bytes.length > MAX_FILE ||
      pptx.bytes.length + pdf.bytes.length > 2.8 * 1024 * 1024) {
    throw new Error('Rendered bundle exceeds Vercel response limit');
  }
  return {
    job_id: input.job_id, lead_id: input.lead_id, template_version: 'olivesoft-native-v1',
    files: [
      { kind: 'pptx', mime_type: pptx.mime_type, size_bytes: pptx.bytes.length, sha256: pptx.sha256, base64: pptx.bytes.toString('base64') },
      { kind: 'pdf', mime_type: 'application/pdf', size_bytes: pdf.bytes.length, sha256: createHash('sha256').update(pdf.bytes).digest('hex'), base64: pdf.bytes.toString('base64') },
    ],
    slide_count: pptx.slide_count, page_count: pdf.page_count,
  };
}
