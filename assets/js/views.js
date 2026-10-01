import { hrefFor } from './router.js';

const DIMENSIONS = { category: 'Kategorien', feature: 'Merkmale' };
const VIEW_LABELS = { mapping: 'Zuordnungen', routing: 'Routing', fallback: 'Fallbacks', structure: 'SaTourN-Struktur' };

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function naturalSort(a, b) {
  return String(a ?? '').localeCompare(String(b ?? ''), 'de', { sensitivity: 'base', numeric: true });
}

function systemLabel(data, id) { return data.systemsById.get(id)?.label ?? id ?? '–'; }
function datasetLabel(data, id) { return data.datasetById.get(id)?.label ?? id ?? '–'; }

function link(label, changes, replace = false, className = '') {
  return `<a${className ? ` class="${escapeHtml(className)}"` : ''} href="${escapeHtml(hrefFor(changes, replace))}" data-nav>${escapeHtml(label)}</a>`;
}

function breadcrumbs(items) {
  return `<nav class="breadcrumb" aria-label="Brotkrümelnavigation">${items.map((item, index) => `${index ? '<span aria-hidden="true">›</span>' : ''}${item.href ? `<a href="${escapeHtml(item.href)}" data-nav>${escapeHtml(item.label)}</a>` : `<span aria-current="page">${escapeHtml(item.label)}</span>`}`).join('')}</nav>`;
}

function activeRules(data, kind) { return data.rulesByKind.get(kind) ?? []; }
function typeRules(data, kind, type) { return activeRules(data, kind).filter((rule) => rule.source?.datasetType === type || rule.target?.datasetType === type); }

