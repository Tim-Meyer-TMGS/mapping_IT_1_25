const ALLOWED = ['direction', 'type', 'node', 'property', 'dimension', 'mode', 'system', 'term', 'value', 'q'];

export function readState() {
  const params = new URLSearchParams(window.location.search);
  const state = {};
  for (const key of ALLOWED) {
    const value = params.get(key);
    if (value) state[key] = value;
  }
  return state;
}

export function hrefFor(changes = {}, replace = false) {
  const current = replace ? {} : readState();
  const state = { ...current, ...changes };
  const params = new URLSearchParams();
  for (const key of ALLOWED) {
    if (state[key]) params.set(key, state[key]);
  }
  const query = params.toString();
  return `./index.html${query ? `?${query}` : ''}`;
}

export function navigate(href, useReplace = false) {
  const url = new URL(href, window.location.href);
  window.history[useReplace ? 'replaceState' : 'pushState']({}, '', `${url.pathname}${url.search}${url.hash}`);
  window.dispatchEvent(new CustomEvent('hub:navigate'));
}
