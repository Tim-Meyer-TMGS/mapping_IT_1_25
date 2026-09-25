import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputPath = path.resolve(root, process.argv[2] ?? 'source/Mappingbestand_Extraktion_Arbeitsstand_2026-09-24.json');
const outputDir = path.resolve(root, process.argv[3] ?? 'data');
const sourceFile = 'Mappingübersicht Fremdsysteme.docx';

const systemIds = new Map([
  ['Bookingkit', 'bookingkit'],
  ['DAMAS', 'damas'],
  ['Feratel', 'feratel'],
  ['Outdooractive', 'outdooractive'],
  ['Regiondo', 'regiondo'],
  ['TIS POI', 'tis-poi'],
  ['TIS Event', 'tis-event'],
  ['TIS Gastro', 'tis-gastro'],
  ['TIS Unterkünfte', 'tis-unterkuenfte'],
]);

const inferredSourceTypes = new Map([
  ['Bookingkit', 'Package'],
  ['TIS POI', 'POI'],
  ['TIS Event', 'event'],
  ['TIS Gastro', 'Gastro'],
  ['TIS Unterkünfte', 'Hotel'],
]);

const canonicalDatasetTypes = new Map([
  ['hotel', 'accommodation'],
  ['gastro', 'gastro'],
  ['poi', 'poi'],
  ['tour', 'tour'],
  ['event', 'event'],
  ['package', 'package'],
  ['_feratel_erlebnisse', 'package'],
]);

function valueOrNull(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function slug(value) {
  return String(value ?? 'unknown')
    .toLowerCase()
    .replace(/[äáàâãå]/g, 'a')
    .replace(/[öóòôõ]/g, 'o')
    .replace(/[üúùû]/g, 'u')
    .replace(/[éèêë]/g, 'e')
    .replace(/[íìîï]/g, 'i')
    .replace(/[çč]/g, 'c')
    .replace(/š/g, 's')
    .replace(/ž/g, 'z')
    .replace(/[ýÿ]/g, 'y')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown';
}

function shortHash(value) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash * 33) ^ value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function dimensionFor(row) {
  if (row.record_kind === 'feature' || row.group_kind === 'FeatureMapping') return 'feature';
  if (row.record_kind === 'category' || row.group_kind === 'CategoryMapping') return 'category';
  if (row.record_kind === 'mapping') return 'category';
  return 'other';
}

function sourceDatasetTypeFor(row) {
  return valueOrNull(row.context) ?? valueOrNull(row.type) ?? inferredSourceTypes.get(row.system) ?? null;
}

function targetDatasetTypeFor(sourceDatasetType) {
  return canonicalDatasetTypes.get(String(sourceDatasetType ?? '').toLowerCase()) ?? null;
}

function keyTypeFor(system) {
  return system === 'Outdooractive' || system === 'DAMAS' ? 'name' : 'unknown';
}

function behaviorFor(row) {
  if (row.quality_flag === 'no_import' || row.target_value?.endsWith('-no-import')) return 'noImport';
  if (!row.target_value) return 'noTarget';
  return 'map';
}

function endpoint({ system, datasetType, dimension, label, language, keyType = 'unknown' }) {
  return {
    system,
    datasetType: datasetType ?? null,
    dimension,
    keyType,
    key: null,
    label: label ?? null,
    language: language ?? null,
  };
}

function groupSignature(row) {
  const sourceDatasetType = sourceDatasetTypeFor(row);
  return JSON.stringify([
    systemIds.get(row.system), sourceDatasetType, dimensionFor(row), row.source_value,
    valueOrNull(row.market), valueOrNull(row.group_kind), valueOrNull(row.type), behaviorFor(row),
  ]);
}

function mappingId(prefix, signature, source) {
  const parts = [prefix, source.system, source.datasetType, source.dimension, source.label, source.language]
    .filter(Boolean).map(slug);
  return `${parts.join('-')}-${shortHash(signature)}`;
}

function unique(values) {
  return [...new Set(values)];
}