function details(rule) {
  const provenance = rule.provenance ?? [];
  const rows = [
    ['Regel-ID', rule.id], ['Regelart', rule.ruleKind], ['Verhalten', rule.behavior],
    ['Quell-Datensatzart', rule.source?.datasetTypeRaw ?? rule.source?.datasetType],
    ['Dimension', rule.source?.dimension], ['Sprache', rule.source?.language],
    ['Zielfeld', rule.target?.field], ['Feldnachweis', rule.target?.fieldEvidence],
    ['Marker', (rule.technicalMarkers ?? []).join(', ')],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');
  return `<details class="technical-details"${new URLSearchParams(location.search).get('term') === rule.id ? ' open' : ''}>
    <summary>Technische Details</summary><dl>${rows.map(([name, value]) => `<div><dt>${escapeHtml(name)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>
    ${provenance.length ? `<div class="provenance"><strong>Provenienz</strong><ul>${provenance.map((item) => `<li>${escapeHtml(item.sourceFile)}${item.sourceLine ? `, Zeile ${escapeHtml(item.sourceLine)}` : ''}${item.market ? `, Markt ${escapeHtml(item.market)}` : ''}${item.raw ? `<details class="raw"><summary>Quelltext</summary><pre>${escapeHtml(item.raw)}</pre></details>` : ''}</li>`).join('')}</ul></div>` : ''}
  </details>`;
}

function ruleNotice(rule) {
  const notes = [...(rule.notes ?? []), ...(rule.reviewFlag ? ['Prüfhinweis vorhanden'] : [])];
  return notes.length ? `<p class="mapping-note">${escapeHtml(notes.join(' · '))}</p>` : '';
}

function targetChips(rule) {
  if (rule.behavior === 'noImport') return '<span class="status status-noImport">nicht übernehmen</span>';
  if (rule.behavior === 'noTarget') return '<span class="status status-noTarget">kein Zielwert</span>';
  const values = rule.target?.values ?? [];
  return values.length ? values.map((value) => `<span>${escapeHtml(value)}</span>`).join('') : '<span class="muted">Kein Zielwert</span>';
}

function home(data) {
  const types = data.datasetTypes.filter((type) => type.mappingSourceAvailable);
  const cards = types.map((type) => {
    const mappings = activeRules(data, 'mapping').filter((rule) => rule.source.datasetType === type.id);
    const systems = [...new Set(mappings.map((rule) => rule.source.system))].sort(naturalSort);
    const routing = activeRules(data, 'routing').filter((rule) => rule.target?.datasetType === type.id).length;
    const fallback = activeRules(data, 'fallback').filter((rule) => rule.source.datasetType === type.id).length;
    const supplements = [routing ? `${routing} Routing` : '', fallback ? `${fallback} Fallbacks` : ''].filter(Boolean).join(' · ');
    return `<a class="dataset-card" href="${escapeHtml(hrefFor({ type: type.id, view: 'mapping' }, true))}" data-nav>
      <span class="dataset-icon" aria-hidden="true">${escapeHtml(type.label.slice(0, 1))}</span><span class="dataset-copy"><strong>${escapeHtml(type.label)}</strong><small>${systems.map((id) => escapeHtml(systemLabel(data, id))).join(' · ')}</small>${supplements ? `<small>${escapeHtml(supplements)}</small>` : ''}</span>
      <span class="card-count">${mappings.length}<small>Regeln</small></span><span class="card-arrow" aria-hidden="true">→</span></a>`;
  }).join('');
  return `<section class="hero"><p class="eyebrow">Autoritativer Mappingstandard</p><h1>SaTourN Mapping Hub</h1><p>Importregeln, Routing, Fallbacks und beobachtete SaTourN-Strukturen.</p></section>
    <section aria-labelledby="imports-title"><div class="section-heading"><div><p class="eyebrow">Quellsysteme → SaTourN</p><h2 id="imports-title">Import-Datensatzarten</h2></div><span>${data.meta.totalActiveLogicalRules} aktive Regeln</span></div><div class="dataset-grid">${cards}</div></section>
    <section class="reference-grid" aria-labelledby="references-title"><div class="section-heading"><div><p class="eyebrow">Einordnung</p><h2 id="references-title">Referenzen und Zielsysteme</h2></div></div>
      <a class="reference-card" href="${escapeHtml(hrefFor({ view: 'reference', system: 'odta' }, true))}" data-nav><strong>ODTA</strong><span>Keine bestätigten Exportregeln</span></a>
      <a class="reference-card" href="${escapeHtml(hrefFor({ view: 'reference', system: 'satourn' }, true))}" data-nav><strong>SaTourN-Beispielstruktur</strong><span>Beobachtete XML-Felder und Vokabulare</span></a>
    </section>`;
}

function mappingControls(data, state, rules, type) {
  const dimensions = [...new Set(rules.map((rule) => rule.source.dimension).filter((value) => DIMENSIONS[value]))].sort();
  const dimension = dimensions.includes(state.dimension) ? state.dimension : dimensions[0];
  const dimensionRules = rules.filter((rule) => rule.source.dimension === dimension);
  const systems = [...new Set(dimensionRules.map((rule) => rule.source.system))].sort(naturalSort);
  const mode = state.mode === 'target' ? 'target' : 'source';
  const system = systems.includes(state.system) ? state.system : systems[0];
  return { dimension, dimensionRules, systems, system, mode, html: `
    <div class="tabs" aria-label="Dimension">${dimensions.map((id) => link(DIMENSIONS[id], { type, view: 'mapping', dimension: id, system: null, term: null }, true, id === dimension ? 'active' : '')).join('')}</div>
    <div class="toolbar"><div class="segmented" aria-label="Leserichtung">${link('Quellsystem → SaTourN', { type, view: 'mapping', dimension, mode: 'source', system, term: null }, true, mode === 'source' ? 'active' : '')}${link('SaTourN → Quellsysteme', { type, view: 'mapping', dimension, mode: 'target', system: null, term: null }, true, mode === 'target' ? 'active' : '')}</div>
    ${mode === 'source' ? `<div class="system-filter" aria-label="Quellsystem">${systems.map((id) => link(systemLabel(data, id), { type, view: 'mapping', dimension, mode, system: id, term: null }, true, id === system ? 'active' : '')).join('')}</div>` : ''}</div>` };
}

function sourceList(data, rules, system) {
  const visible = rules.filter((rule) => rule.source.system === system).sort((a, b) => naturalSort(a.source.value, b.source.value));
  if (!visible.length) return '<div class="empty-state"><h2>Keine Zuordnungen</h2><p>Für diese Auswahl sind keine Regeln hinterlegt.</p></div>';
  return `<div class="mapping-list">${visible.map((rule) => `<article class="mapping-item" id="${escapeHtml(rule.id)}"><div class="mapping-main"><div class="source-value"><span class="system-kicker">${escapeHtml(systemLabel(data, rule.source.system))}</span><h3>${escapeHtml(rule.source.value)}</h3></div><span class="mapping-arrow" aria-hidden="true">→</span><div class="target-values">${targetChips(rule)}</div></div>${ruleNotice(rule)}${details(rule)}</article>`).join('')}</div>`;
}

function reverseList(data, rules, type, dimension) {
  const groups = new Map();
  rules.filter((rule) => rule.behavior === 'map').forEach((rule) => (rule.target?.values ?? []).forEach((value) => {
    const key = `${rule.target.datasetType}\u0000${rule.target.dimension}\u0000${value}`;
    if (!groups.has(key)) groups.set(key, { value, rules: [] });
    groups.get(key).rules.push(rule);
  }));
  const entries = [...groups.values()].sort((a, b) => naturalSort(a.value, b.value));
  if (!entries.length) return '<div class="empty-state"><h2>Keine Zielwerte</h2><p>Für diese Auswahl sind keine SaTourN-Zielwerte hinterlegt.</p></div>';
  return `<div class="reverse-list">${entries.map((entry) => {
    const systems = new Map();
    entry.rules.forEach((rule) => { if (!systems.has(rule.source.system)) systems.set(rule.source.system, []); systems.get(rule.source.system).push(rule); });
    return `<article class="reverse-item"><div class="reverse-heading"><span class="system-kicker">SaTourN</span><h3>${escapeHtml(entry.value)}</h3><small>${entry.rules.length} Quellzuordnung${entry.rules.length === 1 ? '' : 'en'}</small></div><div class="reverse-systems">${[...systems.entries()].sort(([a], [b]) => naturalSort(systemLabel(data, a), systemLabel(data, b))).map(([system, sources]) => `<details><summary><strong>${escapeHtml(systemLabel(data, system))}</strong><span>${sources.length}</span></summary><ul>${sources.sort((a, b) => naturalSort(a.source.value, b.source.value)).map((rule) => `<li><a href="${escapeHtml(hrefFor({ type, view: 'mapping', dimension, mode: 'source', system, term: rule.id }, true))}" data-nav>${escapeHtml(rule.source.value)}</a>${rule.oneToMany ? '<small> setzt mehrere Zielwerte</small>' : ''}</li>`).join('')}</ul></details>`).join('')}</div></article>`;
  }).join('')}</div>`;
}

function routingView(data, type, rules) {
  if (!rules.length) return '<div class="empty-state"><h2>Kein Routing</h2><p>Für diese Datensatzart gibt es keine bestätigten Routingregeln.</p></div>';
  return `<div class="routing-list">${rules.sort((a, b) => naturalSort(a.source.value, b.source.value)).map((rule) => `<article class="routing-item" id="${escapeHtml(rule.id)}"><span class="system-kicker">${escapeHtml(systemLabel(data, rule.source.system))}</span><h3>${escapeHtml(rule.source.value)}</h3><p>wird als <strong>${escapeHtml(datasetLabel(data, rule.target.datasetType))}</strong> verarbeitet.</p>${ruleNotice(rule)}${details(rule)}</article>`).join('')}</div>`;
}

function fallbackText(rule) {
  if (rule.fallback?.mode === 'passSourceValue') return 'FOREIGNVALUE: Quellwert unverändert übernehmen.';
  if (rule.fallback?.mode === 'literal') return `Fester Fallbackwert: ${rule.fallback.value ?? '–'}.`;
  if (rule.fallback?.mode === 'empty') return 'Leerer Fallback: Es wird kein Wert gesetzt.';
  return 'Fallbackregel';
}

function fallbackView(data, rules) {
  if (!rules.length) return '<div class="empty-state"><h2>Keine Fallbacks</h2><p>Für diese Datensatzart gibt es keine bestätigten Fallbackregeln.</p></div>';
  return `<div class="fallback-list">${rules.sort((a, b) => naturalSort(a.source.value, b.source.value)).map((rule) => `<article class="fallback-item" id="${escapeHtml(rule.id)}"><span class="system-kicker">${escapeHtml(systemLabel(data, rule.source.system))}</span><h3>${escapeHtml(rule.source.value)}</h3><p>${escapeHtml(fallbackText(rule))}</p>${ruleNotice(rule)}${details(rule)}</article>`).join('')}</div>`;
}

function structureView(data, type) {
  const profile = data.sampleProfile[type];
  const fields = data.fields.filter((field) => field.datasetType === type).sort((a, b) => naturalSort(a.field, b.field));
  const vocabulary = data.vocabularies.filter((row) => row.datasetType === type).sort((a, b) => naturalSort(a.field, b.field) || naturalSort(a.value, b.value));
  if (!profile && !fields.length) return '<div class="empty-state"><h2>Keine Beispielstruktur</h2><p>Für diese Datensatzart liegt kein beobachtetes SaTourN-Beispiel vor.</p></div>';
  return `<section class="structure-summary"><p class="notice notice-info"><strong>Beobachtete Struktur</strong><span>Dies sind XML-Felder aus den gelieferten Beispieldaten, keine Importzuordnungen.</span></p>${profile?.sample ? `<p>Beispieldatei: <code>${escapeHtml(profile.sample)}</code></p>` : ''}
    <h2>Felder</h2><div class="poi-directory"><table class="poi-table"><thead><tr><th>Feld</th><th>Vorkommen</th><th>Sprachen</th><th>Beispielwerte</th></tr></thead><tbody>${fields.map((field) => `<tr><td>${escapeHtml(field.field)}</td><td>${escapeHtml(field.occurrences)}</td><td>${escapeHtml(field.languages)}</td><td>${escapeHtml(field.examples)}</td></tr>`).join('')}</tbody></table></div>
    ${vocabulary.length ? `<h2>Beobachtete Vokabulare</h2><div class="poi-directory"><table class="poi-table"><thead><tr><th>Feld</th><th>Wert</th><th>Vorkommen</th></tr></thead><tbody>${vocabulary.map((row) => `<tr><td>${escapeHtml(row.field)}</td><td>${escapeHtml(row.value)}</td><td>${escapeHtml(row.occurrences)}</td></tr>`).join('')}</tbody></table></div>` : ''}</section>`;
}

function datasetView(data, state) {
  const type = data.datasetById.has(state.type) ? state.type : data.datasetTypes.find((item) => item.mappingSourceAvailable)?.id;
  const typeMeta = data.datasetById.get(type);
  if (!type || !typeMeta) return home(data);
  const mappings = activeRules(data, 'mapping').filter((rule) => rule.source.datasetType === type);
  const routing = activeRules(data, 'routing').filter((rule) => rule.target?.datasetType === type);
  const fallbacks = activeRules(data, 'fallback').filter((rule) => rule.source.datasetType === type);
  const hasStructure = Boolean(data.sampleProfile[type] || data.fields.some((field) => field.datasetType === type));
  const allowedViews = ['mapping', routing.length ? 'routing' : null, fallbacks.length ? 'fallback' : null, hasStructure ? 'structure' : null].filter(Boolean);
  const view = allowedViews.includes(state.view) ? state.view : (mappings.length ? 'mapping' : hasStructure ? 'structure' : allowedViews[0]);
  const crumb = breadcrumbs([{ label: 'Start', href: './index.html' }, { label: datasetLabel(data, type) }]);
  const tabs = `<div class="tabs view-tabs" aria-label="Ansicht">${allowedViews.map((id) => link(VIEW_LABELS[id], { type, view: id, dimension: null, system: null, mode: null, term: null }, true, id === view ? 'active' : '')).join('')}</div>`;
  let content;
  if (view === 'mapping') {
    const controls = mappingControls(data, state, mappings, type);
    content = `${controls.html}${controls.mode === 'source' ? sourceList(data, controls.dimensionRules, controls.system) : reverseList(data, controls.dimensionRules, type, controls.dimension)}`;
  } else if (view === 'routing') content = routingView(data, type, routing);
  else if (view === 'fallback') content = fallbackView(data, fallbacks);
  else content = structureView(data, type);
  return `${crumb}<section class="view-heading"><p class="eyebrow">Importe nach SaTourN</p><h1>${escapeHtml(datasetLabel(data, type))}</h1><p>${mappings.length} Mappingregeln im autoritativen Bestand</p></section>${tabs}${content}`;
}

function referenceView(data, state) {
  const odta = state.system === 'odta';
  const crumb = breadcrumbs([{ label: 'Start', href: './index.html' }, { label: 'Referenzen und Zielsysteme' }]);
  if (odta) return `${crumb}<section class="view-heading"><p class="eyebrow">Referenz</p><h1>ODTA</h1><p>ODTA ist als Referenz dokumentiert, nicht als bestätigtes SaTourN-Zielsystem.</p></section><div class="empty-state"><h2>Keine bestätigten Exportregeln</h2><p>Der autoritative Regelbestand enthält keine SaTourN→ODTA-Exportregeln. ODTA-Vokabulare dürfen nicht als Mapping interpretiert werden.</p></div>`;
  const types = data.datasetTypes.filter((type) => data.sampleProfile[type.id] || data.fields.some((field) => field.datasetType === type.id));
  return `${crumb}<section class="view-heading"><p class="eyebrow">Referenz</p><h1>SaTourN-Beispielstruktur</h1><p>Beobachtete XML-Felder, Häufigkeiten, Sprachen und Beispielwerte.</p></section><div class="dataset-grid">${types.map((type) => `<a class="dataset-card" href="${escapeHtml(hrefFor({ type: type.id, view: 'structure' }, true))}" data-nav><span class="dataset-icon" aria-hidden="true">${escapeHtml(type.label.slice(0, 1))}</span><span class="dataset-copy"><strong>${escapeHtml(type.label)}</strong><small>Beobachtete Struktur</small></span><span class="card-arrow" aria-hidden="true">→</span></a>`).join('')}</div>`;
}

function searchView(data, state) {
  const query = state.q?.trim() ?? '';
  const needle = data.fold(query);
  const matches = needle ? data.rules.filter((rule) => data.fold([rule.id, rule.source?.value, rule.source?.system, rule.source?.datasetType, ...(rule.target?.values ?? []), ...(rule.technicalMarkers ?? [])].join(' ')).includes(needle)) : [];
  const visible = matches.slice(0, 100);
  return `${breadcrumbs([{ label: 'Start', href: './index.html' }, { label: 'Suche' }])}<section class="view-heading"><p class="eyebrow">Globale Suche</p><h1>${query ? `Ergebnisse für „${escapeHtml(query)}“` : 'Mappingbestand durchsuchen'}</h1><p>${matches.length} Treffer</p></section>${query && (visible.length ? `<div class="search-results">${visible.map((rule) => {
    const type = rule.source?.datasetType ?? rule.target?.datasetType;
    const view = rule.ruleKind === 'routing' ? 'routing' : rule.ruleKind === 'fallback' ? 'fallback' : 'mapping';
    const href = hrefFor({ type, view, dimension: rule.source?.dimension, system: rule.source?.system, mode: 'source', term: rule.id, q: null }, true);
    return `<a class="search-result" href="${escapeHtml(href)}" data-nav><span class="system-kicker">${escapeHtml(systemLabel(data, rule.source?.system))} · ${escapeHtml(datasetLabel(data, type))}</span><strong>${escapeHtml(rule.source?.value ?? rule.id)}</strong><span>${escapeHtml((rule.target?.values ?? [rule.behavior]).join(' + '))}</span></a>`;
  }).join('')}</div>` : '<div class="empty-state"><h2>Kein Treffer</h2><p>Kein Treffer im autoritativen Bestand.</p></div>')}</div>`;
}

export function render(data, state) {
  if (state.q !== undefined) return searchView(data, state);
  if (state.view === 'reference') return referenceView(data, state);
  if (state.type) return datasetView(data, state);
  return home(data);
}
