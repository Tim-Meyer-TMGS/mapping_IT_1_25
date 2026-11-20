import { hrefFor, withOrigin, originState } from './router.js';
import { DISPLAY_GROUPS as FIELD_GROUPS } from './field-groups.js';
import { DIMENSIONS, naturalSort, fieldKey, typeOfRule, rulesForType, fieldsForType, filterRules, searchCatalog } from './catalog.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const typeLabel = (data, id) => data.datasetById.get(id)?.label ?? id ?? 'Nicht dokumentiert';
const systemLabel = (data, id) => data.systemsById.get(id)?.label ?? id ?? 'Nicht dokumentiert';
const link = (label, state, attributes = '') => `<a href="${esc(hrefFor(state, true))}" data-nav ${attributes}>${esc(label)}</a>`;
const viewLabels = { overview: 'Übersicht', fields: 'Datenfelder', mapping: 'Mappings', routing: 'Routing', fallback: 'Fallbacks' };
const empty = message => `<p class="empty-state">${esc(message)}</p>`;
const input = (name, label, value = '', placeholder = '') => `<label for="filter-${name}">${esc(label)}<input id="filter-${name}" name="${name}" type="search" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off"></label>`;
const select = (name, label, value, choices) => `<label for="filter-${name}">${esc(label)}<select id="filter-${name}" name="${name}"><option value="">Alle</option>${choices.map(([id, title]) => `<option value="${esc(id)}"${id === value ? ' selected' : ''}>${esc(title)}</option>`).join('')}</select></label>`;
const hidden = (name, value) => value ? `<input type="hidden" name="${name}" value="${esc(value)}">` : '';

function breadcrumbs(items) {
  return `<nav class="breadcrumb" aria-label="Brotkrümelnavigation">${link('Start', {})}${items.map(([label, state]) => `<span aria-hidden="true">/</span>${state ? link(label, state) : `<span aria-current="page">${esc(label)}</span>`}`).join('')}</nav>`;
}

function navigation(data, type, active) {
  const views = ['overview', 'fields', 'mapping', ...(rulesForType(data, type, 'routing').length ? ['routing'] : []), ...(rulesForType(data, type, 'fallback').length ? ['fallback'] : [])];
  return `<nav class="section-nav" aria-label="Bereiche">${views.map(view => link(viewLabels[view], { type, ...(view === 'overview' ? {} : { view }) }, active === view ? 'aria-current="page"' : '')).join('')}</nav>`;
}

function datasetHeader(data, type, active, title = typeLabel(data, type), subcrumb = null) {
  const items = active === 'overview' ? [[typeLabel(data, type), null]] : [[typeLabel(data, type), { type }], [viewLabels[active], subcrumb ? { type, view: active } : null], ...(subcrumb ? [[subcrumb, null]] : [])];
  return `${breadcrumbs(items)}<header class="view-heading"><h1>${esc(title)}</h1></header>${navigation(data, type, active)}`;
}

function typeSystems(data, type) {
  return [...new Set(data.rules.filter(rule => typeOfRule(rule) === type || rule.source?.datasetType === type).map(rule => rule.source?.system))].filter(Boolean).sort(naturalSort);
}

function odtaCategories(row) {
  const vocabulary = 'https://odta.io/voc/';
  const values = row.odta.map(value => {
    if (value.startsWith(vocabulary)) return `<a href="${esc(value)}">${esc(value.slice(vocabulary.length))}</a>`;
    return esc(value);
  });
  if (row.odtaKind && !row.odta.includes(row.odtaKind) && !row.odta.includes(vocabulary + row.odtaKind)) {
    values.push(`${esc(row.odtaKind)} <small>(OdtaKind)</small>`);
  }
  return values.join('<br>') || '-';
}

const categoryValues = values => values.map(esc).join('<br>') || '-';

function mappingHeader(tabs, active, view) {
  const sections = [['categories', 'Kategorien'], ['features', 'Merkmale']];
  return `<header class="mapping-heading">
    <h1>Zuordnungen</h1>
    <p>Quellsystem → SaTourN${view === 'categories' ? ' → ODTA' : ''}</p>
  </header>
  <nav class="mapping-entries" aria-label="Mappingarten">${sections.map(([id, label]) => link(label, { type: active.id, view: id }, id === view ? 'aria-current="page"' : '')).join('')}</nav>
  <nav class="section-nav category-nav" aria-label="Datensatzarten">${tabs.map(tab => link(tab.label, { view, type: tab.id }, tab === active ? 'aria-current="page"' : '')).join('')}</nav>`;
}

