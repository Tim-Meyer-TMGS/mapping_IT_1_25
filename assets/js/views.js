import { hrefFor } from './router.js';

const DIMENSION_LABELS = {
  category: 'Kategorien', feature: 'Merkmale', field: 'Felder', textField: 'Textfelder',
  checkbox: 'Checkboxen', value: 'Werte', other: 'Weitere',
};

const BEHAVIOR_LABELS = {
  noTarget: 'ohne Zuordnung', noImport: 'nicht übernehmen', fallback: 'Fallback',
  passthrough: 'unverändert übernehmen', unknown: 'ungeklärt',
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  })[character]);
}

function naturalSort(a, b) {
  return String(a).localeCompare(String(b), 'de', { sensitivity: 'base', numeric: true });
}

function systemLabel(data, id) {
  return data.systemById.get(id)?.label ?? id;
}

function datasetLabel(data, id) {
  return data.datasetById.get(id)?.label ?? id;
}

function link(label, changes, replace = false, className = '') {
  return `<a class="${className}" href="${escapeHtml(hrefFor(changes, replace))}" data-nav>${escapeHtml(label)}</a>`;
}

function breadcrumb(items) {
  return `<nav class="breadcrumb" aria-label="Brotkrümelnavigation">${items.map((item, index) => {
    const content = item.href ? `<a href="${escapeHtml(item.href)}" data-nav>${escapeHtml(item.label)}</a>` : `<span aria-current="page">${escapeHtml(item.label)}</span>`;
    return `${index ? '<span aria-hidden="true">›</span>' : ''}${content}`;
  }).join('')}</nav>`;
}

function behaviorBadge(mapping) {
  const label = BEHAVIOR_LABELS[mapping.behavior];
  return label ? `<span class="status status-${escapeHtml(mapping.behavior)}">${escapeHtml(label)}</span>` : '';
}

function details(mapping, data) {
  const rows = [
    ['Regel-ID', mapping.id],
    ['Quellsystem', systemLabel(data, mapping.source.system)],
    ['Quell-Datentyp', mapping.source.datasetType],
    ['Dimension', DIMENSION_LABELS[mapping.source.dimension] ?? mapping.source.dimension],
    ['Schlüsseltyp', mapping.source.keyType],
    ['Technischer Schlüssel', mapping.source.key],
    ['Sprache', mapping.source.language],
    ['Verhalten', mapping.behavior],
    ['Quellzeile', mapping.provenance?.sourceLine],
  ].filter(([, value]) => value !== null && value !== undefined);
  return `<details class="technical-details"${mapping.id === new URLSearchParams(location.search).get('term') ? ' open' : ''}>
    <summary>Technische Details</summary>
    <dl>${rows.map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>
    ${mapping.provenance?.raw ? `<details class="raw"><summary>Rohmapping anzeigen</summary><pre>${escapeHtml(mapping.provenance.raw)}</pre></details>` : ''}
  </details>`;
}

function scopedNotices(data, state) {
  const notices = data.notices.filter((notice) => {
    const scope = notice.scope ?? {};
    if (scope.system && state.system && scope.system !== state.system) return false;
    if (scope.system && !state.system && scope.system !== 'odta') return false;
    if (scope.datasetType && state.type) {
      const aliases = data.datasetById.get(state.type)?.sourceAliases ?? [];
      if (scope.datasetType !== state.type && !aliases.includes(scope.datasetType)) return false;
    }
    return !scope.system || scope.system === state.system;
  });
  if (!notices.length) return '';
  return `<div class="notices">${notices.map((notice) => `<aside class="notice notice-${escapeHtml(notice.status)}">
    <strong>${escapeHtml(notice.title)}</strong><span>${escapeHtml(notice.text)}</span>
  </aside>`).join('')}</div>`;
}

