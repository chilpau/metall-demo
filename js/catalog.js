/* =========================================================
   Страница «Весь каталог»: рендер из js/catalog-data.js,
   фильтр, подсветка текущего раздела, переход по якорю.
   ========================================================= */
(function () {
  const CATALOG = window.CATALOG;
  const norm = window.normalizeQuery;
  const GRADES_VISIBLE = 8;
  const DOC = '<svg class="icon" viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 12v6M9 15l3 3 3-3"/></svg>';

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // itemId задан — марки становятся кнопками «добавить в заявку с этой маркой»
  function gradesList(grades, label, itemId) {
    if (!grades || !grades.length) return '';
    const hidden = grades.length - GRADES_VISIBLE;
    return `
      <div class="grades">
        ${label ? `<span class="grades__label">${label}</span>` : ''}
        <ul class="grades__list${hidden > 0 ? ' is-collapsed' : ''}">
          ${grades.map((g, i) => `<li${i >= GRADES_VISIBLE ? ' class="grades__extra"' : ''}>${itemId
            ? `<button class="grade" type="button" data-item="${itemId}" data-grade="${esc(g)}" aria-pressed="false" title="Добавить в заявку: ${esc(g)}">${esc(g)}</button>`
            : esc(g)}</li>`).join('')}
          ${hidden > 0 ? `<li class="grades__toggle"><button type="button" data-more="${hidden}">ещё ${hidden}</button></li>` : ''}
        </ul>
      </div>`;
  }

  /* ---------- рендер ---------- */
  const list = document.getElementById('cat-list');
  const navList = document.getElementById('cat-nav');

  list.innerHTML = CATALOG.map((cat) => `
    <section class="cat-section" id="${cat.id}" data-cat="${cat.id}">
      <header class="cat-section__head">
        <svg class="cat-section__img" viewBox="0 0 200 140" aria-hidden="true"><use href="#${cat.ill}"/></svg>
        <div>
          <h2 class="cat-section__title">${esc(cat.title)}</h2>
          <p class="cat-section__text">${esc(cat.text)}</p>
          ${cat.pdf ? `<a class="cat-section__pdf" href="${encodeURI(cat.pdf.url)}" target="_blank" rel="noopener">${DOC} Каталог «${esc(cat.pdf.name)}», PDF</a>` : ''}
        </div>
      </header>
      ${gradesList(cat.grades, 'Марки стали — выберите нужную в заявке')}
      <div class="items">
        ${cat.items.map((item) => `
          <article class="item" id="${item.id}"
                   data-search="${esc(norm(`${item.name} ${cat.title} ${item.note || ''} ${(item.grades || []).join(' ')} ${(cat.grades || []).join(' ')}`))}">
            <h3 class="item__name">${esc(item.name)}</h3>
            ${item.note ? `<p class="item__note">${esc(item.note)}</p>` : ''}
            ${gradesList(item.grades, '', item.id)}
            <div class="item__foot">
              <span class="item__price" data-price="${item.id}">Цена по запросу</span>
              <button class="btn-add" type="button" data-add="${item.id}">В заявку</button>
            </div>
          </article>`).join('')}
      </div>
    </section>`).join('');

  navList.innerHTML = CATALOG.map((cat) => `
    <li><a href="#${cat.id}" data-nav="${cat.id}">
      <span>${esc(cat.title)}</span><small>${cat.items.length}</small>
    </a></li>`).join('');

  const pdfs = [window.CATALOG_PDF];
  document.getElementById('pdf-links').innerHTML = pdfs.map((p) =>
    `<a class="btn btn--ghost" href="${encodeURI(p.url)}" target="_blank" rel="noopener">${DOC} Каталог «${esc(p.name)}», PDF</a>`).join('');

  const total = CATALOG.reduce((n, c) => n + c.items.length, 0);
  const stats = document.getElementById('catalog-stats');
  const setStats = (found) => {
    stats.textContent = found === null
      ? `${CATALOG.length} разделов · ${total} позиций`
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
    const words = norm(input.value.trim()).split(/[\s,]+/).filter(Boolean)
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
