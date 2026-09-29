import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { validateProposal } from './render.js';

const fontPath = new URL('./fonts/DejaVuSans.ttf', import.meta.url);
const boldPath = new URL('./fonts/DejaVuSans-Bold.ttf', import.meta.url);
const navy = rgb(0.08, 0.15, 0.27);
const blue = rgb(0.13, 0.47, 0.72);
const ink = rgb(0.09, 0.18, 0.28);
const muted = rgb(0.32, 0.39, 0.47);
const white = rgb(1, 1, 1);
const PAGE = { width: 960, height: 540, left: 54, right: 906, top: 476, bottom: 45 };

function wrap(text, font, size, maxWidth) {
  const lines = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(next, size) > maxWidth) {
        lines.push(line); line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}
export async function renderPdf(input) {
  const p = validateProposal(input);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await readFile(fontPath));
  const bold = await pdf.embedFont(await readFile(boldPath));
  pdf.setTitle(`OliveSoft proposal — ${p.title}`);
  pdf.setAuthor('OliveSoft');
  let page; let y; let number = 0;
  function newPage(title, cover = false) {
    page = pdf.addPage([PAGE.width, PAGE.height]); number++;
    page.drawRectangle({ x: 0, y: PAGE.height - 11, width: PAGE.width, height: 11, color: blue });
    if (cover) {
      page.drawRectangle({ x: 0, y: 0, width: PAGE.width, height: PAGE.height - 11, color: navy });
      page.drawText('OLIVESOFT', { x: PAGE.left, y: 467, size: 18, font: bold, color: white });
      y = 378;
    } else {
      page.drawText('OLIVESOFT  /  TENDER RESPONSE', { x: PAGE.left, y: 494, size: 10, font: bold, color: blue });
      page.drawText(title, { x: PAGE.left, y: 452, size: 25, font: bold, color: navy, maxWidth: 840 });
      page.drawText(`OliveSoft  •  ${String(number).padStart(2, '0')}`, { x: 782, y: 22, size: 8, font, color: muted });
      y = 400;
    }
  }
  function lines(text, size = 15, weight = font, color = ink, gap = 1.35, maxWidth = 840) {
    const output = wrap(text, weight, size, maxWidth);
    const lineHeight = size * gap;
    for (const line of output) {
      if (y - lineHeight < PAGE.bottom) newPage('Continued');
      if (line) page.drawText(line, { x: PAGE.left, y, size, font: weight, color, maxWidth });
      y -= lineHeight;
    }
    return output.length;
  }
  function section(title) {
    if (y < 120) newPage(title);
    y -= 12; lines(title, 17, bold, blue); y -= 9;
  }
  newPage('', true);
  lines(p.organization, 29, bold, white, 1.28, 830); y -= 22;
  lines(p.title, 24, font, white, 1.3, 830);
  page.drawText(`Tender response  •  ${p.requirements.length} requirements`, { x: PAGE.left, y: 46, size: 11, font, color: white });
  newPage('Opportunity overview');
  lines(p.summary, 18);
  if (p.deadline) { y -= 18; lines(`Tender deadline: ${p.deadline}`, 12, bold, blue); }
  newPage('Requirement assessment');
  for (const r of p.requirements) {
    if (y < 100) newPage('Requirement assessment continued');
    lines(`${r.id}  ${r.label}`, 14, bold);
    lines(`Judgment: ${r.status.toUpperCase()}`, 10, bold, r.status === 'supported' ? blue : muted);
    y -= 13;
  }
  const refs = p.requirements.flatMap(r => r.evidence.map(e => ({ ...e, id: r.id })));
  if (refs.length) {
    newPage('Internal evidence');
    for (const e of refs) {
      section(`${e.id}  ${e.title}`);
      lines(e.quote, 11);
      lines(e.path, 8, font, muted);
      y -= 8;
    }
  }
  if (p.research_claims.length) {
    newPage('Cited public research');
    for (const c of p.research_claims) {
      section(c.claim);
      lines(c.url, 9, font, blue);
      y -= 8;
    }
  }
  newPage('Review and next steps');
  lines('Review the requirement judgments and linked source excerpts before sharing this proposal. Confirm delivery scope, availability, schedule, and commercial terms with the responsible team.', 19);
  y -= 28; lines(`Lead ${p.lead_id}  •  Job ${p.job_id}`, 9, font, muted);
  const bytes = Buffer.from(await pdf.save());
  if (bytes.length < 100 || bytes.subarray(0, 4).toString() !== '%PDF' || !bytes.subarray(-2048).toString().includes('%%EOF')) throw new Error('Invalid PDF export');
  return { bytes, page_count: number };
}
