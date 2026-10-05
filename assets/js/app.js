import { loadData } from './data.js';
import { navigate, readState, hrefFor } from './router.js';
import { render } from './views.js';
import { bindModel } from './model.js';

const root = document.querySelector('#app');
const searchForm = document.querySelector('[data-search-form]');
const searchInput = searchForm.querySelector('input[name="q"]');
let data;
let filterTimer;

function paint() {
  const state = readState();
  const focused = root.contains(document.activeElement) ? document.activeElement : null;
  const focusId = focused?.id;
  const selection = focused?.tagName === 'INPUT' ? [focused.selectionStart, focused.selectionEnd] : null;
  root.innerHTML = render(data, state);
  bindModel(root, data, state);
  searchInput.value = state.q ?? '';
  document.querySelector('[data-data-stand]').textContent = data.meta.generatedAt ? `Datenstand ${data.meta.generatedAt}` : '';
  document.title = `${root.querySelector('h1')?.textContent ?? 'SaTourN'} – Mapping Hub`;
  const restored = focusId ? document.getElementById(focusId) : null;
  if (restored) {
    restored.focus({ preventScroll: true });
    if (selection && selection[0] !== null) restored.setSelectionRange(...selection);
  }
}

document.addEventListener('click', (event) => {
  const anchor = event.target.closest('a[data-nav]');
  if (!anchor || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  clearTimeout(filterTimer);
  navigate(anchor.href);
  window.scrollTo({ top: 0, behavior: 'auto' });
  root.focus({ preventScroll: true });
});

function applyFilters(form, replace = false) {
  if (!form.isConnected) return;
  const state = Object.fromEntries(new FormData(form));
  navigate(hrefFor(state, true), replace);
}

root.addEventListener('submit', event => {
  if (!event.target.matches('[data-filter-form]')) return;
  event.preventDefault();
  clearTimeout(filterTimer);
  applyFilters(event.target);
});
root.addEventListener('input', event => {
  const form = event.target.closest('[data-filter-form]');
  if (!form || event.target.tagName !== 'INPUT' || event.isComposing) return;
  clearTimeout(filterTimer);
  filterTimer = setTimeout(() => applyFilters(form, true), 160);
});
root.addEventListener('change', event => {
  const form = event.target.closest('[data-filter-form]');
  if (!form || event.target.tagName !== 'SELECT') return;
  clearTimeout(filterTimer);
  applyFilters(form);
});

searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  clearTimeout(filterTimer);
  const query = searchInput.value.trim();
  navigate(`./index.html${query ? `?q=${encodeURIComponent(query)}` : ''}`);
});

window.addEventListener('popstate', () => { clearTimeout(filterTimer); if (data) paint(); });
window.addEventListener('hub:navigate', () => data && paint());

try {
  data = await loadData();
  paint();
} catch (error) {
  console.error(error);
  root.innerHTML = `<div class="error-state"><h1>Mappingdaten konnten nicht geladen werden</h1><p>Bitte die Seite neu laden. Falls der Fehler bestehen bleibt, ist eine Datendatei nicht erreichbar oder fehlerhaft.</p><button type="button" onclick="location.reload()">Neu laden</button></div>`;
}