function home(data) {
  const inbound = data.mappings.filter((mapping) => mapping.direction === 'inbound' && mapping.datasetTypeId);
  const cards = data.datasetTypes.map((type) => {
    const rules = inbound.filter((mapping) => mapping.datasetTypeId === type.id);
    if (!rules.length) return '';
    const systems = [...new Set(rules.map((mapping) => mapping.source.system))]
      .sort((a, b) => (data.systemById.get(a)?.sortOrder ?? 999) - (data.systemById.get(b)?.sortOrder ?? 999));
    return `<a class="dataset-card" href="${escapeHtml(hrefFor({ direction: 'inbound', type: type.id }, true))}" data-nav>
      <span class="dataset-icon" aria-hidden="true">${escapeHtml(type.label.slice(0, 1))}</span>
      <span class="dataset-copy"><strong>${escapeHtml(type.label)}</strong><small>${systems.map((id) => escapeHtml(systemLabel(data, id))).join(' · ')}</small></span>
      <span class="card-count">${rules.length}<small>Zuordnungen</small></span><span class="card-arrow" aria-hidden="true">→</span>
    </a>`;
  }).join('');
  return `<section class="hero"><p class="eyebrow">Aktueller Mappingstandard</p><h1>Was wird wie zugeordnet?</h1><p>Datensatzart auswählen und Zuordnungen aus Quell- oder SaTourN-Sicht nachschlagen.</p></section>
    <section aria-labelledby="imports-title"><div class="section-heading"><div><p class="eyebrow">Quellsysteme → SaTourN</p><h2 id="imports-title">Importe nach SaTourN</h2></div><span>${inbound.length} Regeln</span></div><div class="dataset-grid">${cards}</div></section>
    <section class="export-section" aria-labelledby="export-title"><div class="section-heading"><div><p class="eyebrow">SaTourN → Zielsystem</p><h2 id="export-title">Export aus SaTourN</h2></div></div>
      <a class="dataset-card export-card" href="${escapeHtml(hrefFor({ direction: 'outbound', system: 'odta' }, true))}" data-nav>
        <span class="dataset-icon" aria-hidden="true">O</span><span class="dataset-copy"><strong>ODTA</strong><small>SaTourN → ODTA</small></span><span class="status status-open">Datenquelle offen</span><span class="card-arrow" aria-hidden="true">→</span>
      </a></section>`;
}

function navigationControls(data, state, rules) {
  const dimensions = [...new Set(rules.map((mapping) => mapping.source.dimension))].sort();
  const dimension = dimensions.includes(state.dimension) ? state.dimension : dimensions[0];
  const dimensionRules = rules.filter((mapping) => mapping.source.dimension === dimension);
  const systems = [...new Set(dimensionRules.map((mapping) => mapping.source.system))]
    .sort((a, b) => (data.systemById.get(a)?.sortOrder ?? 999) - (data.systemById.get(b)?.sortOrder ?? 999));
  const mode = state.mode === 'satourn' ? 'satourn' : 'source';
  const system = systems.includes(state.system) ? state.system : systems[0];
  return { dimensions, dimension, dimensionRules, systems, mode, system, html: `
    <div class="tabs" aria-label="Informationsart">${dimensions.map((id) => link(DIMENSION_LABELS[id] ?? id, { dimension: id, system: null, term: null }, false, id === dimension ? 'active' : '')).join('')}</div>
    <div class="toolbar"><div class="segmented" aria-label="Leserichtung">
      ${link('Quellsystem → SaTourN', { mode: 'source', system: system, term: null }, false, mode === 'source' ? 'active' : '')}
      ${link('SaTourN → Quellsysteme', { mode: 'satourn', system: null, term: null }, false, mode === 'satourn' ? 'active' : '')}
    </div>${mode === 'source' ? `<div class="system-filter" aria-label="Quellsystem">${systems.map((id) => link(systemLabel(data, id), { system: id, term: null }, false, id === system ? 'active' : '')).join('')}</div>` : ''}</div>`, };
}

