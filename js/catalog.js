/* =========================================================
   Страница «Весь каталог»: каталог уже в HTML (генерируется
   tools/catalog/build_catalog.py), здесь — фильтр, цены, «ещё N»,
   подсветка текущего раздела, переход по якорю.
   ========================================================= */
(function () {
  const CATALOG = window.CATALOG;
  const norm = window.normalizeQuery;
  const DOC = '<svg class="icon" viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 12v6M9 15l3 3 3-3"/></svg>';

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  };

  /* ---------- рендер ---------- */
  const list = document.getElementById('cat-list');
  const navList = document.getElementById('cat-nav');

  // Разделы, позиции и меню уже лежат в catalog.html готовым HTML —
  // их генерирует tools/catalog/build_catalog.py, чтобы каталог видели поисковики.

  const total = CATALOG.reduce((n, c) => n + c.items.length, 0);
  const stats = document.getElementById('catalog-stats');
  const setStats = (found) => {
    stats.textContent = found === null
      ? `${CATALOG.length} ${plural(CATALOG.length, 'раздел', 'раздела', 'разделов')} · ${total} ${plural(total, 'позиция', 'позиции', 'позиций')}`
      : `Найдено позиций: ${found}`;
  };
  setStats(null);

  /* ---------- цены из таблицы ---------- */
  window.pricesReady.then((prices) => {
    list.querySelectorAll('[data-price]').forEach((el) => {
      const p = prices[el.dataset.price];
      const text = window.formatPrice(p);
      if (text) { el.textContent = text; el.classList.add('has-price'); }
      if (p && p.stock) el.insertAdjacentHTML('beforebegin', `<span class="item__stock">${esc(p.stock)}</span>`);
    });
  });
  if (window.cartUpdateBadges) window.cartUpdateBadges();

  /* ---------- «ещё N» марок ---------- */
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-more]');
    if (!btn) return;
    const ul = btn.closest('.grades__list');
    const collapsed = ul.classList.toggle('is-collapsed');
    btn.textContent = collapsed ? `ещё ${btn.dataset.more}` : 'свернуть';
  });

  /* ---------- фильтр ---------- */
  const input = document.getElementById('filter-input');
  const clear = document.getElementById('filter-clear');
  const empty = document.getElementById('cat-empty');
  const sections = [...list.querySelectorAll('.cat-section')];

  function applyFilter() {
    const words = norm(input.value.trim()).split(/\s+/).filter(Boolean)
      .map((w) => (w.length > 5 ? w.slice(0, -2) : w.length > 4 ? w.slice(0, -1) : w));
    clear.hidden = !words.length;

    let found = 0;
    sections.forEach((sec) => {
      let visible = 0;
      sec.querySelectorAll('.item').forEach((item) => {
        const ok = words.every((w) => item.dataset.search.includes(w));
        item.hidden = !ok;
        if (ok) visible++;
      });
      sec.hidden = visible === 0;
      found += visible;
      const navLink = navList.querySelector(`[data-nav="${sec.id}"]`);
      navLink.parentElement.classList.toggle('is-empty', visible === 0);
      navLink.querySelector('small').textContent = visible;
    });

    empty.hidden = found > 0;
    setStats(words.length ? found : null);
  }

  input.addEventListener('input', applyFilter);
  if (window.liftOnFocus) window.liftOnFocus(input, input.closest('.filter') || input);
  clear.addEventListener('click', () => { input.value = ''; applyFilter(); input.focus(); });

  /* ---------- подсветка текущего раздела в меню ---------- */
  const navLinks = [...navList.querySelectorAll('a')];
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle('is-active', a.dataset.nav === entry.target.id));
      // на мобильном держим активный пункт в зоне видимости горизонтальной ленты
      const active = navList.querySelector('.is-active');
      if (active && window.matchMedia('(max-width: 1024px)').matches) {
        navList.scrollTo({ left: active.offsetLeft - 16, behavior: 'smooth' });
      } else if (active && navList.scrollHeight > navList.clientHeight) {
        // на компьютере меню прокручивается — держим активный раздел в видимой части
        const top = active.offsetTop - navList.offsetTop, h = active.offsetHeight;
        if (top < navList.scrollTop || top + h > navList.scrollTop + navList.clientHeight) {
          navList.scrollTo({ top: top - navList.clientHeight / 3, behavior: 'smooth' });
        }
      }
    });
  }, { rootMargin: '-30% 0px -60% 0px' });
  sections.forEach((s) => spy.observe(s));

  /* ---------- переход по якорю (с главной или из поиска) ---------- */
  function focusHash(e) {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    if (target.hidden || target.closest('[hidden]')) { input.value = ''; applyFilter(); }
    target.scrollIntoView({
      block: target.classList.contains('item') ? 'center' : 'start',
      behavior: e ? 'smooth' : 'instant', // при открытии страницы — сразу, без долгой анимации
    });
    if (target.classList.contains('item')) {
      target.classList.remove('is-flash');
      void target.offsetWidth; // перезапуск анимации
      target.classList.add('is-flash');
    }
  }
  window.addEventListener('hashchange', focusHash);
  // якорь указывает на элементы, созданные скриптом, — браузер сам до них не прокрутит.
  // Ждём полной загрузки: иначе браузер после load сбрасывает позицию прокрутки.
  if (document.readyState === 'complete') focusHash();
  else window.addEventListener('load', () => setTimeout(() => focusHash(), 0));
})();
