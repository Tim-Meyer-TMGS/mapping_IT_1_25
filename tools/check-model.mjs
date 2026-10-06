import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { loadData, parseCsv } from '../assets/js/data.js';
import { inferFieldType, buildFieldDefinitions } from './build-field-types.mjs';
import { createSpecification } from '../assets/js/model.js';
import { render } from '../assets/js/views.js';
import { fieldsForType, rulesForType, filterRules, searchCatalog, enrichData, fieldKey } from '../assets/js/catalog.js';
import { readState, withOrigin, originState } from '../assets/js/router.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
globalThis.window = { location: { search: '' } };
const fetched = [];
globalThis.fetch = async url => {
  fetched.push(url);
  const content = await readFile(path.resolve(root, url), 'utf8');
  return { ok: true, json: async () => JSON.parse(content), text: async () => content };
};
const data = await loadData();
assert.deepEqual(fetched.sort(), ['./data/field-definitions.json', './data/mapping-hub-authoritative.json']);
const originalFields = parseCsv(await readFile(path.join(root, 'data/satourn-observed-fields.csv'), 'utf8'));
assert.deepEqual(data.fields.map(({ group, ...field }) => field), buildFieldDefinitions(originalFields));
assert.equal(data.fields.length, 1375);
assert.equal(fieldsForType(data, 'poi').length, 307);
assert.equal(data.rules.length, 916);
assert.equal(rulesForType(data, 'poi').length, 503);

for (const [examples, expected] of [['true || false', 'boolean'], ['0 || 1', 'integer'], ['1 || -2.5', 'decimal'], ['1.2e3 || 2', 'double'], ['2024-02-29', 'date'], ['2023-02-29', 'string'], ['2026-10-01T12:30:00Z', 'dateTime'], ['https://example.org/', 'anyURI'], ['01234', 'string']]) {
  assert.equal(inferFieldType({ field: 'Example', examples }).datatype?.split('#')[1], expected);
}
assert.equal(inferFieldType({ field: 'Example', examples: '' }).status, 'unknown');
assert.equal(inferFieldType({ field: 'Example', examples: 'true || 123' }).status, 'mixed');
assert.equal(inferFieldType({ field: 'CONTACT_PHONE', examples: '123456' }).datatype?.split('#')[1], 'string');

