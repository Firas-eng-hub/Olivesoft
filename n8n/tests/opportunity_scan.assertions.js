const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const workflow = JSON.parse(fs.readFileSync(path.join(__dirname, '../workflows/14_opportunity_scan.json'), 'utf8'));
const node = (name) => workflow.nodes.find((item) => item.name === name);
const run = (name, env) => {
  const keys = Object.keys(env);
  return new Function(...keys, node(name).parameters.jsCode)(...keys.map((key) => env[key]));
};

const tedPage = { notices: [{
  'publication-number': '2026-12345',
  'notice-title': { eng: 'Cloud integration services' },
  'buyer-name': { eng: 'Example Authority' },
  'description-lot': { eng: 'Build secure API integrations. Deliver data platform support.' },
  'deadline-receipt-tender-date-lot': '2026-11-01',
  'publication-date': '2026-10-01',
}] };
const ted = run('Map TED candidates', { $input: { all: () => [{ json: tedPage }] } });
assert.equal(ted.length, 1);
assert.equal(ted[0].json.source, 'ted');
const secondPage = { notices: [{ ...tedPage.notices[0], 'publication-number': '2026-12346' }] };
const pagedTed = run('Map TED candidates', { $input: { all: () => [{ json: tedPage }, { json: secondPage }] } });
assert.deepEqual(pagedTed.map((item) => item.json.external_id), ['2026-12345', '2026-12346']);
assert.deepEqual(pagedTed.map((item) => item.pairedItem.item), [0, 1]);
const multiLotPage = { notices: [{
  ...tedPage.notices[0],
  'description-lot': { eng: ['Build secure API integrations.', 'Deliver data platform support.'] },
  'deadline-receipt-tender-date-lot': ['2026-11-01+01:00', '2026-12-01+01:00'],
}] };
const multiLot = run('Map TED candidates', { $input: { all: () => [{ json: multiLotPage }] } });
assert.match(multiLot[0].json.source_text, /Build secure API integrations/);
assert.match(multiLot[0].json.source_text, /Deliver data platform support/);
assert.equal(multiLot[0].json.ambiguous_deadline, true);
assert.equal(multiLot[0].json.deadline, null);
const sameDeadline = run('Map TED candidates', { $input: { all: () => [{ json: {
  notices: [{ ...multiLotPage.notices[0], 'deadline-receipt-tender-date-lot': ['2026-11-01+01:00', '2026-11-01+02:00'] }],
} }] } });
assert.equal(sameDeadline[0].json.deadline, '2026-11-01');
const noTed = run('Map TED candidates', { $input: { all: () => [{ json: { error: 'provider unavailable' } }] } });
assert.equal(noTed[0].json.skip, true);
const noTavily = run('Map Tavily candidates', { $input: { all: () => [{ json: { error: 'provider unavailable' } }] } });
assert.equal(noTavily[0].json.skip, true);
const tavily = run('Map Tavily candidates', { $input: { all: () => [{ json: { results: [{
  url: 'https://example.org/opportunity?utm_source=scan',
  title: 'IT services opportunity', content: 'Open public procurement notice.',
  raw_content: 'Example Authority requests secure API integrations. Submission deadline: 2026-11-02.',
}] } }] } });
assert.equal(tavily[0].json.source_url, 'https://example.org/opportunity');
assert.match(tavily[0].json.source_text, /secure API integrations/);
const combined = run('Normalize candidate', { $input: { all: () => [noTed[0], ted[0]] } });
assert.equal(combined.length, 1);
assert.equal(combined[0].json.source, 'ted');
const model = [{ json: { output: { organization: 'Example Authority', deadline: '2026-11-01', requirements: [
  'Build secure API integrations', 'Invented certification requirement',
] } } }];
const validated = run('Validate source quotes', {
  $input: { all: () => model },
  $: () => ({ all: () => combined }),
});
assert.deepEqual(validated[0].json.requirements, ['Build secure API integrations']);
assert.equal(validated[0].json.deadline, '2026-11-01');
assert.equal(validated[0].json.extraction_evidence.length, 1);
const ambiguous = run('Validate source quotes', {
  $input: { all: () => model },
  $: () => ({ all: () => multiLot }),
});
assert.equal(ambiguous[0].json.deadline, null);
console.log('Opportunity scan assertions passed');