function noteFor(behavior, targetCount) {
  if (behavior === 'noTarget') return 'Im gelieferten Mappingstand ist für diesen Quellwert kein Ziel hinterlegt.';
  if (behavior === 'noImport') return 'Expliziter Sonderfall: Dieser Wert wird nicht übernommen.';
  if (behavior === 'fallback') return 'Fallbackregel aus der gelieferten Mappingquelle.';
  if (targetCount > 1) return 'Alle aufgeführten SaTourN-Werte werden gleichzeitig gesetzt.';
  return null;
}

const extraction = JSON.parse(await readFile(inputPath, 'utf8'));
const activeRows = extraction.records.filter((row) => row.status === 'active');
const groups = new Map();

for (const row of activeRows) {
  if (!systemIds.has(row.system)) throw new Error(`Unbekanntes System in Zeile ${row.line}: ${row.system}`);
  const signature = groupSignature(row);
  if (!groups.has(signature)) groups.set(signature, []);
  groups.get(signature).push(row);
}

const mappings = [];
for (const [signature, rows] of groups) {
  const first = rows[0];
  const system = systemIds.get(first.system);
  const dimension = dimensionFor(first);
  const datasetType = sourceDatasetTypeFor(first);
  const language = valueOrNull(first.market);
  const behavior = behaviorFor(first);
  const source = endpoint({ system, datasetType, dimension, label: first.source_value, language, keyType: keyTypeFor(first.system) });
  const targetLabels = behavior === 'map' ? unique(rows.map((row) => row.target_value).filter(Boolean)) : [];
  const targets = targetLabels.map((label) => endpoint({
    system: 'satourn', datasetType: targetDatasetTypeFor(datasetType), dimension, label, language,
  }));
  const rawLines = unique(rows.map((row) => row.raw).filter(Boolean));
  const sourceLines = unique(rows.map((row) => row.line).filter(Number.isInteger)).sort((a, b) => a - b);

  mappings.push({
    id: mappingId('map-inbound', signature, source),
    direction: 'inbound',
    source,
    targets,
    behavior,
    display: {
      note: noteFor(behavior, targets.length),
      noticeIds: system === 'outdooractive' ? ['oa-language-open-question', 'oa-keyword-assumption'] : [],
    },
    provenance: { sourceFile, sourceLine: sourceLines[0] ?? null, raw: rawLines.join('\n') || null },
  });
}

for (const fallback of extraction.fallbacks.filter((item) => item.status === 'active')) {
  const system = systemIds.get(fallback.system);
  if (!system) throw new Error(`Unbekanntes Fallback-System in Zeile ${fallback.line}: ${fallback.system}`);
  const datasetType = valueOrNull(fallback.context) ?? inferredSourceTypes.get(fallback.system) ?? null;
  const dimension = fallback.group_kind === 'FeatureMapping' ? 'feature' : 'category';
  const language = valueOrNull(fallback.group_attrs?.Mkt);
  const signature = JSON.stringify(['fallback', system, datasetType, dimension, language, String(fallback.line), fallback.value]);
  const source = endpoint({ system, datasetType, dimension, label: 'Fallback', language });
  const targets = fallback.value ? [endpoint({
    system: 'satourn', datasetType: targetDatasetTypeFor(datasetType), dimension, label: fallback.value, language,
  })] : [];
  mappings.push({
    id: mappingId('fallback-inbound', signature, source),
    direction: 'inbound', source, targets, behavior: 'fallback',
    display: { note: noteFor('fallback', targets.length), noticeIds: [] },
    provenance: { sourceFile, sourceLine: fallback.line ?? null, raw: fallback.raw || null },
  });
}

mappings.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

const systems = [
  { id: 'outdooractive', label: 'Outdooractive', direction: 'inbound', sortOrder: 10 },
  { id: 'feratel', label: 'Feratel', direction: 'inbound', sortOrder: 20 },
  { id: 'damas', label: 'DAMAS', direction: 'inbound', sortOrder: 30 },
  { id: 'bookingkit', label: 'Bookingkit', direction: 'inbound', sortOrder: 40 },
  { id: 'regiondo', label: 'Regiondo', direction: 'inbound', sortOrder: 50 },
  { id: 'tis-poi', label: 'TIS POI', direction: 'inbound', sortOrder: 60 },
  { id: 'tis-event', label: 'TIS Event', direction: 'inbound', sortOrder: 61 },
  { id: 'tis-gastro', label: 'TIS Gastro', direction: 'inbound', sortOrder: 62 },
  { id: 'tis-unterkuenfte', label: 'TIS Unterkünfte', direction: 'inbound', sortOrder: 63 },
  { id: 'satourn', label: 'SaTourN', direction: null, sortOrder: 90 },
  { id: 'odta', label: 'ODTA', direction: 'outbound', sortOrder: 100 },
];

