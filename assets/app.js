(() => {
  const input = document.querySelector('[data-song-search]');
  const cards = Array.from(document.querySelectorAll('[data-song-card]'));
  const countEl = document.querySelector('[data-song-count]');

  function norm(s){ return (s || '').toLowerCase().trim(); }

  function applyFilter(){
    const q = norm(input && input.value);
    let visible = 0;
    for (const el of cards){
      const hay = norm(el.getAttribute('data-song-hay'));
      const show = !q || hay.includes(q);
      el.style.display = show ? '' : 'none';
      if (show) visible++;
    }
    if (countEl) countEl.textContent = String(visible);
  }

  if (input){
    input.addEventListener('input', applyFilter);
    applyFilter();
  }
})();
