/* =========================================================
   Посадочные страницы (/catalog/<slug>/): цены из таблицы
   и «ещё N» марок. Сам контент — готовый HTML (tools/build_pages.py).
   ========================================================= */
(function () {
  const list = document.getElementById('cat-list');
  if (!list) return;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  window.pricesReady.then((prices) => {
    list.querySelectorAll('[data-price]').forEach((el) => {
      const p = prices[el.dataset.price];
      const text = window.formatPrice(p);
      if (text) { el.textContent = text; el.classList.add('has-price'); }
      if (p && p.stock) el.insertAdjacentHTML('beforebegin', `<span class="item__stock">${esc(p.stock)}</span>`);
    });
  });

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-more]');
    if (!btn) return;
    const ul = btn.closest('.grades__list');
    const collapsed = ul.classList.toggle('is-collapsed');
    btn.textContent = collapsed ? `ещё ${btn.dataset.more}` : 'свернуть';
  });

  if (window.cartUpdateBadges) window.cartUpdateBadges();
})();
