import { loadData } from './data.js';
import { navigate, readState } from './router.js';
import { render } from './views.js';

const root = document.querySelector('#app');
const searchForm = document.querySelector('[data-search-form]');
const searchInput = searchForm.querySelector('input[name="q"]');
let data;

function paint() {
  const state = readState();
  root.innerHTML = render(data, state);
  searchInput.value = state.q ?? '';
  document.querySelector('[data-data-stand]').textContent = data.meta.sourceDate ? `Datenstand ${data.meta.sourceDate}` : '';
  document.title = state.q ? `Suche: ${state.q} – SaTourN Mapping Hub` : 'SaTourN Mapping Hub';
  const selected = state.term ? document.getElementById(state.term) : null;
  if (selected) requestAnimationFrame(() => selected.scrollIntoView({ behavior: 'smooth', block: 'center' }));
}

document.addEventListener('click', (event) => {
  const anchor = event.target.closest('a[data-nav]');
  if (!anchor || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate(anchor.href);
  window.scrollTo({ top: 0, behavior: 'auto' });
});

searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const query = searchInput.value.trim();
  navigate(`./index.html${query ? `?q=${encodeURIComponent(query)}` : ''}`);
});

window.addEventListener('popstate', () => data && paint());
window.addEventListener('hub:navigate', () => data && paint());

try {
  data = await loadData();
  paint();
} catch (error) {
  console.error(error);
  root.innerHTML = `<div class="error-state"><h1>Mappingdaten konnten nicht geladen werden</h1><p>Bitte die Seite neu laden. Falls der Fehler bestehen bleibt, ist eine Datendatei nicht erreichbar oder fehlerhaft.</p><button type="button" onclick="location.reload()">Neu laden</button></div>`;
}
