import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv } from '../assets/js/data.js';

const labels = { boolean: 'Boolesch', integer: 'Ganzzahl', decimal: 'Dezimalzahl', double: 'Gleitkommazahl', date: 'Datum', dateTime: 'Datum / Uhrzeit', anyURI: 'URL', string: 'Text' };

function validDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function classify(value) {
  if (/^(true|false)$/.test(value)) return 'boolean';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) && validDate(value)) return 'date';
  if (/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:0\d|1[0-3]):[0-5]\d)?$/.test(value) && validDate(value.slice(0, 10))) return 'dateTime';
  if (/^https?:\/\/\S+$/i.test(value)) {
    try { if (new URL(value).hostname) return 'anyURI'; } catch { /* Not a URL. */ }
  }
  // Leading zeros often identify codes, not quantities. 0/1 alone never imply boolean.
  if (/^[+-]?0\d+/.test(value)) return 'string';
  if (/^[+-]?(?:0|[1-9]\d*)$/.test(value)) return 'integer';
  if (/^[+-]?(?:\d+\.\d*|\.\d+)$/.test(value)) return 'decimal';
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)[eE][+-]?\d+$/.test(value)) return 'double';
  return 'string';
}

export function inferFieldType(field) {
  const values = (field.examples ?? '').split(' || ').map(value => value.trim()).filter(Boolean);
  if (!values.length) return { label: 'Nicht ableitbar', status: 'unknown', datatype: null };
  // Keep known identifier/contact fields textual even when examples contain only digits.
  const identifier = /(?:^|_)(?:ID|PID|PLZ|ZIP|POSTCODE|POSTALCODE|PHONE|TELEPHONE|TEL|FAX|SYSTEMID)(?:_|$)/i.test(field.field) || /(?:Id|ID|Idnummer|Betriebsnummer)$/.test(field.field);
  const types = new Set(values.map(value => identifier ? 'string' : classify(value)));
  const numeric = [...types].every(type => ['integer', 'decimal', 'double'].includes(type));
  const type = types.size === 1 ? [...types][0] : numeric ? (types.has('double') ? 'double' : 'decimal') : null;
  if (!type) return { label: 'Nicht eindeutig', status: 'mixed', datatype: null };
  return { label: labels[type], status: 'inferred', datatype: `http://www.w3.org/2001/XMLSchema#${type}` };
}

export function buildFieldDefinitions(rows) {
  // Explicit allowlist: sample values and observation statistics never reach the app.
  return rows.map(field => ({
    datasetType: field.datasetType,
    field: field.field,
    namespaces: field.namespaces,
    sourceDirectory: field.sourceDirectory,
    languages: field.languages ? field.languages.split('|') : [],
    usage: { occurrences: Number(field.occurrences), filesPresent: Number(field.filesPresent), nonemptyOccurrences: Number(field.nonemptyOccurrences) },
    fieldType: inferFieldType(field),
  }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const rows = parseCsv(await readFile(path.join(root, 'data/satourn-observed-fields.csv'), 'utf8'));
  const fields = buildFieldDefinitions(rows);
  await writeFile(path.join(root, 'data/field-definitions.json'), JSON.stringify(fields, null, 2) + '\n', 'utf8');
  console.log(`Generated ${fields.length} field definitions without sample values.`);
  console.log(fields.reduce((counts, field) => { counts[field.fieldType.label] = (counts[field.fieldType.label] ?? 0) + 1; return counts; }, {}));
}