const overview = render(data, { type: 'poi' });
assert.ok(overview.includes('307 verfügbare Felder') && overview.includes('503 aktive Mappingregeln'));
assert.ok(!overview.includes('mapping-table') && !overview.includes('technical-details'));
for (const [query, expected] of [['öffnung', 'OBJECT_OEFFNUNGSZEITEN'], ['price', 'PRICE_ADULT'], ['contact', 'OBJECT_CONTACT_EMAIL'], ['Kategorie', 'Kategorie']]) {
  assert.ok(fieldsForType(data, 'poi', { filter: query }).some(field => field.field === expected));
}
assert.ok(searchCatalog(data, 'OBJECT_CONTACT_EMAIL').fields.some(field => field.datasetType === 'poi'));
const riding = searchCatalog(data, 'Reiten');
assert.ok(riding.values.some(value => value.type === 'poi' && value.field === 'Kategorie'));
const rule = riding.rules.find(rule => rule.source.system === 'outdooractive' && rule.source.datasetType === 'poi' && rule.source.value === 'Reiten');
assert.ok(rule);
assert.deepEqual(filterRules(data, rulesForType(data, 'poi'), { system: 'outdooractive', dimension: 'category', source: 'Reiten', target: 'Reiten', field: 'Kategorie' }).map(rule => rule.id), [rule.id]);
const list = render(data, { type: 'poi', view: 'mapping' });
assert.ok(list.includes('Zielfeld · SaTourN') && list.includes('mapping-table'));
assert.ok(!list.includes('at least one POI') && !list.includes('AH67-T366'));
const detail = render(data, { type: 'poi', view: 'mapping', term: rule.id });
assert.ok(detail.includes('<h2>Quelle</h2>') && detail.includes('<h2>Ziel</h2>'));
assert.ok(detail.includes('view=fields&amp;field=Kategorie'));
assert.ok(detail.includes('<details class="technical-details">') && !detail.includes('<details class="technical-details" open'));
assert.ok(detail.indexOf('AH67-T366') > detail.indexOf('<details class="technical-details">'));
const fieldDetail = render(data, { type: 'poi', view: 'fields', field: 'Kategorie' });
assert.ok(fieldDetail.includes('Eingehende Mappings') && fieldDetail.includes('valueFilter') && fieldDetail.includes('view=mapping&amp;field=Kategorie'));
assert.ok(fieldsForType(data, 'poi')[0].group.id === 'base');
assert.ok(!list.includes('class="advanced-filters" open'));
assert.ok(render(data, { type: 'poi', view: 'mapping', source: 'Reiten' }).includes('class="advanced-filters" open'));
const guided = render(data, { view: 'guide', system: 'outdooractive', source: 'Reiten', type: 'poi' });
assert.ok(guided.includes('<h2>Zuordnung</h2>') && guided.includes('Kategorie'));
assert.ok(render(data, { view: 'guide', source: 'not-a-real-value-923' }).includes('Keine Regel gefunden'));
assert.ok(render(data, { view: 'guide', source: 'Reit' }).includes('Keine Regel gefunden'));
const ambiguous = data.rules.find(rule => rule.ruleKind === 'mapping' && new Set(data.rules.filter(other => other.ruleKind === 'mapping' && other.source.value === rule.source.value).map(other => other.target?.datasetType ?? other.source.datasetType)).size > 1);
assert.ok(ambiguous);
assert.ok(render(data, { view: 'guide', source: ambiguous.source.value }).includes('Datensatzart auswählen'));
const multiple = data.rules.find(rule => rule.ruleKind === 'mapping' && rule.oneToMany);
assert.ok(render(data, { view: 'guide', system: multiple.source.system, source: multiple.source.value, type: multiple.target?.datasetType ?? multiple.source.datasetType }).includes('Alle Zielwerte werden gesetzt'));
for (const behavior of ['noImport', 'noTarget']) {
  const special = data.rules.find(rule => rule.ruleKind === 'mapping' && rule.behavior === behavior);
  assert.ok(render(data, { view: 'guide', system: special.source.system, source: special.source.value, type: special.target?.datasetType ?? special.source.datasetType }).includes(behavior === 'noImport' ? 'Nicht importieren' : 'Kein Zielwert'));
}
assert.ok(render(data, { type: 'poi', view: 'fields', field: 'Kategorie', valueFilter: 'Reiten', ruleFilter: 'Reiten' }).includes('Reiten'));
const selection = { type: 'poi', view: 'mapping', system: 'outdooractive', source: 'Reiten', page: '2' };
const ruleSelection = withOrigin({ type: 'poi', view: 'mapping', term: rule.id }, selection);
const fieldSelection = withOrigin({ type: 'poi', view: 'fields', field: 'Kategorie' }, ruleSelection);
assert.deepEqual(originState(ruleSelection), selection);
assert.deepEqual(originState(fieldSelection), selection);
assert.equal(fieldSelection.from, ruleSelection.from, 'Origin must not grow when navigating details');
assert.ok(render(data, ruleSelection).includes('Zurück zur Auswahl'));
assert.deepEqual(originState({ from: 'https://example.com/?redirect=evil' }), null);

// Every rule and every field remains directly reachable, including non-imports.
for (const rule of data.rules) assert.ok(render(data, { type: rule.target?.datasetType ?? rule.source?.datasetType, view: 'mapping', term: rule.id }).includes(rule.id));
for (const field of data.fields) {
  assert.ok(field.group.id);
  assert.ok(render(data, { type: field.datasetType, view: 'fields', field: field.field }).includes('Technische Informationen'));
}
for (const type of data.datasetTypes) {
  for (const view of [undefined, 'fields', 'model', 'structure', 'mapping', 'routing', 'fallback']) assert.ok(render(data, { type: type.id, view }));
}
for (const [file, type] of [['poi.html', 'poi'], ['events.html', 'event'], ['gastro.html', 'gastro'], ['tour.html', 'tour'], ['package.html', 'package'], ['vermieter.html', 'accommodation'], ['artikel.md', 'article']]) {
  const redirect = await readFile(path.join(root, file), 'utf8');
  assert.ok(redirect.includes(`location.replace('./index.html?type=${type}')`));
  assert.ok(!redirect.includes('direction=inbound'));
}
for (const view of ['model', 'structure']) {
  window.location.search = `?type=poi&view=${view}&field=Kategorie`;
  assert.equal(readState().view, 'fields');
}
window.location.search = '?type=poi&direction=inbound&property=feature';
assert.equal(readState().view, 'mapping');
assert.equal(readState().dimension, 'feature');
window.location.search = '';