function categoryOverview(data, state) {
  const tabs = data.categoryTabs;
  const active = tabs.find(tab => tab.id === state.type) ?? tabs[0];
  const hasDeskline = ['accommodation', 'package'].includes(active.id);
  const sourceLabel = hasDeskline ? 'Deskline (Feratel)' : 'Outdooractive';
  const count = active.rows.length;
  const importLinks = [
    [rulesForType(data, active.id, 'routing'), 'routing', 'Routingregeln'],
    [rulesForType(data, active.id, 'fallback').filter(rule => rule.source.dimension === 'category'), 'fallback', 'Fallbacks'],
  ].filter(([rules]) => rules.length).map(([rules, view, label]) =>
    link(`${label} (${rules.length})`, { type: active.id, view, ...(view === 'fallback' ? { dimension: 'category' } : {}) }));
  const documentGaps = active.documentGaps ?? [];
  return `${mappingHeader(tabs, active, 'categories')}
  <div class="category-summary"><strong>${count} ${count === 1 ? 'Eintrag' : 'Einträge'}</strong><div class="category-tools">${importLinks.join('')}<span>„-“ steht für eine fehlende Zuordnung</span></div></div>
  ${documentGaps.length ? `<details class="document-gaps"><summary>Dokumentierte Ziele außerhalb des Kategoriebaums (${documentGaps.length})</summary>
     <ul>${documentGaps.map(entry => {
       const rule = data.rulesById.get(entry.rule);
       return `<li>${esc(systemLabel(data, rule.source.system))} · ${link(rule.source.value, withOrigin(ruleState(rule), state))} → ${esc(entry.target)}</li>`;
     }).join('')}</ul></details>` : ''}
  <div class="table-scroll" role="region" aria-label="Kategoriemappings für ${esc(active.label)}" tabindex="0"><table class="category-table">
    <caption class="sr-only">Kategoriemappings für ${esc(active.label)}</caption>
    <thead><tr><th scope="col">${sourceLabel}</th><th scope="col">DAMAS</th><th scope="col">SaTourN</th><th scope="col">ODTA-Kategorie</th></tr></thead>
    <tbody>${active.rows.map(row => {
      const sourceValues = hasDeskline ? row.deskline.map(entry => entry.label) : row.outdooractive;
      const sourceId = row.outdooractiveCategoryId ? ` <small>(ID ${esc(row.outdooractiveCategoryId)})</small>` : '';
      return `<tr><td>${categoryValues(sourceValues)}${sourceId}</td><td>${categoryValues(row.damas)}</td><th scope="row">${esc(row.satourn ?? '-')}</th><td>${odtaCategories(row)}</td></tr>`;
    }).join('')}</tbody>
  </table></div>
  ${active.rows.length ? '' : empty('Für diese Datensatzart sind keine Kategoriemappings dokumentiert.')}`;
}

