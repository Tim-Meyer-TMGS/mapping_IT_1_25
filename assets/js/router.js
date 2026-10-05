const ALLOWED = ['type', 'view', 'dimension', 'mode', 'system', 'field', 'term', 'q', 'filter', 'group', 'source', 'target', 'page', 'from', 'valueFilter', 'valuePage', 'ruleFilter', 'rulePage'];

export function readState() {
  const params = new URLSearchParams(window.location.search);
  const state = {};
  for (const key of ALLOWED) {
    const value = params.get(key);
    if (value) state[key] = value;
  }
  if (!state.view && params.get('direction') === 'inbound') state.view = 'mapping';
  if (!state.dimension && ['category', 'feature'].includes(params.get('property'))) state.dimension = params.get('property');
  if (['model', 'structure'].includes(state.view)) state.view = 'fields';
  return state;
}

export function hrefFor(changes = {}, replace = false) {
  const state = { ...(replace ? {} : readState()), ...changes };
  const params = new URLSearchParams();
  for (const key of ALLOWED) if (state[key]) params.set(key, state[key]);
  const query = params.toString();
  return `./index.html${query ? `?${query}` : ''}`;
}

export function navigate(href, useReplace = false) {
  const url = new URL(href, window.location.href);
  window.history[useReplace ? 'replaceState' : 'pushState']({}, '', `${url.pathname}${url.search}${url.hash}`);
  window.dispatchEvent(new CustomEvent('hub:navigate'));
}

// Keep the originating selection across detail pages without nesting URLs.
export function withOrigin(destination, origin) {
  if (!origin) return destination;
  const from = origin.from || hrefFor({ ...origin, from: null }, true).split('?')[1];
  return { ...destination, from };
}

export function originState(state) {
  if (!state.from) return null;
  const params = new URLSearchParams(state.from);
  const origin = {};
  for (const key of ALLOWED) {
    if (key !== 'from' && params.get(key)) origin[key] = params.get(key);
  }
  return Object.keys(origin).length ? origin : null;
}
