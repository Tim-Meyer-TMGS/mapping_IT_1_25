import { DISPLAY_GROUPS as FIELD_GROUPS, groupFor } from './field-groups.js';

export const DIMENSIONS = { category: 'Kategorie', feature: 'Merkmal', 'dataset-routing': 'Datensatzart' };
export const naturalSort = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'de', { numeric: true, sensitivity: 'base' });
export const fieldKey = (type, name) => `${type}\u0000${name}`;
export const typeOfRule = rule => rule.target?.datasetType ?? rule.source?.datasetType;

export function enrichData(data) {
  data.fields = data.fields.map(field => ({ ...field, group: groupFor(field) }));
  data.fieldsByKey = new Map(data.fields.map(field => [fieldKey(field.datasetType, field.field), field]));
  data.rulesById = new Map(data.rules.map(rule => [rule.id, rule]));
  data.incoming = new Map();
  data.fieldValues = new Map();
  for (const rule of data.rules) {
    if (!rule.target?.field || !rule.target?.datasetType) continue;
    const key = fieldKey(rule.target.datasetType, rule.target.field);
    if (!data.incoming.has(key)) data.incoming.set(key, []);
    data.incoming.get(key).push(rule);
    if (rule.behavior !== 'map') continue;
    if (!data.fieldValues.has(key)) data.fieldValues.set(key, new Map());
    for (const value of rule.target.values ?? []) {
      const values = data.fieldValues.get(key);
      if (!values.has(value)) values.set(value, { type: rule.target.datasetType, field: rule.target.field, value, ruleIds: [] });
      values.get(value).ruleIds.push(rule.id);
    }
  }
  data.valueEntries = [...data.fieldValues.values()].flatMap(values => [...values.values()]);
  return data;
}

export function rulesForType(data, type, kind = 'mapping') {
  return data.rules.filter(rule => rule.ruleKind === kind && (rule.source?.datasetType === type || rule.target?.datasetType === type));
}

export function fieldsForType(data, type, state = {}) {
  const needle = data.fold(state.filter ?? '').trim();
  return data.fields.filter(field => field.datasetType === type
    && (!state.group || field.group.id === state.group)
    && (!needle || data.fold(`${field.field} ${field.group.label} ${field.group.aliases}`).includes(needle)))
    .sort((a, b) => FIELD_GROUPS.indexOf(a.group) - FIELD_GROUPS.indexOf(b.group) || naturalSort(a.field, b.field));
}

export function filterRules(data, rules, state) {
  const contains = (value, query) => !query || data.fold(value).includes(data.fold(query).trim());
  return rules.filter(rule => (!state.system || rule.source?.system === state.system)
    && (!state.dimension || rule.source?.dimension === state.dimension)
    && (!state.field || rule.target?.field === state.field)
    && contains(rule.source?.value, state.source)
    && contains((rule.target?.values ?? []).join(' '), state.target)
    && contains([rule.id, rule.source?.value, rule.target?.field, ...(rule.target?.values ?? [])].join(' '), state.filter))
    .sort((a, b) => state.mode === 'target'
      ? naturalSort(a.target?.values?.[0], b.target?.values?.[0]) || naturalSort(a.source?.value, b.source?.value)
      : naturalSort(a.source?.value, b.source?.value) || naturalSort(a.source?.system, b.source?.system));
}

export function searchCatalog(data, query) {
  const needle = data.fold(query).trim();
  if (!needle) return { fields: [], rules: [], values: [] };
  const match = value => data.fold(value).includes(needle);
  return {
    fields: data.fields.filter(field => match(`${field.field} ${field.group.label} ${field.group.aliases}`)),
    rules: data.rules.filter(rule => match([rule.id, rule.source?.system, rule.source?.datasetType, rule.source?.value, rule.target?.field, ...(rule.target?.values ?? []), ...(rule.technicalMarkers ?? [])].join(' '))),
    values: data.valueEntries.filter(entry => match(entry.value)),
  };
}