function featureOverview(data, state) {
  const tabs = data.categoryTabs;
  const active = tabs.find(tab => tab.id === state.type) ?? tabs[0];
  const xslt = data.featureTabs.find(tab => tab.id === active.id);
  const existing = data.rules.filter(rule =>
    rule.source?.datasetType === active.id && rule.source.dimension === 'feature' &&
    rule.ruleKind === 'mapping' && data.fold(rule.source.value) !== 'barrierefrei');
  const mappings = [
    ...(xslt?.rows ?? []).map(row => ({
      system: 'Outdooractive',
      group: row.group ?? 'traits',
      sources: row.sourceLabel ? [row.sourceLabel] : row.sources,
      targets: row.targets.map(target => ({
        label: target.displayLabel ?? target.label,
        descriptive: !target.displayLabel,
      })),
    })),
    ...existing.map(rule => ({
      system: rule.source.system === 'feratel' ? 'Deskline (Feratel)' : systemLabel(data, rule.source.system),
      group: 'traits',
      sources: [rule.source.value],
      targets: (rule.behavior === 'noImport' ? ['Kein Import'] : (rule.target?.values ?? [])).map(label => ({ label, descriptive: false })),
    })),
  ];
  const rows = [...new Map(mappings.map(row => [JSON.stringify(row), row])).values()]
    .sort((a, b) => naturalSort(a.sources[0], b.sources[0]));
  const basis = rows.filter(row => row.group === 'basis');
  const content = rows.filter(row => row.group === 'content');
  const traits = rows.filter(row => row.group === 'traits');
  const body = (items, label) => `<tbody>${label && items.length ? `<tr class="feature-group"><th scope="rowgroup" colspan="3">${label}</th></tr>` : ''}${items.map(row =>
    `<tr><td>${esc(row.system)}</td><th scope="row">${categoryValues(row.sources)}</th><td>${row.targets.map(target =>
      `${esc(target.label)}${target.descriptive ? ' <sup>†</sup>' : ''}`).join('<br>') || '-'}</td></tr>`).join('')}</tbody>`;
  return `${mappingHeader(tabs, active, 'features')}
  ${rows.some(row => row.targets.some(target => target.descriptive)) ? '<p class="result-count">† Beschreibt das zugeordnete Feld. Der genaue SaTourN-Anzeigename ist offen.</p>' : ''}
  <div class="table-scroll" role="region" aria-label="Merkmalsmappings für ${esc(active.label)}" tabindex="0"><table class="category-table feature-table">
    <caption class="sr-only">Merkmalsmappings für ${esc(active.label)}</caption>
    <thead><tr><th scope="col">Quellsystem</th><th scope="col">Information im Quellsystem</th><th scope="col">Information in SaTourN</th></tr></thead>
    ${basis.length ? body(basis, 'Basisdaten') : ''}${content.length ? body(content, 'Weitere Datenfelder') : ''}${body(traits, basis.length || content.length ? 'Merkmale' : '')}
  </table></div>
  ${rows.length ? '' : empty('Für diese Datensatzart sind keine Merkmalszuordnungen hinterlegt.')}`;
}

function catalogOverview(data) {
  return `<header class="view-heading"><h1>SaTourN Mapping Hub</h1><p>Mappings und Datenfelder nach Datensatzart.</p></header>
    <h2>Felder und Mappings</h2>
    <div class="table-scroll"><table><caption class="sr-only">Datensatzarten</caption><thead><tr><th>Datensatzart</th><th>Datenfelder</th><th>Mappings</th><th>Quellsysteme</th></tr></thead><tbody>${data.datasetTypes.map(type => `<tr><th scope="row">${link(type.label, { type: type.id })}</th><td>${data.fields.filter(field => field.datasetType === type.id).length}</td><td>${rulesForType(data, type.id).length}</td><td>${esc(typeSystems(data, type.id).map(id => systemLabel(data, id)).join(' · ') || 'Keine dokumentiert')}</td></tr>`).join('')}</tbody></table></div>
    <p class="secondary">${link('ODTA-Referenz', { view: 'reference', system: 'odta' })}</p>`;
}

function overview(data, type) {
  const fields = fieldsForType(data, type), mappings = rulesForType(data, type);
  return `${datasetHeader(data, type, 'overview')}<p>Datenfelder und Import-Mappings für ${esc(typeLabel(data, type))} in SaTourN.</p>
    <dl class="overview-facts"><div><dt>Datenfelder</dt><dd>${link(`${fields.length} verfügbare Felder`, { type, view: 'fields' })}</dd></div><div><dt>Mappings</dt><dd>${link(`${mappings.length} aktive Mappingregeln`, { type, view: 'mapping' })}</dd></div><div><dt>Quellsysteme</dt><dd>${typeSystems(data, type).map(system => link(systemLabel(data, system), { type, view: 'mapping', system })).join(' · ') || 'Keine dokumentiert'}</dd></div></dl>`;
}

