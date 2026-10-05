import { enrichData } from './catalog.js';

const FILES = {
  hub: './data/mapping-hub-authoritative.json',
  fields: './data/field-definitions.json',
};

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

export function parseCsv(text) {
  text = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], value = '', quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { row.push(value); value = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value); rows.push(row); row = []; value = '';
    } else value += character;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  const [headers, ...values] = rows;
  return values.filter((entry) => entry.length === headers.length).map((entry) => Object.fromEntries(headers.map((header, index) => [header, entry[index]])));
}

export function fold(value) {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('de');
}

export async function loadData() {
  const [hub, fields] = await Promise.all([
    fetchJson(FILES.hub), fetchJson(FILES.fields),
  ]);
  const rules = hub.rules.filter((rule) => rule.status === 'active');
  const systemsById = new Map(hub.systems.map((system) => [system.id, system]));
  const datasetById = new Map(hub.datasetTypes.map((dataset) => [dataset.id, dataset]));
  const rulesByKind = new Map(['mapping', 'routing', 'fallback'].map((kind) => [kind, rules.filter((rule) => rule.ruleKind === kind)]));
  return enrichData({
    meta: hub.meta, systems: hub.systems, datasetTypes: hub.datasetTypes, rules, fields,
    systemsById, datasetById, rulesByKind, fold,
  });
}
