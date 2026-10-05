import { navigate, hrefFor } from '../assets/js/router.js';

const errors = [];
window.addEventListener('error', event => errors.push(event.message));
window.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
const pause = () => new Promise(resolve => setTimeout(resolve, 60));
const require = (condition, message) => { if (!condition) throw Error(message); };
const waitFor = async (condition, message) => {
  for (let i = 0; i < 80 && !condition(); i++) await pause();
  require(condition(), message);
};
const go = state => navigate(hrefFor(state, true));
const root = () => document.querySelector('#app');
const text = () => root().textContent;
const clickLink = (selector, label) => {
  const anchor = root().querySelector(selector);
  require(anchor, label); anchor.click();
};
const typeInto = async (name, value) => {
  const input = document.querySelector(`input:not([type="hidden"])[name="${name}"]`);
  require(input, name); input.focus(); input.value = value; input.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 220));
};
async function run() {
try {
  const scenario = globalThis.hubTestScenario ?? 'interactive';
  if (scenario !== 'interactive') {
    await waitFor(() => root().querySelector('h1'), 'Direkte Seite laden');
    if (scenario === 'field') require(root().querySelector('h1').textContent === 'Kategorie' && text().includes('Eingehende Mappings'), 'Feld-Deep-Link beim Start');
    if (scenario === 'rule') require(root().querySelector('h1').textContent === 'Reiten' && root().querySelector('.mapping-detail') && !root().querySelector('.technical-details').open, 'Regel-Deep-Link beim Start');
    if (scenario === 'overview') require(text().includes('307 verfügbare Felder') && !root().querySelector('.mapping-table'), 'HTML-Weiterleitung zur Übersicht');
    if (scenario === 'guide') require(text().includes('Dokumentierte Zuordnung') && text().includes('Kategorie') && document.documentElement.scrollWidth <= innerWidth, 'Geführter Direktlink ohne Überlauf');
    require(errors.length === 0, 'Keine Fehler beim direkten Laden');
    document.documentElement.dataset.browserTest = 'passed';
    return;
  }
  await waitFor(() => root().querySelector('table'), 'Startseite laden');
  require(root().querySelectorAll('tbody tr').length === 8, 'Alle Datensatzarten');
  clickLink('a[href*="view=guide"]', 'Geführten Einstieg öffnen');
  await typeInto('source', 'Reiten');
  if (document.querySelector('#filter-type')) {
    document.querySelector('#filter-type').value = 'poi';
    document.querySelector('#filter-type').dispatchEvent(new Event('change', { bubbles: true }));
  }
  require(text().includes('Dokumentierte Zuordnung') && text().includes('Kategorie'), 'Geführte Zuordnung ohne bekanntes System');
  require(document.documentElement.scrollWidth <= innerWidth, 'Geführte Suche ohne Überlauf');
  clickLink('.guide-result a[href*="term="]', 'Regel aus geführter Suche');
  clickLink('[data-return]', 'Zurück zur geführten Suche');
  require(new URLSearchParams(location.search).get('view') === 'guide', 'Geführten Ursprung erhalten');
  await typeInto('source', 'unbekannt-987654321');
  require(text().includes('Keine passende Regel dokumentiert'), 'Keine erfundene Zuordnung');
  go({});
  clickLink('a[href="./index.html?type=poi"]', 'POI öffnen');
  require(text().includes('307 verfügbare Felder') && text().includes('503 aktive Mappingregeln'), 'POI-Übersicht');
  require(!root().querySelector('.mapping-table'), 'Übersicht statt Mappingliste');
  clickLink('.section-nav a[href*="view=fields"]', 'Datenfelder öffnen');
  require(root().querySelectorAll('.field-table tbody tr').length === 307, 'Alle POI-Felder');
  await typeInto('filter', 'öffnung');
  require(text().includes('OBJECT_OEFFNUNGSZEITEN'), 'Feldsuche Öffnung');
  require(document.activeElement.id === 'filter-filter', 'Suchfokus bleibt erhalten');
  await typeInto('filter', 'nichts-987654321');
  require(text().includes('Keine Felder passen'), 'Leere Feldsuche');
  go({ type: 'poi', view: 'fields' });
  document.querySelector('#filter-group').value = 'prices';
  document.querySelector('#filter-group').dispatchEvent(new Event('change', { bubbles: true }));
  require(text().includes('PRICE_ADULT') && !text().includes('OBJECT_CONTACT_EMAIL'), 'Bereichfilter');

  // Global search via the real search form.
  document.querySelector('#global-search').value = 'OBJECT_CONTACT_EMAIL';
  document.querySelector('[data-search-form]').requestSubmit();
  require(root().querySelector('.field-table'), 'Globale Suche findet Datenfelder');
  clickLink('a[href*="type=poi"][href*="field=OBJECT_CONTACT_EMAIL"]', 'Feldtreffer öffnen');
  require(root().querySelector('h1').textContent === 'OBJECT_CONTACT_EMAIL', 'Feld geöffnet');
  document.querySelector('#global-search').value = 'Reiten';
  document.querySelector('[data-search-form]').requestSubmit();
  require(text().includes('SaTourN') && text().includes('Feld:') && text().includes('Kategorie') && text().includes('Wert:'), 'Reiten fachlich nachvollziehbar');
  require(!text().includes('at least one POI') && !text().includes('AH67-T366'), 'Keine internen Notizen in Suchtreffern');
  clickLink('a[href*="group=values"]', 'Feldwerttreffer');
  require(text().includes('FELDWERT') && text().includes('Reiten'), 'Feldwerte gefunden');

  go({ type: 'poi', view: 'mapping' });
  require(root().querySelectorAll('.mapping-table tbody tr').length === 100, 'Kompakte Mappingliste');
  require(root().querySelector('.pagination'), 'Alle Regeln über Seiten erreichbar');
  require(!root().querySelector('.advanced-filters').open, 'Zusatzfilter anfangs geschlossen');
  root().querySelector('.advanced-filters summary').click();
  await typeInto('source', 'Reiten');
  document.querySelector('#filter-system').value = 'outdooractive';
  document.querySelector('#filter-system').dispatchEvent(new Event('change', { bubbles: true }));
  require(root().querySelectorAll('tbody tr').length === 1 && text().includes('Kategorie'), 'Mappingfilter');
  clickLink('a[href*="term=map-outdooractive-poi-category-reiten"]', 'Mappingdetails');
  require(text().includes('Quelle') && text().includes('Ziel'), 'Quelle / Ziel in Details');
  const returnParams = new URL(root().querySelector('[data-return]').href).searchParams;
  require(returnParams.get('system') === 'outdooractive' && returnParams.get('source') === 'Reiten', 'Mapping-Rücklink erhält Filter');
  require(!root().querySelector('.technical-details').open, 'Technische Details geschlossen');
  root().querySelector('.technical-details > summary').click();
  require(root().querySelector('.technical-details').open && text().includes('Interner Prüfhinweis'), 'Technische Details öffnen');
  root().querySelector('.provenance > summary').click();
  require(text().includes('Zeile 736'), 'Provenienz');
  root().querySelector('.provenance details summary').click();
  require(root().querySelector('pre').textContent.includes('CategoryMapping'), 'Rohtext');
  clickLink('.mapping-detail a[href*="field=Kategorie"]', 'Mapping zu Feld');
  require(root().querySelector('h1').textContent === 'Kategorie' && text().includes('Eingehende Mappings'), 'Felddetails');
  require(root().querySelectorAll('.field-values li').length <= 30 && root().querySelectorAll('.mapping-table tbody tr').length <= 30, 'Felddetails begrenzt');
  await typeInto('valueFilter', 'Reiten');
  await typeInto('ruleFilter', 'Reiten');
  require(text().includes('Reiten') && text().includes('DAMAS') && text().includes('Outdooractive'), 'Feldwerte und Quellen durchsuchbar');
  require(document.querySelector('#filter-valueFilter').value === 'Reiten', 'Unabhängige Suchfilter bleiben erhalten');
  clickLink('[data-return]', 'Zurück zur ursprünglichen Auswahl');
  require(document.querySelector('#filter-source').value === 'Reiten' && document.querySelector('#filter-system').value === 'outdooractive', 'Filter nach Mapping und Feld erhalten');
  history.back();
  await waitFor(() => root().querySelector('h1').textContent === 'Kategorie', 'Zurück zum Zielfeld');
  history.back();
  await waitFor(() => new URLSearchParams(location.search).has('term'), 'Browser Zurück');
  require(root().querySelector('h1').textContent === 'Reiten', 'Zurück rendert Mapping');
  history.forward();
  await waitFor(() => root().querySelector('h1').textContent === 'Kategorie', 'Browser Vorwärts');
  clickLink('a[href*="view=mapping&field=Kategorie"]', 'Feld zu Mappings');
  require(document.querySelector('#filter-field').value === 'Kategorie', 'Zielfeldfilter erhalten');
  go({ type: 'poi', view: 'structure', field: 'Kategorie' });
  require(root().querySelector('h1').textContent === 'Kategorie', 'Alter Struktur-Deep-Link');
  go({ type: 'tour' });
  require(text().includes('0 verfügbare Felder'), 'Datensatz ohne Feldkatalog');
  go({ type: 'poi', view: 'fields' });
  let exported;
  const create = URL.createObjectURL;
  URL.createObjectURL = blob => { exported = blob; return create(blob); };
  const anchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function() { if (!this.download) anchorClick.call(this); };
  document.querySelector('[data-export-spec]').click();
  const exportedText = await exported.text();
  require(JSON.parse(exportedText)['@graph'].length === 8, 'Export vollständig');
  require(!/hub:observations|hub:observedValues|"examples"/.test(exportedText), 'Keine Testwerte im Export');
  HTMLAnchorElement.prototype.click = anchorClick;
  require(!performance.getEntriesByType('resource').some(entry => /satourn-observed|satourn-sample|sample-validation/.test(entry.name)), 'Keine Testdaten laden');
  require(document.documentElement.scrollWidth <= innerWidth, 'Feldkatalog ohne Seitenüberlauf');
  go({ type: 'poi', view: 'mapping' });
  require(document.documentElement.scrollWidth <= innerWidth, 'Mappingliste ohne Seitenüberlauf');
  if (innerWidth > 760) require([...root().querySelectorAll('tbody tr')].filter(row => row.getBoundingClientRect().bottom < innerHeight).length >= 6, 'Informationsdichte Desktop');
  require(errors.length === 0, 'JavaScript-Fehler: ' + errors.join(', '));
  document.documentElement.dataset.browserTest = 'passed';
} catch (error) { document.documentElement.dataset.browserTest = error.message; }
}
await run();