function guide(data, state) {
  const all = data.rules.filter(rule => rule.ruleKind === 'mapping');
  const scoped = all.filter(rule => !state.system || rule.source?.system === state.system);
  const needle = (state.source ?? '').trim();
  // Suggest loosely, but never present a partial or accent-folded match as a rule.
  const matches = scoped.filter(rule => rule.source?.value === needle);
  const types = [...new Set(matches.map(typeOfRule))].filter(Boolean);
  const validType = types.includes(state.type) ? state.type : null;
  const selected = matches.filter(rule => !validType || typeOfRule(rule) === validType);
  const suggestions = [...new Set(scoped.map(rule => rule.source?.value).filter(value => typeof value === 'string' && value && data.fold(value).includes(data.fold(needle))))].sort(naturalSort);
  const systems = [...new Set(all.map(rule => rule.source?.system).filter(Boolean))].sort(naturalSort);
  const needsType = types.length > 1 && !validType;
  return `${breadcrumbs([['Zuordnung suchen', null]])}<h1>Zuordnung suchen</h1>
    <form class="filters guide-form" data-filter-form>${hidden('view', 'guide')}
    <label for="filter-system">Quellsystem<select id="filter-system" name="system"><option value="">Alle / unbekannt</option>${systems.map(id => `<option value="${esc(id)}"${state.system === id ? ' selected' : ''}>${esc(systemLabel(data, id))}</option>`).join('')}</select></label>
    <label for="filter-source">Quellwert<input id="filter-source" type="search" name="source" value="${esc(state.source)}" list="documented-values" autocomplete="off" placeholder="Bezeichnung im Quellsystem"><datalist id="documented-values">${suggestions.slice(0, 100).map(value => `<option value="${esc(value)}"></option>`).join('')}</datalist></label>
    ${types.length > 1 ? select('type', 'Datensatzart', state.type, types.map(id => [id, typeLabel(data, id)])) : ''}<button>Suchen</button>${link('Zurücksetzen', { view: 'guide' })}</form>
    <p class="secondary">Suche in dokumentierten Regeln. Der Quellwert muss exakt übereinstimmen.</p>
    ${!needle ? '' : !matches.length ? `<h2>Keine Regel gefunden</h2><p>Ob der Wert trotzdem importiert wird, ist hier nicht dokumentiert.</p>${suggestions.length ? `<h3>Ähnliche Quellwerte</h3><ul>${suggestions.slice(0, 12).map(value => `<li>${link(value, { view: 'guide', system: state.system, source: value })}</li>`).join('')}</ul>` : ''}` : needsType ? `<h2>Datensatzart auswählen</h2><p>Für diesen Quellwert gibt es Regeln in mehreren Datensatzarten.</p>` : `<h2>Zuordnung${selected.length === 1 ? '' : 'en'}</h2><p role="status">${selected.length} Regel${selected.length === 1 ? '' : 'n'}${!state.system ? ' · alle Quellsysteme' : ''}</p>${selected.map(rule => `<article class="guide-result"><h3>${esc(systemLabel(data, rule.source?.system))} · ${esc(typeLabel(data, typeOfRule(rule)))}</h3><p>Quelle: <strong>${esc(rule.source?.value)}</strong> (${esc(DIMENSIONS[rule.source?.dimension] ?? rule.source?.dimension)}) → SaTourN</p><dl class="facts"><div><dt>Zielfeld</dt><dd>${targetField(data, rule, state)}</dd></div><div><dt>Zielwert / Verhalten</dt><dd>${targetValue(data, rule)}</dd></div></dl>${rule.behavior === 'noImport' ? '<p>Gilt für diesen Wert, nicht für den gesamten Datensatz.</p>' : rule.behavior === 'noTarget' ? '<p>Das weitere Importverhalten ist nicht dokumentiert.</p>' : ''}<p>${link('Regeldetails', withOrigin(ruleState(rule), state))}</p></article>`).join('')}`}
    <p>${link('Felder und Mappings', { view: 'catalog' })}</p>`;
}

function pager(state, total, pageSize = 100, key = 'page') {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(pages, Math.max(1, Number.parseInt(state[key], 10) || 1));
  return { page, start: (page - 1) * pageSize, html: pages > 1 ? `<nav class="pagination" aria-label="Ergebnisseiten ${esc(key)}">${page > 1 ? link('← Zurück', { ...state, [key]: page - 1 }) : '<span></span>'}<span>Seite ${page} von ${pages}</span>${page < pages ? link('Weiter →', { ...state, [key]: page + 1 }) : '<span></span>'}</nav>` : '' };
}

