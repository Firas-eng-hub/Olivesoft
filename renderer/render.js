import pptxgen from 'pptxgenjs';
import { createHash } from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TAG = /\{\{|\}\}|\[\[|\]\]|<%|%>/;
const COLOR = { navy: '152743', blue: '2378B8', pale: 'EAF3F9', white: 'FFFFFF', ink: '18304A', muted: '52657A', amber: 'AC6610' };
const MIME_PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

function field(value, max, label) {
  if (typeof value !== 'string') throw new Error(`Invalid ${label}`);
  const text = value.trim();
  if (!text || text.length > max || TAG.test(text)) throw new Error(`Invalid ${label}`);
  return text;
}
function optional(value, max, label) { return value == null || value === '' ? null : field(value, max, label); }
export function validateProposal(input) {
  if (!input || typeof input !== 'object' || !UUID.test(input.job_id) || !UUID.test(input.lead_id)) throw new Error('Invalid render identity');
  const p = input.proposal;
  if (!p || typeof p !== 'object') throw new Error('Missing proposal');
  const title = field(p.title, 120, 'title');
  const organization = field(p.organization, 100, 'organization');
  const summary = field(p.summary, 1200, 'summary');
  if (!Array.isArray(p.requirements) || p.requirements.length < 1 || p.requirements.length > 50) throw new Error('Invalid requirements');
  const requirements = p.requirements.map((r, i) => {
    const id = field(r.id, 10, 'requirement ID');
    if (id !== `R-${String(i + 1).padStart(2, '0')}`) throw new Error('Requirement order mismatch');
    const status = r.status;
    if (!['supported', 'partial', 'unsupported', 'unknown'].includes(status)) throw new Error('Invalid judgment');
    const evidence = Array.isArray(r.evidence) ? r.evidence : [];
    if (evidence.length > 5) throw new Error('Too many evidence references');
    const refs = evidence.map(e => ({
      title: field(e.title, 160, 'evidence title'),
      path: field(e.source_path, 300, 'evidence path'),
      quote: field(e.quote, 800, 'evidence quote'),
    }));
    if (['supported', 'partial', 'unsupported'].includes(status) && refs.length === 0) throw new Error('Judgment lacks evidence');
    return { id, label: field(r.label, 500, 'requirement'), status, evidence: refs };
  });
  const claims = Array.isArray(p.research_claims) ? p.research_claims : [];
  if (claims.length > 15) throw new Error('Too many research claims');
  const research_claims = claims.map(c => {
    const url = field(c.url, 1000, 'citation URL');
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') throw new Error('Citation must be HTTPS');
    const excerpt = field(c.excerpt, 1000, 'citation excerpt');
    const claim = field(c.claim, 400, 'research claim');
    if (!excerpt.toLocaleLowerCase().includes(claim.toLocaleLowerCase())) throw new Error('Claim lacks exact citation');
    return { url, claim, excerpt };
  });
  return { job_id: input.job_id, lead_id: input.lead_id, title, organization, summary, requirements, research_claims, deadline: optional(p.deadline, 30, 'deadline') };
}
function header(slide, title, number) {
  slide.background = { color: COLOR.white };
  slide.addShape('rect', { x: 0, y: 0, w: 13.333, h: 0.16, line: { color: COLOR.blue }, fill: { color: COLOR.blue } });
  slide.addText('OLIVESOFT  /  TENDER RESPONSE', { x: 0.65, y: 0.35, w: 6, h: 0.25, fontFace: 'Aptos', fontSize: 9, bold: true, color: COLOR.blue, margin: 0 });
  slide.addText(title, { x: 0.65, y: 0.78, w: 11.9, h: 0.55, fontFace: 'Aptos Display', fontSize: 25, bold: true, color: COLOR.navy, margin: 0, breakLine: false });
  slide.addText(`OliveSoft  •  ${String(number).padStart(2, '0')}`, { x: 10.35, y: 7.12, w: 2.25, h: 0.2, align: 'right', fontFace: 'Aptos', fontSize: 8, color: COLOR.muted, margin: 0 });
}
function body(slide, text, y, h, fontSize = 16) {
  slide.addText(text, { x: 0.78, y, w: 11.8, h, fontFace: 'Aptos', fontSize, color: COLOR.ink, valign: 'top', breakLine: false, margin: 0.08, autoFit: 'shrink' });
}
export async function renderPptx(input) {
  const p = validateProposal(input);
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'OliveSoft';
  pptx.subject = `Tender response for ${p.organization}`;
  pptx.title = `OliveSoft proposal — ${p.title}`;
  pptx.lang = 'en-US';
  let number = 1;
  let slide = pptx.addSlide();
  slide.background = { color: COLOR.navy };
  slide.addShape('rect', { x: 0.72, y: 0.92, w: 1.08, h: 0.12, line: { color: COLOR.blue }, fill: { color: COLOR.blue } });
  slide.addText('OLIVESOFT', { x: 0.72, y: 0.43, w: 4, h: 0.33, fontSize: 16, bold: true, color: COLOR.white, margin: 0 });
  slide.addText(p.organization, { x: 0.72, y: 1.57, w: 11.8, h: 0.7, fontSize: 34, bold: true, color: COLOR.white, margin: 0, autoFit: 'shrink' });
  slide.addText(p.title, { x: 0.72, y: 2.48, w: 11.8, h: 1.25, fontSize: 28, color: 'D7E7F1', margin: 0, autoFit: 'shrink' });
  slide.addText(`Tender response  •  ${p.requirements.length} requirements`, { x: 0.72, y: 6.66, w: 10, h: 0.28, fontSize: 12, color: COLOR.white, margin: 0 });
  slide = pptx.addSlide(); header(slide, 'Opportunity overview', ++number);
  body(slide, p.summary, 1.62, 3.7, 21);
  if (p.deadline) body(slide, `Tender deadline: ${p.deadline}`, 5.76, 0.55, 14);
  for (let i = 0; i < p.requirements.length; i += 5) {
    slide = pptx.addSlide(); header(slide, `Requirement assessment ${Math.floor(i / 5) + 1}`, ++number);
    const page = p.requirements.slice(i, i + 5);
    page.forEach((r, j) => {
      const y = 1.52 + j * 1.02;
      slide.addShape('roundRect', { x: 0.7, y, w: 11.95, h: 0.88, rectRadius: 0.08, line: { color: COLOR.pale }, fill: { color: COLOR.pale } });
      slide.addText(`${r.id}  ${r.label}`, { x: 0.92, y: y + 0.08, w: 9.25, h: 0.72, fontSize: 15, color: COLOR.ink, margin: 0.03, autoFit: 'shrink' });
      slide.addText(r.status.toUpperCase(), { x: 10.26, y: y + 0.22, w: 2.08, h: 0.3, fontSize: 10, bold: true, color: r.status === 'supported' ? COLOR.blue : COLOR.amber, align: 'right', margin: 0 });
    });
  }
  const references = p.requirements.flatMap(r => r.evidence.map(e => ({ ...e, requirement: r.id })));
  for (let i = 0; i < references.length; i += 4) {
    slide = pptx.addSlide(); header(slide, `Internal evidence ${Math.floor(i / 4) + 1}`, ++number);
    references.slice(i, i + 4).forEach((e, j) => {
      const y = 1.53 + j * 1.29;
      slide.addText(`${e.requirement}  ${e.title}`, { x: 0.78, y, w: 11.6, h: 0.28, fontSize: 13, bold: true, color: COLOR.blue, margin: 0 });
      slide.addText(e.quote, { x: 0.78, y: y + 0.33, w: 11.6, h: 0.55, fontSize: 12, color: COLOR.ink, margin: 0.02, autoFit: 'shrink' });
      slide.addText(e.path, { x: 0.78, y: y + 0.92, w: 11.6, h: 0.2, fontSize: 8, color: COLOR.muted, margin: 0 });
    });
  }
  for (let i = 0; i < p.research_claims.length; i += 4) {
    slide = pptx.addSlide(); header(slide, `Cited public research ${Math.floor(i / 4) + 1}`, ++number);
    p.research_claims.slice(i, i + 4).forEach((c, j) => {
      const y = 1.53 + j * 1.29;
      slide.addText(c.claim, { x: 0.78, y, w: 11.6, h: 0.57, fontSize: 13, color: COLOR.ink, margin: 0.02, autoFit: 'shrink' });
      slide.addText(c.url, { x: 0.78, y: y + 0.68, w: 11.6, h: 0.32, fontSize: 9, color: COLOR.blue, margin: 0.02, autoFit: 'shrink' });
    });
  }
  slide = pptx.addSlide(); header(slide, 'Review and next steps', ++number);
  body(slide, 'Review the requirement judgments and linked source excerpts before sharing this proposal. Confirm delivery scope, availability, schedule, and commercial terms with the responsible team.', 1.75, 2.9, 21);
  body(slide, `Lead ${p.lead_id}  •  Job ${p.job_id}`, 6.2, 0.3, 9);
  const bytes = Buffer.from(await pptx.write({ outputType: 'nodebuffer' }));
  if (bytes.length < 1000 || bytes.subarray(0, 2).toString() !== 'PK') throw new Error('Invalid PPTX export');
  return { bytes, sha256: createHash('sha256').update(bytes).digest('hex'), mime_type: MIME_PPTX, slide_count: number };
}
