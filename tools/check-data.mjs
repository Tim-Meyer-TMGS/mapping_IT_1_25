import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.resolve(root, process.argv[2] ?? 'data');
const readJson = async (name) => JSON.parse(await readFile(path.join(dataDir, name), 'utf8'));
const [meta, systems, datasetTypes, mappings, notices] = await Promise.all([
  readJson('meta.json'), readJson('systems.json'), readJson('dataset-types.json'),
  readJson('mappings.json'), readJson('notices.json'),
]);

const errors = [];
const allowedDirections = new Set(['inbound', 'outbound']);
const allowedDimensions = new Set(['category', 'feature', 'field', 'textField', 'checkbox', 'value', 'other']);
const allowedBehaviors = new Set(['map', 'noTarget', 'noImport', 'fallback', 'passthrough', 'unknown']);
const allowedKeyTypes = new Set(['id', 'name', 'code', 'unknown', null]);
const systemIds = new Set(systems.map((system) => system.id));
const noticeIds = new Set(notices.map((notice) => notice.id));
const ids = new Set();
const fail = (message) => errors.push(message);

function checkNoEmptyStrings(value, location) {
  if (value === '') fail(`${location}: leerer String statt null`);
  if (Array.isArray(value)) value.forEach((item, index) => checkNoEmptyStrings(item, `${location}[${index}]`));
  else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => checkNoEmptyStrings(item, `${location}.${key}`));
  }
}

function checkEndpoint(endpoint, location) {
  if (!endpoint || typeof endpoint !== 'object') return fail(`${location}: Endpoint fehlt`);
  if (!systemIds.has(endpoint.system)) fail(`${location}: unbekanntes System ${endpoint.system}`);
  if (!allowedDimensions.has(endpoint.dimension)) fail(`${location}: ungültige Dimension ${endpoint.dimension}`);
  if (!allowedKeyTypes.has(endpoint.keyType)) fail(`${location}: ungültiger keyType ${endpoint.keyType}`);
  if (!endpoint.label && !endpoint.key) fail(`${location}: Label und Key fehlen`);
}

for (const [index, mapping] of mappings.entries()) {
  const location = `mappings[${index}] (${mapping.id ?? 'ohne ID'})`;
  if (!mapping.id) fail(`${location}: ID fehlt`);
  else if (ids.has(mapping.id)) fail(`${location}: doppelte ID`);
  else ids.add(mapping.id);
  if (!allowedDirections.has(mapping.direction)) fail(`${location}: ungültige direction ${mapping.direction}`);
  if (!allowedBehaviors.has(mapping.behavior)) fail(`${location}: ungültiges behavior ${mapping.behavior}`);
  checkEndpoint(mapping.source, `${location}.source`);
  if (!Array.isArray(mapping.targets)) fail(`${location}: targets ist kein Array`);
  else mapping.targets.forEach((target, targetIndex) => checkEndpoint(target, `${location}.targets[${targetIndex}]`));
  if (mapping.behavior === 'map' && mapping.targets.length === 0) fail(`${location}: map ohne Target`);
  if (['noTarget', 'noImport'].includes(mapping.behavior) && mapping.targets.length !== 0) fail(`${location}: ${mapping.behavior} darf keine Targets haben`);
  if (mapping.targets.some((target) => /todo/i.test(target.label ?? '') || /todo/i.test(target.key ?? ''))) fail(`${location}: aktives todo-Target`);
  for (const noticeId of mapping.display?.noticeIds ?? []) {
    if (!noticeIds.has(noticeId)) fail(`${location}: unbekannter Hinweis ${noticeId}`);
  }
  checkNoEmptyStrings(mapping, location);
}

if (meta.status !== 'current-standard') fail('meta.status muss current-standard sein');
if (meta.sourceStats?.commentedRowsExcluded !== 9) fail('Erwartet werden 9 ausgeschlossene Kommentarzeilen');
if (meta.sourceStats?.activeRows !== 982) fail('Erwartet werden 982 aktive Extraktionszeilen');
if (!mappings.some((mapping) => mapping.targets.length > 1)) fail('Keine 1:n-Regel vorhanden');
if (!mappings.some((mapping) => mapping.source.language === 'en')) fail('Explizite Sprache en fehlt');
if (!mappings.some((mapping) => mapping.source.language === 'de')) fail('Explizite Sprache de fehlt');
if (!datasetTypes.length) fail('Datensatzartenkatalog ist leer');
checkNoEmptyStrings(meta, 'meta');
checkNoEmptyStrings(systems, 'systems');
checkNoEmptyStrings(datasetTypes, 'datasetTypes');
checkNoEmptyStrings(notices, 'notices');

if (errors.length) {
  console.error(`Datenprüfung fehlgeschlagen (${errors.length} Fehler):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`Datenprüfung erfolgreich: ${mappings.length} Regeln, ${ids.size} eindeutige IDs.`);
  console.log(`1:n: ${mappings.filter((mapping) => mapping.targets.length > 1).length}; noTarget: ${mappings.filter((mapping) => mapping.behavior === 'noTarget').length}; noImport: ${mappings.filter((mapping) => mapping.behavior === 'noImport').length}; Fallback: ${mappings.filter((mapping) => mapping.behavior === 'fallback').length}.`);
}