function sourceList(data, rules, state) {
  const visible = rules.filter((mapping) => mapping.source.system === state.system)
    .sort((a, b) => naturalSort(a.source.label ?? a.source.key, b.source.label ?? b.source.key));
  if (!visible.length) return '<div class="empty-state"><h2>Keine Zuordnungen</h2><p>Für diese Auswahl sind im aktuellen Mappingstand keine Zuordnungen hinterlegt.</p></div>';
  return `<div class="mapping-list">${visible.map((mapping) => `<article class="mapping-item" id="${escapeHtml(mapping.id)}">
    <div class="mapping-main"><div class="source-value"><span class="system-kicker">${escapeHtml(systemLabel(data, mapping.source.system))}</span><h3>${escapeHtml(mapping.source.label ?? mapping.source.key)}</h3>${behaviorBadge(mapping)}</div>
      <span class="mapping-arrow" aria-hidden="true">→</span><div class="target-values">${mapping.targets.length ? mapping.targets.map((target) => `<span>${escapeHtml(target.label ?? target.key)}</span>`).join('') : `<span class="muted">Kein Zielwert</span>`}</div></div>
    ${mapping.display?.note ? `<p class="mapping-note">${escapeHtml(mapping.display.note)}</p>` : ''}${details(mapping, data)}
  </article>`).join('')}</div>`;
}

function poiValueMatches(mapping, value) {
  if (value.startsWith('__mapping:')) return mapping.id === value.slice('__mapping:'.length);
  if (value.startsWith('__behavior:')) {
    return mapping.targets.length === 0 && mapping.behavior === value.slice('__behavior:'.length);
  }
  return mapping.targets.some((target) => (target.label ?? target.key) === value);
}

function poiControls(data, state, rules) {
  const dimensions = ['category', 'feature'].filter((dimension) => rules.some((mapping) => mapping.source.dimension === dimension));
  const dimension = dimensions.includes(state.dimension) ? state.dimension : dimensions[0];
  const dimensionRules = rules.filter((mapping) => mapping.source.dimension === dimension);
  const selectedRules = state.value ? dimensionRules.filter((mapping) => poiValueMatches(mapping, state.value)) : dimensionRules;
  const systems = [...new Set(selectedRules.map((mapping) => mapping.source.system))]
    .sort((a, b) => (data.systemById.get(a)?.sortOrder ?? 999) - (data.systemById.get(b)?.sortOrder ?? 999));
  const system = systems.includes(state.system) ? state.system : systems[0];
  const mode = state.mode === 'satourn' ? 'satourn' : 'source';
  const toolbar = state.value ? `<div class="toolbar"><div class="segmented" aria-label="Leserichtung">
      ${link('Quellsystem → SaTourN', { mode: 'source', system: system, term: null }, false, mode === 'source' ? 'active' : '')}
      ${link('SaTourN → Quellsysteme', { mode: 'satourn', system: null, term: null }, false, mode === 'satourn' ? 'active' : '')}
    </div>${mode === 'source' ? `<div class="system-filter" aria-label="Quellsystem">${systems.map((id) => link(systemLabel(data, id), { system: id, term: null }, false, id === system ? 'active' : '')).join('')}</div>` : ''}</div>` : '';
  return {
    dimension, dimensionRules, selectedRules, system, mode,
    html: `<div class="tabs" aria-label="POI-Mappingdimension">${dimensions.map((id) => link(DIMENSION_LABELS[id] ?? id, { dimension: id, system: null, value: null, term: null }, false, id === dimension ? 'active' : '')).join('')}</div>${toolbar}`,
  };
}