function fieldTable(data, fields, global = false, state = null) {
  return `<div class="table-scroll"><table class="field-table"><caption class="sr-only">Datenfelder</caption><thead><tr><th>Technischer Feldname</th><th>Bereich</th><th>Feldtyp</th><th>Mappings</th></tr></thead><tbody>${fields.map(field => {
    const count = (data.incoming.get(fieldKey(field.datasetType, field.field)) ?? []).length;
    return `<tr><th scope="row"><code>${link(field.field, withOrigin({ type: field.datasetType, view: 'fields', field: field.field }, state))}</code>${global ? `<small class="block">${esc(typeLabel(data, field.datasetType))}</small>` : ''}${field.languages?.length ? `<small class="block">${esc(field.languages.join(', '))}</small>` : ''}</th><td>${esc(field.group.label)}</td><td>${field.fieldType.status === 'inferred' ? `${esc(field.fieldType.label)} <small>abgeleitet</small>` : '<span class="secondary">—</span>'}</td><td>${count ? link(String(count), { type: field.datasetType, view: 'mapping', field: field.field }) : '<span class="secondary">Keine dokumentiert</span>'}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function fieldCatalog(data, state) {
  const type = state.type, all = fieldsForType(data, type), fields = fieldsForType(data, type, state);
  const groups = FIELD_GROUPS.filter(group => all.some(field => field.group.id === group.id));
  return `${datasetHeader(data, type, 'fields')}<div class="heading-row"><h2>${all.length} verfügbare ${esc(typeLabel(data, type))}-Felder</h2><button class="text-button" type="button" data-export-spec>JSON-LD herunterladen</button></div>
    <form class="filters" data-filter-form>${hidden('type', type)}${hidden('view', 'fields')}${input('filter', 'Feld durchsuchen', state.filter, 'Feldname oder Bereich')}${select('group', 'Bereich', state.group, groups.map(group => [group.id, group.label]))}<button>Suchen</button>${link('Zurücksetzen', { type, view: 'fields' })}</form>
    <p class="result-count" role="status">${fields.length} von ${all.length} Feldern</p>${fields.length ? fieldTable(data, fields, false, state) : empty(all.length ? 'Keine Felder passen zu diesen Filtern.' : 'Für diese Datensatzart sind keine Datenfelder dokumentiert.')}`;
}

function targetField(data, rule, state = null) {
  const target = rule.target;
  if (!target?.field) return '<span class="secondary">Nicht dokumentiert</span>';
  return data.fieldsByKey.has(fieldKey(target.datasetType, target.field)) ? link(target.field, withOrigin({ type: target.datasetType, view: 'fields', field: target.field }, state)) : esc(target.field);
}

function targetValue(data, rule) {
  if (rule.behavior === 'noImport') return 'Nicht importieren';
  if (rule.behavior === 'noTarget') return 'Kein Zielwert';
  if (rule.ruleKind === 'routing') return `Datensatzart: ${esc(typeLabel(data, rule.target?.datasetType))}`;
  if (rule.ruleKind === 'fallback') {
    if (rule.fallback?.mode === 'passSourceValue') return 'Quellwert unverändert übernehmen';
    if (rule.fallback?.mode === 'empty') return 'Keinen Wert setzen';
    return `Fester Wert: ${esc(rule.fallback?.value ?? 'Nicht dokumentiert')}`;
  }
  return (rule.target?.values ?? []).map(esc).join('<br>') + (rule.oneToMany ? '<small class="block">Alle Zielwerte werden gesetzt</small>' : '');
}

function ruleState(rule) {
  return { type: typeOfRule(rule), view: rule.ruleKind === 'mapping' ? 'mapping' : rule.ruleKind, term: rule.id };
}

function mappingTable(data, rules, state = null) {
  if (!rules.length) return empty('Keine Regeln passen zu diesen Filtern.');
  return `<div class="table-scroll"><table class="mapping-table"><caption class="sr-only">Quelle und Ziel der Mappingregeln</caption><thead><tr><th>Quellsystem</th><th>Dimension</th><th>Quellwert / Regel öffnen</th><th>Zielfeld · SaTourN</th><th>Zielwert / Verhalten</th></tr></thead><tbody>${rules.map(rule => `<tr><td>${esc(systemLabel(data, rule.source?.system))}</td><td>${esc(DIMENSIONS[rule.source?.dimension] ?? rule.source?.dimension)}${rule.source?.language ? `<small class="block">${esc(rule.source.language)}</small>` : ''}</td><th scope="row">${link(rule.source?.value ?? 'Regel', withOrigin(ruleState(rule), state))}</th><td>${targetField(data, rule, state)}</td><td>${targetValue(data, rule)}</td></tr>`).join('')}</tbody></table></div>`;
}

function mappingList(data, state) {
  const { type } = state, kind = ['routing', 'fallback'].includes(state.view) ? state.view : 'mapping';
  const all = rulesForType(data, type, kind), filtered = filterRules(data, all, state);
  const choices = getter => [...new Set(all.map(getter).filter(Boolean))].sort(naturalSort);
  const pagination = pager(state, filtered.length);
  return `${datasetHeader(data, type, kind)}<h2>${esc(viewLabels[kind])}</h2>
    <form class="filters mapping-filters" data-filter-form>${hidden('type', type)}${hidden('view', kind)}${hidden('mode', state.mode)}
    ${select('system', 'Quellsystem', state.system, choices(rule => rule.source?.system).map(id => [id, systemLabel(data, id)]))}
    ${input('filter', 'Mappings durchsuchen', state.filter, 'Quellwert, Zielwert, Feld oder Regel-ID')}
    <details class="advanced-filters"${['dimension', 'field', 'source', 'target'].some(key => state[key]) ? ' open' : ''}><summary>Weitere Filter${['dimension', 'field', 'source', 'target'].filter(key => state[key]).length ? ` (${['dimension', 'field', 'source', 'target'].filter(key => state[key]).length} aktiv)` : ''}</summary><div class="filters">
    ${select('dimension', 'Dimension', state.dimension, choices(rule => rule.source?.dimension).map(id => [id, DIMENSIONS[id] ?? id]))}
    ${select('field', 'Zielfeld', state.field, choices(rule => rule.target?.field).map(id => [id, id]))}
    ${input('source', 'Quellwert', state.source)}${input('target', 'Zielwert', state.target)}</div></details>
    <button>Suchen</button>${link('Zurücksetzen', { type, view: kind })}</form>
    <p class="result-count" role="status">${filtered.length} von ${all.length} Regeln${state.mode === 'target' ? ' · nach Zielwert sortiert' : ''}</p>
    ${mappingTable(data, filtered.slice(pagination.start, pagination.start + 100), state)}${pagination.html}`;
}

function technicalDetails(rule) {
  const facts = [['Regel-ID', rule.id], ['Technischer Regeltyp', rule.ruleKind], ['Verhalten', rule.behavior], ['Dimension', rule.source?.dimension], ['Quell-Datensatzart', rule.source?.datasetTypeRaw], ['Feldnachweis', rule.target?.fieldEvidence], ['Technische Marker', rule.technicalMarkers?.join(', ')]];
  const notes = [...new Set([...(rule.notes ?? []), ...(rule.reviewFlag ? [String(rule.reviewFlag)] : [])])];
  return `<details class="technical-details"><summary>Technische Details</summary><dl class="facts">${facts.filter(([,value]) => value).map(([name,value]) => `<div><dt>${esc(name)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>
    ${notes.length ? `<h3>Interner Prüfhinweis</h3><ul>${notes.map(note => `<li>${esc(note)}</li>`).join('')}</ul>` : ''}
    <details class="provenance"><summary>Provenienz anzeigen</summary>${(rule.provenance ?? []).map(item => `<div class="provenance-item"><p>${esc(item.sourceFile)}${item.sourceLine ? ` · Zeile ${esc(item.sourceLine)}` : ''}${item.market ? ` · ${esc(item.market)}` : ''}</p>${item.note ? `<p>Interner Prüfhinweis: ${esc(item.note)}</p>` : ''}${item.raw ? `<details><summary>Quelltext anzeigen</summary><pre>${esc(item.raw)}</pre></details>` : ''}</div>`).join('')}</details></details>`;
}

function ruleDetail(data, state) {
  const rule = data.rulesById.get(state.term);
  if (!rule) return `${datasetHeader(data, state.type, 'mapping')}<h2>Regel nicht gefunden</h2>${link('Mappings öffnen', { type: state.type, view: 'mapping' })}`;
  const type = typeOfRule(rule), view = rule.ruleKind === 'mapping' ? 'mapping' : rule.ruleKind;
  return `${datasetHeader(data, type, view, rule.source?.value ?? 'Mapping', 'Regel')}<div class="mapping-detail">
    <section><h2>Quelle</h2><dl class="facts"><div><dt>Quellsystem</dt><dd>${esc(systemLabel(data, rule.source?.system))}</dd></div><div><dt>Datensatzart</dt><dd>${esc(typeLabel(data, rule.source?.datasetType))}</dd></div><div><dt>Dimension / Feld</dt><dd>${esc(DIMENSIONS[rule.source?.dimension] ?? rule.source?.dimension)}</dd></div><div><dt>Wert</dt><dd>${esc(rule.source?.value)}</dd></div>${rule.source?.language ? `<div><dt>Sprache</dt><dd>${esc(rule.source.language)}</dd></div>` : ''}</dl></section>
    <span class="direction-arrow" aria-hidden="true">→</span><section><h2>Ziel</h2><dl class="facts"><div><dt>System</dt><dd>SaTourN</dd></div><div><dt>Datensatzart</dt><dd>${esc(typeLabel(data, rule.target?.datasetType))}</dd></div><div><dt>Feld</dt><dd>${targetField(data, rule, state)}</dd></div><div><dt>Wert / Verhalten</dt><dd>${targetValue(data, rule)}</dd></div></dl></section></div>
    <p>${link(originState(state) ? 'Zurück zur Auswahl' : 'Zur Mappingliste', originState(state) ?? { ...state, type, view, term: null, from: null }, 'data-return')}</p>${technicalDetails(rule)}`;
}

function fieldDetail(data, state) {
  const { type, field: name } = state, field = data.fieldsByKey.get(fieldKey(type, name));
  if (!field) return `${datasetHeader(data, type, 'fields')}<h2>Feld nicht gefunden</h2>${link('Datenfelder öffnen', { type, view: 'fields' })}`;
  const incoming = data.incoming.get(fieldKey(type, name)) ?? [];
  const values = [...(data.fieldValues.get(fieldKey(type, name))?.values() ?? [])].sort((a,b) => naturalSort(a.value,b.value));
  const filteredValues = values.filter(entry => data.fold(entry.value).includes(data.fold(state.valueFilter ?? '').trim()));
  const filteredIncoming = filterRules(data, incoming, { filter: state.ruleFilter });
  const valuePager = pager(state, filteredValues.length, 30, 'valuePage');
  const rulePager = pager(state, filteredIncoming.length, 30, 'rulePage');
  const detailSearch = (key, label) => `<form class="filters" data-filter-form>${Object.entries(state).filter(([name]) => name !== key && name !== (key === 'valueFilter' ? 'valuePage' : 'rulePage')).map(([name, value]) => hidden(name, value)).join('')}${input(key, label, state[key])}<button>Suchen</button>${link('Filter löschen', { ...state, [key]: null, [key === 'valueFilter' ? 'valuePage' : 'rulePage']: null })}</form>`;
  return `${datasetHeader(data, type, 'fields', name, name)}<dl class="facts"><div><dt>Datensatzart</dt><dd>${esc(typeLabel(data, type))}</dd></div><div><dt>Technischer Feldname</dt><dd><code>${esc(name)}</code></dd></div><div><dt>Bereich</dt><dd>${link(field.group.label, { type, view: 'fields', group: field.group.id })}</dd></div>${field.fieldType.status === 'inferred' ? `<div><dt>Feldtyp</dt><dd>${esc(field.fieldType.label)} <span class="secondary">(abgeleitet)</span></dd></div>` : ''}</dl>
    <section><h2>Werte</h2><p class="secondary">${values.length} Zielwerte aus dokumentierten Mappingregeln. Keine vollständige Liste aller zulässigen Feldwerte.</p>${values.length ? `${detailSearch('valueFilter', 'Zielwerte durchsuchen')}<p role="status">${filteredValues.length} von ${values.length} Zielwerten</p>${filteredValues.length ? `<ul class="field-values">${filteredValues.slice(valuePager.start, valuePager.start + 30).map(entry => `<li>${link(entry.value, { type, view: 'mapping', field: name, target: entry.value })}</li>`).join('')}</ul>` : empty('Keine Zielwerte passen zu dieser Suche.')}${valuePager.html}` : empty('Für dieses Feld sind keine Zielwerte dokumentiert.')}</section>
    <p>${link(originState(state) ? 'Zurück zur Auswahl' : 'Zum Feldkatalog', originState(state) ?? { type, view: 'fields' }, 'data-return')}</p>
    <section><div class="heading-row"><h2>Eingehende Mappings</h2>${link('Alle Regeln für dieses Feld', { type, view: 'mapping', field: name })}</div><p>${incoming.length} Regeln befüllen dieses Feld bzw. steuern seine Übernahme. Nicht dokumentiert bedeutet nicht: kein Import.</p>${incoming.length ? detailSearch('ruleFilter', 'Eingehende Mappings durchsuchen') : ''}<p role="status">${filteredIncoming.length} von ${incoming.length} Regeln</p>${mappingTable(data, filteredIncoming.slice(rulePager.start, rulePager.start + 30), state)}${rulePager.html}</section>
    <details class="technical-details"><summary>Technische Informationen</summary><dl class="facts"><div><dt>Namespace</dt><dd>${esc(field.namespaces || 'Nicht dokumentiert')}</dd></div><div><dt>Sprachen</dt><dd>${esc(field.languages?.join(', ') || 'Keine Sprachangabe')}</dd></div><div><dt>Nutzung im Datenbestand</dt><dd>${esc(field.usage?.occurrences ?? '—')} Vorkommen, davon ${esc(field.usage?.nonemptyOccurrences ?? '—')} befüllt; in ${esc(field.usage?.filesPresent ?? '—')} Dateien</dd></div><div><dt>Feldquelle</dt><dd>AH67-T309 / ${esc(field.sourceDirectory)}</dd></div><div><dt>Typableitung</dt><dd>${esc(field.fieldType.label)}; aus verfügbaren Testwerten, keine verbindliche Typdefinition.</dd></div><div><dt>Pflichtfeld / Kardinalität</dt><dd>Nicht dokumentiert</dd></div><div><dt>Gruppierung</dt><dd>Navigationsmetadatum nach Feldnamen; keine offizielle SaTourN-Spezifikation.</dd></div></dl></details>`;
}

function searchView(data, state) {
  const query = state.q?.trim() ?? '', result = searchCatalog(data, query);
  const categories = [['fields', 'Datenfelder'], ['rules', 'Mappings'], ['values', 'Feldwerte']];
  const total = result.fields.length + result.rules.length + result.values.length;
  const selected = categories.some(([id]) => id === state.group) ? state.group : (result.fields.length ? 'fields' : result.rules.length ? 'rules' : 'values');
  const pagination = pager(state, result[selected].length), visible = result[selected].slice(pagination.start, pagination.start + 100);
  let content;
  if (selected === 'fields') content = fieldTable(data, visible, true, state);
  else if (selected === 'rules') content = `<div class="search-results">${visible.map(rule => `<article class="search-result"><p class="result-kind">MAPPING · ${esc(systemLabel(data, rule.source?.system))} · ${esc(typeLabel(data, typeOfRule(rule)))}</p><p>Quelle: ${link(rule.source?.value ?? 'Regel', withOrigin(ruleState(rule), state))} → SaTourN · ${esc(typeLabel(data, rule.target?.datasetType))} · Feld: ${targetField(data, rule, state)} · Wert: ${targetValue(data, rule)}</p></article>`).join('')}</div>`;
  else content = `<div class="search-results">${visible.map(entry => `<article class="search-result"><p class="result-kind">FELDWERT · ${esc(typeLabel(data, entry.type))}</p><p>Feld: ${link(entry.field, withOrigin({ type: entry.type, view: 'fields', field: entry.field }, state))} · Wert: ${esc(entry.value)}</p><small>Aus ${entry.ruleIds.length} Mappingregeln</small></article>`).join('')}</div>`;
  return `${breadcrumbs([['Suche', null]])}<header class="view-heading"><h1>${query ? `Suche: ${esc(query)}` : 'Suche'}</h1><p>${total} Treffer</p></header><nav class="section-nav" aria-label="Treffertypen">${categories.map(([id,label]) => link(`${label} (${result[id].length})`, { q: query, group: id }, selected === id ? 'aria-current="page"' : '')).join('')}</nav>${visible.length ? content : empty('Keine Treffer in diesem Bereich.')}${pagination.html}`;
}

export function render(data, state) {
  if (state.q !== undefined) return searchView(data, state);
  if (state.view === 'guide') return guide(data, state);
  if (state.view === 'catalog') return catalogOverview(data);
  if (state.view === 'reference' && state.system === 'odta') return `${breadcrumbs([['ODTA', null]])}<h1>ODTA</h1><p>${link('ODTA-Kategorien in der Mappingübersicht', { view: 'categories' })}</p>`;
  if (state.view === 'features') return featureOverview(data, state);
  if (state.view === 'categories' || !state.type) return categoryOverview(data, state);
  if (!data.datasetById.has(state.type)) return `${breadcrumbs([['Datensatzart', null]])}<h1>Datensatzart nicht gefunden</h1>${link('Zur Startseite', {})}`;
  if (state.term) return ruleDetail(data, state);
  if (['fields', 'model', 'structure'].includes(state.view)) return state.field ? fieldDetail(data, state) : fieldCatalog(data, state);
  if (['mapping', 'routing', 'fallback'].includes(state.view)) return mappingList(data, state);
  return overview(data, state.type);
}
