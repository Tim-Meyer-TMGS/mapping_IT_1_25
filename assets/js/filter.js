(function(){
  function initTable(root){
    const q = root.querySelector('[data-q]');
    const filter = root.querySelector('[data-filter]');
    const count = root.querySelector('[data-count]');
    const tbody = root.querySelector('tbody[data-mapping]');
    if(!q || !filter || !count || !tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr'));
    function apply(){
      const term = (q.value || '').trim().toLowerCase();
      let c = 0;
      for(const r of rows){
        const txt = (r.innerText || '').toLowerCase();
        const isNew = r.querySelector('.new') !== null;
        const tds = r.querySelectorAll('td');
        const odta = (tds[2]?.innerText || '').trim();
        const schema = (tds[3]?.innerText || '').trim();
        const missing = (odta === '' && schema === '');
        const match = (term === '' || txt.includes(term));

        let ok = true;
        if(filter.value === 'new') ok = isNew;
        if(filter.value === 'missing') ok = missing;

        const show = match && ok;
        r.style.display = show ? '' : 'none';
        if(show) c++;
      }
      count.textContent = String(c);
    }
    q.addEventListener('input', apply);
    filter.addEventListener('change', apply);
    apply();
  }

  document.addEventListener('DOMContentLoaded', function(){
    document.querySelectorAll('[data-mapping-page]').forEach(initTable);
  });
})();