const spec = createSpecification(data);
assert.equal(spec['@graph'].length, 8);
assert.equal(spec['@graph'].reduce((n, node) => n + node['sh:property'].length, 0), data.fields.length);
assert.equal(new Set(spec['@graph'].flatMap(node => node['hub:rules'].map(rule => rule.id))).size, 916);
assert.ok(!JSON.stringify(spec).includes('"sh:datatype"') && !JSON.stringify(spec).includes('"sh:minCount"'));
const sentinel = 'TEST_VALUE_MUST_NOT_APPEAR_987654321';
const contaminated = enrichData({ ...data, fields: data.fields.map(field => ({ ...field, examples: sentinel })), vocabularies: [{ datasetType: 'poi', field: 'Kategorie', value: sentinel }] });
assert.ok(!JSON.stringify(createSpecification(contaminated)).includes(sentinel));
assert.ok(!JSON.stringify(searchCatalog(contaminated, sentinel)).includes(sentinel));
assert.ok(!render(contaminated, { view: 'guide' }).includes(sentinel));
for (const type of data.datasetTypes) for (const view of ['fields', 'structure', 'mapping']) assert.ok(!render(contaminated, { type: type.id, view }).includes(sentinel));
const malicious = enrichData({ ...data, fields: [{ ...data.fields[0], datasetType: 'poi', field: '<script>alert(1)</script>' }] });
assert.ok(!render(malicious, { type: 'poi', view: 'fields' }).includes('<script>'));
for (const entry of data.valueEntries) for (const id of entry.ruleIds) {
  const rule = data.rulesById.get(id);
  assert.equal(fieldKey(rule.target.datasetType, rule.target.field), fieldKey(entry.type, entry.field));
  assert.ok(rule.target.values.includes(entry.value));
}
console.log('OK: 8 types, 1375 fields, 916 rules; overview, grouping, filters, global search, all deep links, export, no sample values.');

const browser = process.argv[2];
if (browser) {
  let scenario = 'interactive';
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      const filename = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!filename.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
      let content = await readFile(filename);
      if (filename.endsWith('index.html')) content = content.toString().replace('</body>', `<script>globalThis.hubTestScenario = ${JSON.stringify(scenario)};</script><script type="module" src="./tools/browser-harness.js"></script></body>`);
      const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' }[path.extname(filename)] ?? 'text/plain';
      response.writeHead(200, { 'Content-Type': `${mime}; charset=utf-8` }); response.end(content);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const artifacts = await mkdtemp(path.join(tmpdir(), 'satourn-ui-check-'));
  try {
    const cases = [
      ['desktop', '1365,900', '/index.html', 'interactive'],
      ['mobile', '500,844', '/index.html', 'interactive'],
      ['field-deep-link', '1365,900', '/index.html?type=poi&view=model&field=Kategorie', 'field'],
      ['guide-desktop', '1365,900', '/index.html?view=guide&system=outdooractive&source=Reiten&type=poi', 'guide'],
      ['guide-mobile', '500,844', '/index.html?view=guide&system=outdooractive&source=Reiten&type=poi', 'guide'],
      ['rule-deep-link', '1365,900', `/index.html?type=poi&direction=inbound&term=${rule.id}`, 'rule'],
      ['poi-redirect', '1365,900', '/poi.html', 'overview'],
    ];
    for (const [name, size, url, mode] of cases) {
      scenario = mode;
      const output = await new Promise((resolve, reject) => {
        const child = spawn(browser, ['--headless', '--disable-gpu', '--no-first-run', '--disable-background-networking', `--user-data-dir=${path.join(artifacts, name)}`, `--window-size=${size}`, '--dump-dom', '--virtual-time-budget=15000', `--screenshot=${path.join(artifacts, `${name}.png`)}`, `http://127.0.0.1:${server.address().port}${url}`], { windowsHide: true });
        let stdout = '', stderr = '';
        child.stdout.on('data', chunk => stdout += chunk);
        child.stderr.on('data', chunk => stderr += chunk);
        child.on('error', reject);
        const timer = setTimeout(() => { child.kill(); reject(Error('Browser test timed out')); }, 45000);
        child.on('close', code => { clearTimeout(timer); code === 0 ? resolve(stdout) : reject(Error(stderr)); });
      });
      assert.ok(output.includes('data-browser-test="passed"'), output.match(/data-browser-test="[^"]*"/)?.[0] ?? 'Browser did not finish tests');
      console.log(`OK: ${name} (${mode === 'interactive' ? 'scenarios A–H, Back/Forward, filters, no JS errors/overflow' : 'cold start'}).`);
    }
    console.log(`Screenshots: ${artifacts}`);
  } finally { server.close(); }
}
