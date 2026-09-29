import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { renderBundle } from './service.js';

const id = '11111111-1111-4111-8111-111111111111';
const fixture = () => ({ job_id: id, lead_id: id, proposal: {
  title: 'Plateforme de données', organization: 'Acheteur exemple',
  summary: 'Créer une plateforme de données avec une traçabilité des exigences.',
  requirements: [{ id: 'R-01', label: 'Intégration GCP Snowflake', status: 'supported', evidence: [{ title: 'Entrepôt analytique', source_path: 'project/1/projet_13.txt', quote: 'GCP Snowflake Terraform Airflow warehouse' }] }],
  research_claims: [],
} });

test('renders an editable PPTX archive and readable PDF with expected pages', async () => {
  const result = await renderBundle(fixture());
  assert.deepEqual(result.files.map(f => f.kind), ['pptx', 'pdf']);
  const pptx = Buffer.from(result.files[0].base64, 'base64');
  const pdf = Buffer.from(result.files[1].base64, 'base64');
  assert.equal(pptx.length, result.files[0].size_bytes);
  assert.equal(pdf.length, result.files[1].size_bytes);
  assert.equal(pptx.subarray(0, 2).toString(), 'PK');
  const archive = await JSZip.loadAsync(pptx, { checkCRC32: true });
  assert.ok(archive.file('ppt/presentation.xml'));
  assert.ok(archive.file('ppt/slides/slide1.xml'));
  const parsed = await PDFDocument.load(pdf);
  assert.equal(parsed.getPageCount(), result.page_count);
  assert.ok(parsed.getPageCount() >= 4);
});

test('rejects unresolved tags and unsupported cited claims', async () => {
  const tag = fixture(); tag.proposal.title = '{{TITLE}}';
  await assert.rejects(renderBundle(tag), /Invalid title/);
  const claim = fixture(); claim.proposal.research_claims = [{ url: 'https://example.com/source', excerpt: 'A verified public excerpt about a different topic.', claim: 'Revenue is EUR 10 million' }];
  await assert.rejects(renderBundle(claim), /Claim lacks exact citation/);
});