function poiDirectory(data, rules, dimension) {
  const groups = new Map();
  for (const mapping of rules) {
    const targets = mapping.targets.length
      ? mapping.targets.map((target) => ({ key: target.label ?? target.key, label: target.label ?? target.key }))
      : [{ key: `__behavior:${mapping.behavior}`, label: BEHAVIOR_LABELS[mapping.behavior] ?? 'Ohne Zielwert' }];
    for (const target of targets) {
      if (!groups.has(target.key)) groups.set(target.key, { ...target, mappings: new Map() });
      groups.get(target.key).mappings.set(mapping.id, mapping);
    }
  }
  const rows = [...groups.values()].sort((a, b) => naturalSort(a.label, b.label));
  if (!rows.length) return '<div class="empty-state"><h2>Keine POI-Zuordnungen</h2><p>Für diese Dimension sind keine Zuordnungen hinterlegt.</p></div>';
  return `<div class="poi-directory"><table class="poi-table"><thead><tr><th>${dimension === 'category' ? 'SaTourN-Kategorie' : 'SaTourN-Merkmal'}</th><th>Quellzuordnungen</th><th>Quellsysteme</th></tr></thead><tbody>${rows.map((group) => {
    const mappings = [...group.mappings.values()];
    const systems = [...new Set(mappings.map((mapping) => mapping.source.system))]
      .sort((a, b) => (data.systemById.get(a)?.sortOrder ?? 999) - (data.systemById.get(b)?.sortOrder ?? 999));
    return `<tr><td>${link(group.label, { value: group.key, system: null, term: null }, false, 'poi-value-link')}</td><td>${mappings.length}</td><td>${systems.map((id) => escapeHtml(systemLabel(data, id))).join(' · ')}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function poiMappingTable(data, rules, state) {
  const visible = rules.filter((mapping) => mapping.source.system === state.system)
    .sort((a, b) => naturalSort(a.source.label ?? a.source.key, b.source.label ?? b.source.key));
  if (!visible.length) return '<div class="empty-state"><h2>Keine Zuordnungen</h2><p>Für diese Auswahl sind keine Zuordnungen hinterlegt.</p></div>';
  return `<div class="poi-directory poi-mapping-table"><table class="poi-table"><thead><tr><th>Quellsystem</th><th>Quellwert</th><th>SaTourN-Zielwerte</th><th>Regel</th></tr></thead><tbody>${visible.map((mapping) => `<tr>
    <td>${escapeHtml(systemLabel(data, mapping.source.system))}</td>
    <td><strong>${escapeHtml(mapping.source.label ?? mapping.source.key)}</strong></td>
    <td>${mapping.targets.length ? mapping.targets.map((target) => escapeHtml(target.label ?? target.key)).join(' · ') : '<span class="muted">Kein Zielwert</span>'}</td>
    <td>${behaviorBadge(mapping)}${mapping.display?.note ? `<small class="poi-rule-note">${escapeHtml(mapping.display.note)}</small>` : ''}${details(mapping, data)}</td>
  </tr>`).join('')}</tbody></table></div>`;
}

function poiView(data, state, rules) {
  const termMapping = rules.find((mapping) => mapping.id === state.term);
  const value = state.value ?? (termMapping ? `__mapping:${termMapping.id}` : null);
  const controls = poiControls(data, { ...state, value }, rules);
  const selected = Boolean(value);
  const groupLabel = value?.startsWith('__behavior:')
    ? BEHAVIOR_LABELS[value.slice('__behavior:'.length)] ?? 'Ohne Zielwert'
    : value?.startsWith('__mapping:') ? termMapping?.source.label ?? termMapping?.source.key : value;
  const crumb = breadcrumb([
    { label: 'Start', href: './index.html' }, { label: 'Importe' }, { label: 'POI' },
    ...(selected ? [{ label: DIMENSION_LABELS[controls.dimension] ?? controls.dimension, href: hrefFor({ value: null, system: null, term: null }) }, { label: groupLabel }] : [{ label: DIMENSION_LABELS[controls.dimension] ?? controls.dimension }]),
  ]);
  const selectedRules = selected ? controls.selectedRules : [];
  const systemRules = controls.mode === 'source'
    ? selectedRules.filter((mapping) => mapping.source.system === controls.system)
    : selectedRules;
  const viewState = { ...state, type: 'poi', dimension: controls.dimension, system: controls.system };
  return `${crumb}<section class="view-heading"><p class="eyebrow">Importe nach SaTourN</p><h1>POI</h1><p>${rules.length} Zuordnungen im aktuellen Mappingstand</p></section>
    ${controls.html}${selected ? `<div class="poi-detail-heading"><h2>${escapeHtml(groupLabel)}</h2>${link('Zur Übersicht', { value: null, system: null, term: null }, false, 'poi-back-link')}</div>` : ''}
    ${scopedNotices(data, viewState)}
    ${selected
      ? (controls.mode === 'source' ? poiMappingTable(data, systemRules, viewState) : reverseList(data, systemRules))
      : poiDirectory(data, controls.dimensionRules, controls.dimension)}
    ${!selected ? '<p class="poi-scope-note">Für POI sind derzeit Kategorien und Merkmale gemappt. Feldzuordnungen wie Name oder URL sind in der geladenen Datenbasis nicht enthalten.</p>' : ''}`;
}

function reverseList(data, rules) {
  const targets = new Map();
  for (const mapping of rules) {
    for (const target of mapping.targets) {
      const key = [target.datasetType, target.dimension, target.key, target.label, target.language].join('\u0000');
      if (!targets.has(key)) targets.set(key, { target, mappings: [] });
      targets.get(key).mappings.push(mapping);
    }
  }
  const groups = [...targets.values()].sort((a, b) => naturalSort(a.target.label ?? a.target.key, b.target.label ?? b.target.key));
  if (!groups.length) return '<div class="empty-state"><h2>Keine Zielwerte</h2><p>Für diese Auswahl sind keine SaTourN-Zielwerte hinterlegt.</p></div>';
  return `<div class="reverse-list">${groups.map((group) => {
    const bySystem = new Map();
    for (const mapping of group.mappings) {
      if (!bySystem.has(mapping.source.system)) bySystem.set(mapping.source.system, []);
      bySystem.get(mapping.source.system).push(mapping);
    }
    const systemGroups = [...bySystem].sort((a, b) => (data.systemById.get(a[0])?.sortOrder ?? 999) - (data.systemById.get(b[0])?.sortOrder ?? 999));
    return `<article class="reverse-item"><div class="reverse-heading"><span class="system-kicker">SaTourN</span><h3>${escapeHtml(group.target.label ?? group.target.key)}</h3><small>${group.mappings.length} Quellzuordnung${group.mappings.length === 1 ? '' : 'en'}</small></div>
      <div class="reverse-systems">${systemGroups.map(([system, mappings]) => `<details><summary><strong>${escapeHtml(systemLabel(data, system))}</strong><span>${mappings.length}</span></summary><ul>${mappings.sort((a, b) => naturalSort(a.source.label, b.source.label)).map((mapping) => `<li><a href="${escapeHtml(hrefFor({ mode: 'source', system, term: mapping.id }))}" data-nav>${escapeHtml(mapping.source.label ?? mapping.source.key)}</a>${mapping.targets.length > 1 ? '<small>setzt mehrere Werte</small>' : ''}</li>`).join('')}</ul></details>`).join('')}</div></article>`;
  }).join('')}</div>`;
}

function inboundView(data, state) {
  const type = data.datasetById.has(state.type) ? state.type : data.datasetTypes.find((item) => data.mappings.some((mapping) => mapping.datasetTypeId === item.id))?.id;
  const rules = data.mappings.filter((mapping) => mapping.direction === 'inbound' && mapping.datasetTypeId === type);
  if (!type || !rules.length) return home(data);
  const controls = navigationControls(data, state, rules);
  const normalizedState = { ...state, type, dimension: controls.dimension, mode: controls.mode, system: controls.system };
  const crumb = breadcrumb([
    { label: 'Start', href: './index.html' }, { label: 'Importe' }, { label: datasetLabel(data, type) },
    { label: DIMENSION_LABELS[controls.dimension] ?? controls.dimension },
    { label: controls.mode === 'source' ? systemLabel(data, controls.system) : 'SaTourN-Sicht' },
  ]);
  return `${crumb}<section class="view-heading"><p class="eyebrow">Importe nach SaTourN</p><h1>${escapeHtml(datasetLabel(data, type))}</h1><p>${rules.length} Zuordnungen im aktuellen Mappingstand</p></section>
    ${controls.html}${scopedNotices(data, normalizedState)}
    ${controls.mode === 'source' ? sourceList(data, controls.dimensionRules, normalizedState) : reverseList(data, controls.dimensionRules)}`;
}

function outboundView(data, state) {
  const rules = data.mappings.filter((mapping) => mapping.direction === 'outbound');
  const crumb = breadcrumb([{ label: 'Start', href: './index.html' }, { label: 'Export' }, { label: 'ODTA' }]);
  return `${crumb}<section class="view-heading"><p class="eyebrow">Export aus SaTourN</p><h1>SaTourN → ODTA</h1><p>Exportzuordnungen werden getrennt von den Importen dargestellt.</p></section>
    ${scopedNotices(data, { ...state, system: 'odta' })}
    ${rules.length ? sourceList(data, rules, { ...state, system: 'satourn' }) : '<div class="empty-state"><h2>Noch keine Exportregeln veröffentlicht</h2><p>Die gelieferte Datenbasis enthält derzeit keinen belastbaren SaTourN→ODTA-Mappingbestand. Der vorhandene ODTA-Wertekatalog wird nicht als Zuordnung interpretiert.</p></div>'}`;
}

function searchView(data, state) {
  const query = state.q?.trim() ?? '';
  const folded = data.fold(query);
  const matches = folded ? data.mappings.filter((mapping) => {
    const values = [mapping.id, mapping.source.key, mapping.source.label, ...mapping.targets.flatMap((target) => [target.key, target.label])];
    return values.some((value) => data.fold(value).includes(folded));
  }).sort((a, b) => naturalSort(a.source.label, b.source.label)) : [];
  const visible = matches.slice(0, 100);
  return `${breadcrumb([{ label: 'Start', href: './index.html' }, { label: 'Suche' }])}<section class="view-heading"><p class="eyebrow">Globale Suche</p><h1>${query ? `Ergebnisse für „${escapeHtml(query)}“` : 'Mappings durchsuchen'}</h1><p>${matches.length} Treffer im aktuellen Mappingstand</p></section>
    ${query ? (visible.length ? `<div class="search-results">${visible.map((mapping) => {
      const type = mapping.datasetTypeId;
      const targetLabels = mapping.targets.map((target) => target.label ?? target.key).filter(Boolean);
      const href = hrefFor({ direction: mapping.direction, type, dimension: mapping.source.dimension, mode: 'source', system: mapping.source.system, term: mapping.id, q: null }, true);
      return `<a class="search-result" href="${escapeHtml(href)}" data-nav><span class="system-kicker">${escapeHtml(systemLabel(data, mapping.source.system))} · ${escapeHtml(datasetLabel(data, type))}</span><strong>${escapeHtml(mapping.source.label ?? mapping.source.key)}</strong><span>${targetLabels.length ? `→ ${escapeHtml(targetLabels.join(' + '))}` : BEHAVIOR_LABELS[mapping.behavior] ?? ''}</span></a>`;
    }).join('')}</div>${matches.length > visible.length ? `<p class="result-limit">Die ersten ${visible.length} Treffer werden angezeigt. Bitte Suche weiter eingrenzen.</p>` : ''}` : '<div class="empty-state"><h2>Kein Treffer</h2><p>Kein Treffer im aktuellen Mappingstand.</p></div>') : ''}`;
}

export function render(data, state) {
  if (state.q !== undefined) return searchView(data, state);
  if (state.direction === 'outbound') return outboundView(data, state);
  if (state.type === 'poi') {
    const rules = data.mappings.filter((mapping) => mapping.direction === 'inbound' && mapping.datasetTypeId === 'poi');
    return poiView(data, state, rules);
  }
  if (state.direction === 'inbound' || state.type) return inboundView(data, state);
  return home(data);
}