const datasetTypes = [
  { id: 'tour', label: 'Touren', sourceAliases: ['Tour', 'tour'] },
  { id: 'poi', label: 'POI', sourceAliases: ['POI', 'Poi'] },
  { id: 'gastro', label: 'Gastronomie', sourceAliases: ['Gastro'] },
  { id: 'event', label: 'Veranstaltungen', sourceAliases: ['event'] },
  { id: 'accommodation', label: 'Unterkünfte', sourceAliases: ['Hotel'] },
  { id: 'package', label: 'Angebote', sourceAliases: ['Package', '_feratel_Erlebnisse'] },
];

const notices = [
  {
    id: 'oa-language-open-question', scope: { system: 'outdooractive', datasetType: 'Tour' }, status: 'open',
    title: 'Sprachabhängigkeit prüfen',
    text: 'Bei einzelnen fremdsprachigen Touren wurde beobachtet, dass keine SaTourN-Kategorie ankommt. Ein Zusammenhang mit sprachabhängigen Outdooractive-Kategoriebezeichnungen ist plausibel, aber nicht verifiziert.',
  },
  {
    id: 'oa-keyword-assumption', scope: { system: 'outdooractive', datasetType: null }, status: 'assumption',
    title: 'Keyword-Fallback noch nicht verifiziert',
    text: 'Nicht gemappte Outdooractive-Merkmale können als Keywords ankommen. Dies ist eine Arbeitsannahme und keine verbindliche Mappingregel.',
  },
  {
    id: 'odta-mappings-missing', scope: { system: 'odta', datasetType: null }, status: 'open',
    title: 'ODTA-Zuordnungen fehlen in der gelieferten Extraktion',
    text: 'Die vorhandene ODTA-Seite enthält einen Wertekatalog, aber die gelieferte Extraktion enthält keine belastbaren SaTourN-zu-ODTA-Zuordnungen. Es wurden daher keine Exportregeln erzeugt.',
  },
];

const sourceCategories = extraction.source_categories.filter((item) => item.status === 'active').map((item) => ({
  system: systemIds.get(item.system) ?? slug(item.system),
  sourceLine: item.line ?? null,
  categoryFamily: valueOrNull(item.category_family),
  sourceValue: valueOrNull(item.source_value),
  context: valueOrNull(item.context),
  note: valueOrNull(item.note),
}));

const sourceStats = {
  extractedRows: extraction.records.length,
  activeRows: activeRows.length,
  commentedRowsExcluded: extraction.records.length - activeRows.length,
  productiveRules: mappings.length,
  oneToManyRules: mappings.filter((mapping) => mapping.targets.length > 1).length,
  noTargetRules: mappings.filter((mapping) => mapping.behavior === 'noTarget').length,
  noImportRules: mappings.filter((mapping) => mapping.behavior === 'noImport').length,
  fallbackRules: mappings.filter((mapping) => mapping.behavior === 'fallback').length,
  outboundRules: mappings.filter((mapping) => mapping.direction === 'outbound').length,
};

const meta = {
  title: 'SaTourN Mapping Hub', status: 'current-standard', sourceName: sourceFile,
  sourceDate: '2026-09-24', generatedAt: '2026-09-25',
  note: 'Statische Arbeitsgrundlage für den Hub. ODTA-Exportregeln sind in der gelieferten Extraktion nicht enthalten.',
  sourceStats,
};

await mkdir(outputDir, { recursive: true });
const outputs = new Map([
  ['meta.json', meta], ['systems.json', systems], ['dataset-types.json', datasetTypes],
  ['mappings.json', mappings], ['notices.json', notices], ['source-categories.json', sourceCategories],
]);
for (const [name, data] of outputs) {
  await writeFile(path.join(outputDir, name), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

console.log(`Erzeugt: ${mappings.length} Regeln aus ${activeRows.length} aktiven Zeilen.`);
console.log(JSON.stringify(sourceStats, null, 2));
